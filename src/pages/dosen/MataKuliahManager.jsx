import { useState, useEffect } from 'react'
import { Plus, BookOpen, Users, Edit2, Trash2, Loader2, X, Copy, CheckCircle2, Circle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'

const COLORS   = ['#4f46e5','#7c3aed','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4']
const SEMESTERS = ['Ganjil 2025/2026','Genap 2025/2026','Ganjil 2026/2027']

const BLANK_FORM = { code:'', name:'', description:'', credits:3, semester: SEMESTERS[0], cover_color:'#4f46e5', dosen_id:'' }

export default function DosenMataKuliah() {
  const { user, isAdmin } = useAuth()
  const { confirmDialog, showConfirm } = useConfirm()

  const [courses,    setCourses]    = useState([])
  const [dosenList,  setDosenList]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [modal,      setModal]      = useState(false)
  const [editing,    setEditing]    = useState(null)
  const [saving,     setSaving]     = useState(false)
  const [form,       setForm]       = useState(BLANK_FORM)

  // ── Copy state ─────────────────────────────────────────────
  const [copyModal,  setCopyModal]  = useState(false)
  const [copySource, setCopySource] = useState(null)   // course object
  const [copying,    setCopying]    = useState(false)
  const [copyStep,   setCopyStep]   = useState('')
  const [copyForm,   setCopyForm]   = useState({ code:'', name:'', semester: SEMESTERS[0], dosen_id:'' })
  const [copyOpts,   setCopyOpts]   = useState({
    materials: true, assignments: true, questions: true, exams: true, forums: true,
  })

  useEffect(() => {
    if (user) {
      fetchCourses()
      if (isAdmin) fetchDosenList()
    }
  }, [user, isAdmin])

  async function fetchCourses() {
    let query = supabase
      .from('courses')
      .select(`
        *,
        enrollments(count),
        dosen:profiles!courses_dosen_id_fkey(full_name, email)
      `)
      .order('created_at', { ascending: false })

    // Dosen hanya lihat MK miliknya; Admin lihat semua
    if (!isAdmin) query = query.eq('dosen_id', user.id)

    const { data, error } = await query
    if (error) console.error('[EduSYS] fetchCourses:', error)
    setCourses(data || [])
    setLoading(false)
  }

  async function fetchDosenList() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('role', 'dosen')
      .order('full_name')
    setDosenList(data || [])
  }

  function openNew() {
    setForm({ ...BLANK_FORM, dosen_id: isAdmin ? '' : user.id })
    setEditing(null)
    setModal(true)
  }

  function openEdit(c) {
    setForm({
      code:        c.code,
      name:        c.name,
      description: c.description || '',
      credits:     c.credits,
      semester:    c.semester || SEMESTERS[0],
      cover_color: c.cover_color || '#4f46e5',
      dosen_id:    c.dosen_id || '',
    })
    setEditing(c.id)
    setModal(true)
  }

  async function handleSave() {
    if (!form.code || !form.name) { toast.error('Kode dan nama wajib diisi'); return }
    if (isAdmin && !form.dosen_id) { toast.error('Pilih dosen pengampu terlebih dahulu'); return }

    setSaving(true)
    const payload = {
      ...form,
      dosen_id: isAdmin ? form.dosen_id : user.id,
    }

    let error
    if (editing) {
      ;({ error } = await supabase.from('courses').update(payload).eq('id', editing))
    } else {
      ;({ error } = await supabase.from('courses').insert(payload))
    }

    if (error) {
      console.error('[EduSYS] save course:', error)
      toast.error(`Gagal menyimpan: ${error.message}`)
    } else {
      toast.success(editing ? 'Mata kuliah diperbarui' : 'Mata kuliah ditambahkan')
      setModal(false)
      fetchCourses()
    }
    setSaving(false)
  }

  async function handleDelete(id) {
    const ok = await showConfirm({
      title: 'Hapus Mata Kuliah?',
      message: 'Semua data terkait (tugas, ujian, materi, forum) akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.',
      confirmLabel: 'Ya, Hapus',
      variant: 'danger',
    })
    if (!ok) return
    const { error } = await supabase.from('courses').delete().eq('id', id)
    if (error) toast.error('Gagal menghapus')
    else { toast.success('Mata kuliah dihapus'); fetchCourses() }
  }

  // ── Copy helpers ────────────────────────────────────────────
  function openCopy(c) {
    setCopySource(c)
    setCopyForm({ code: c.code + '-COPY', name: 'Salinan ' + c.name, semester: SEMESTERS[0], dosen_id: c.dosen_id || '' })
    setCopyOpts({ materials: true, assignments: true, questions: true, exams: true, forums: true })
    setCopyStep('')
    setCopyModal(true)
  }

  async function handleCopy() {
    if (!copyForm.code.trim() || !copyForm.name.trim()) { toast.error('Kode dan nama wajib diisi'); return }
    if (!copyForm.dosen_id) { toast.error('Pilih dosen pengampu'); return }
    setCopying(true)
    try {
      // 1. Buat course baru
      setCopyStep('Membuat mata kuliah baru...')
      const { data: newCourse, error: cErr } = await supabase.from('courses').insert({
        code: copyForm.code.trim(), name: copyForm.name.trim(),
        description: copySource.description || '',
        credits: copySource.credits, semester: copyForm.semester,
        cover_color: copySource.cover_color || '#4f46e5',
        dosen_id: copyForm.dosen_id, is_active: true,
      }).select().single()
      if (cErr) throw new Error('Gagal membuat mata kuliah: ' + cErr.message)

      const sid = copySource.id, nid = newCourse.id

      // 2. Parallel copy semua konten
      await Promise.all([
        copyOpts.materials   && copyMaterials(sid, nid),
        copyOpts.assignments && copyAssignments(sid, nid),
        copyOpts.questions   && copyQuestions(sid, nid),
        copyOpts.exams       && copyExams(sid, nid),
        copyOpts.forums      && copyForums(sid, nid),
      ].filter(Boolean))

      toast.success(`Mata kuliah "${newCourse.name}" berhasil disalin!`)
      setCopyModal(false)
      fetchCourses()
    } catch (err) {
      toast.error(err.message || 'Gagal menyalin mata kuliah')
    } finally {
      setCopying(false)
      setCopyStep('')
    }
  }

  async function copyMaterials(fromId, toId) {
    setCopyStep('Menyalin materi...')
    const { data } = await supabase.from('materials').select('*').eq('course_id', fromId)
    if (!data?.length) return
    const rows = data.map(({ id: _id, course_id: _c, created_at: _ca, updated_at: _ua, ...rest }) => ({ ...rest, course_id: toId }))
    await supabase.from('materials').insert(rows)
  }

  async function copyAssignments(fromId, toId) {
    setCopyStep('Menyalin tugas...')
    const { data } = await supabase.from('assignments').select('*').eq('course_id', fromId)
    if (!data?.length) return
    const rows = data.map(({ id: _id, course_id: _c, created_at: _ca, updated_at: _ua, ...rest }) => ({
      ...rest, course_id: toId, due_date: null, // clear deadline
    }))
    await supabase.from('assignments').insert(rows)
  }

  async function copyQuestions(fromId, toId) {
    setCopyStep('Menyalin bank soal...')
    const { data } = await supabase.from('questions').select('*').eq('course_id', fromId)
    if (!data?.length) return
    const rows = data.map(({ id: _id, course_id: _c, created_at: _ca, ...rest }) => ({ ...rest, course_id: toId }))
    await supabase.from('questions').insert(rows)
  }

  async function copyExams(fromId, toId) {
    setCopyStep('Menyalin struktur ujian...')
    const { data } = await supabase.from('exams').select('*').eq('course_id', fromId)
    if (!data?.length) return
    const rows = data.map(({ id: _id, course_id: _c, created_at: _ca, updated_at: _ua, ...rest }) => ({
      ...rest, course_id: toId,
      is_published: false, // reset — perlu dipublish ulang
      start_at: null, end_at: null,
    }))
    await supabase.from('exams').insert(rows)
  }

  async function copyForums(fromId, toId) {
    setCopyStep('Menyalin forum...')
    const { data } = await supabase.from('forums').select('*').eq('course_id', fromId)
    if (!data?.length) return
    const rows = data.map(({ id: _id, course_id: _c, created_at: _ca, updated_at: _ua, ...rest }) => ({ ...rest, course_id: toId }))
    await supabase.from('forums').insert(rows)
  }

  const pageTitle    = isAdmin ? 'Semua Mata Kuliah' : 'Manajemen Mata Kuliah'
  const pageSubtitle = isAdmin
    ? `${courses.length} mata kuliah terdaftar`
    : `${courses.length} mata kuliah Anda`

  return (
    <>
    {confirmDialog}
    <div>
      <div className="page-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1 className="page-title">{pageTitle}</h1>
          <p className="page-subtitle">{pageSubtitle}</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          <Plus size={14}/> Tambah Mata Kuliah
        </button>
      </div>

      {loading ? (
        <div className="spinner" style={{ margin:'40px auto' }}/>
      ) : courses.length === 0 ? (
        <div className="empty-state card" style={{ padding:48 }}>
          <BookOpen size={36} color="var(--gray-300)"/>
          <p className="empty-state-text">Belum ada mata kuliah</p>
          <button className="btn btn-primary btn-sm" onClick={openNew}><Plus size={13}/> Tambah</button>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {courses.map((c, i) => (
            <div key={c.id} className="card" style={{ padding:0, overflow:'hidden' }}>
              <div style={{ display:'flex', alignItems:'stretch' }}>
                <div style={{ width:6, background: c.cover_color || COLORS[i%COLORS.length], flexShrink:0 }}/>
                <div style={{ flex:1, padding:'14px 18px', display:'flex', alignItems:'center', gap:16 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                      <span style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase' }}>{c.code}</span>
                      <span className="badge-pill badge-slate">{c.semester}</span>
                      <span className="badge-pill badge-indigo">{c.credits} SKS</span>
                      {/* Tampilkan nama dosen di view Admin */}
                      {isAdmin && c.dosen && (
                        <span className="badge-pill badge-amber">👤 {c.dosen.full_name}</span>
                      )}
                    </div>
                    <div style={{ fontWeight:700, fontSize:14, color:'var(--gray-900)', marginTop:2 }}>{c.name}</div>
                    {c.description && <div style={{ fontSize:12, color:'var(--gray-500)', marginTop:2 }}>{c.description}</div>}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--gray-400)', flexShrink:0 }}>
                    <Users size={12}/> {c.enrollments?.[0]?.count || 0} mahasiswa
                  </div>
                  <div style={{ display:'flex', gap:6 }}>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(c)} title="Edit"><Edit2 size={13}/></button>
                    {isAdmin && (
                      <button className="btn btn-ghost btn-icon btn-sm" style={{ color:'var(--indigo-600)' }} onClick={() => openCopy(c)} title="Salin Mata Kuliah">
                        <Copy size={13}/>
                      </button>
                    )}
                    <button className="btn btn-ghost btn-icon btn-sm" style={{ color:'var(--danger)' }} onClick={() => handleDelete(c.id)} title="Hapus"><Trash2 size={13}/></button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal tambah / edit */}
      {modal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{editing ? 'Edit' : 'Tambah'} Mata Kuliah</span>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setModal(false)}><X size={14}/></button>
            </div>
            <div className="modal-body">
              {/* Pilih Dosen — hanya untuk Admin */}
              {isAdmin && (
                <div className="input-group">
                  <label className="input-label">Dosen Pengampu *</label>
                  <select className="input" value={form.dosen_id} onChange={e => setForm(f => ({...f, dosen_id: e.target.value}))}>
                    <option value="">— Pilih Dosen —</option>
                    {dosenList.map(d => (
                      <option key={d.id} value={d.id}>{d.full_name} ({d.email})</option>
                    ))}
                  </select>
                  {dosenList.length === 0 && (
                    <span className="input-hint" style={{ color:'var(--warning)' }}>
                      Belum ada akun dengan role Dosen. Tambahkan dulu di Manajemen Pengguna.
                    </span>
                  )}
                </div>
              )}

              <div className="form-grid form-grid-2">
                <div className="input-group">
                  <label className="input-label">Kode MK *</label>
                  <input className="input" placeholder="MIF123" value={form.code} onChange={e => setForm(f=>({...f, code:e.target.value}))}/>
                </div>
                <div className="input-group">
                  <label className="input-label">SKS</label>
                  <input className="input" type="number" min={1} max={6} value={form.credits} onChange={e => setForm(f=>({...f, credits:+e.target.value}))}/>
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Nama Mata Kuliah *</label>
                <input className="input" placeholder="Pemrograman Web" value={form.name} onChange={e => setForm(f=>({...f, name:e.target.value}))}/>
              </div>
              <div className="input-group">
                <label className="input-label">Deskripsi</label>
                <textarea className="input" rows={2} style={{ resize:'vertical' }} value={form.description} onChange={e => setForm(f=>({...f, description:e.target.value}))}/>
              </div>
              <div className="input-group">
                <label className="input-label">Semester</label>
                <select className="input" value={form.semester} onChange={e => setForm(f=>({...f, semester:e.target.value}))}>
                  {SEMESTERS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Warna Kelas</label>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setForm(f=>({...f,cover_color:c}))}
                      style={{ width:28, height:28, borderRadius:'50%', background:c,
                        border: form.cover_color===c ? '3px solid var(--gray-900)' : '3px solid transparent',
                        cursor:'pointer' }}/>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setModal(false)}>Batal</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 size={13} style={{ animation:'spin .7s linear infinite' }}/> : null}
                {editing ? 'Simpan' : 'Tambahkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Copy Modal ───────────────────────────────────────── */}
      {copyModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth:520 }}>
            <div className="modal-header">
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <Copy size={15} color="var(--indigo-600)"/>
                <span className="modal-title">Salin Mata Kuliah</span>
              </div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setCopyModal(false)} disabled={copying}><X size={14}/></button>
            </div>
            <div className="modal-body">

              {/* Source info */}
              <div style={{ background:'var(--gray-50)', borderRadius:10, padding:'10px 14px', marginBottom:16, border:'1px solid var(--gray-200)' }}>
                <div style={{ fontSize:11, color:'var(--gray-400)', fontWeight:600, marginBottom:3 }}>SUMBER</div>
                <div style={{ fontWeight:700, fontSize:14 }}>{copySource?.name}</div>
                <div style={{ fontSize:12, color:'var(--gray-400)' }}>{copySource?.code} · {copySource?.semester} · {copySource?.credits} SKS</div>
              </div>

              {/* Dosen */}
              <div className="input-group">
                <label className="input-label">Dosen Pengampu *</label>
                <select className="input" value={copyForm.dosen_id} onChange={e => setCopyForm(f => ({...f, dosen_id: e.target.value}))}>
                  <option value="">— Pilih Dosen —</option>
                  {dosenList.map(d => <option key={d.id} value={d.id}>{d.full_name} ({d.email})</option>)}
                </select>
              </div>

              <div className="form-grid form-grid-2">
                <div className="input-group">
                  <label className="input-label">Kode MK Baru *</label>
                  <input className="input" placeholder="MIF123-COPY" value={copyForm.code} onChange={e => setCopyForm(f => ({...f, code: e.target.value}))}/>
                </div>
                <div className="input-group">
                  <label className="input-label">Semester Baru</label>
                  <select className="input" value={copyForm.semester} onChange={e => setCopyForm(f => ({...f, semester: e.target.value}))}>
                    {SEMESTERS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Nama Mata Kuliah Baru *</label>
                <input className="input" value={copyForm.name} onChange={e => setCopyForm(f => ({...f, name: e.target.value}))}/>
              </div>

              {/* Apa yang disalin */}
              <div style={{ marginTop:4 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--gray-600)', marginBottom:8 }}>Salin konten:</div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {[
                    { key:'materials',   label:'Materi & Modul',        desc:'Semua file materi per minggu' },
                    { key:'assignments', label:'Tugas',                  desc:'Struktur tugas (deadline dikosongkan)' },
                    { key:'questions',   label:'Bank Soal',              desc:'Semua soal pilihan ganda' },
                    { key:'exams',       label:'Ujian',                  desc:'Struktur ujian (di-reset, belum dipublikasi)' },
                    { key:'forums',      label:'Topik Forum',            desc:'Thread forum (tanpa balasan)' },
                  ].map(({ key, label, desc }) => (
                    <div key={key}
                      onClick={() => !copying && setCopyOpts(o => ({...o, [key]: !o[key]}))}
                      style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:8,
                        background: copyOpts[key] ? '#eef2ff' : 'var(--gray-50)',
                        border: `1px solid ${copyOpts[key] ? '#c7d2fe' : 'var(--gray-200)'}`,
                        cursor: copying ? 'default' : 'pointer', transition:'all .15s' }}
                    >
                      {copyOpts[key]
                        ? <CheckCircle2 size={15} color="var(--indigo-600)" style={{ flexShrink:0 }}/>
                        : <Circle size={15} color="var(--gray-300)" style={{ flexShrink:0 }}/>}
                      <div>
                        <div style={{ fontSize:13, fontWeight:600, color: copyOpts[key] ? 'var(--indigo-700)' : 'var(--gray-700)' }}>{label}</div>
                        <div style={{ fontSize:11, color:'var(--gray-400)' }}>{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Progress */}
              {copying && copyStep && (
                <div style={{ marginTop:14, display:'flex', alignItems:'center', gap:8, color:'var(--indigo-600)', fontSize:13 }}>
                  <Loader2 size={14} style={{ animation:'spin .7s linear infinite', flexShrink:0 }}/>
                  {copyStep}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setCopyModal(false)} disabled={copying}>Batal</button>
              <button className="btn btn-primary btn-sm" onClick={handleCopy} disabled={copying}
                style={{ display:'flex', alignItems:'center', gap:6 }}>
                {copying
                  ? <><Loader2 size={13} style={{ animation:'spin .7s linear infinite' }}/> Menyalin...</>
                  : <><Copy size={13}/> Salin Sekarang</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  )
}
