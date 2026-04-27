import { useState, useEffect } from 'react'
import { Plus, BookOpen, Users, Edit2, Trash2, Loader2, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const COLORS   = ['#4f46e5','#7c3aed','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4']
const SEMESTERS = ['Ganjil 2025/2026','Genap 2025/2026','Ganjil 2026/2027']

const BLANK_FORM = { code:'', name:'', description:'', credits:3, semester: SEMESTERS[0], cover_color:'#4f46e5', dosen_id:'' }

export default function DosenMataKuliah() {
  const { user, isAdmin } = useAuth()

  const [courses,   setCourses]   = useState([])
  const [dosenList, setDosenList] = useState([])   // untuk pilihan dosen (admin only)
  const [loading,   setLoading]   = useState(true)
  const [modal,     setModal]     = useState(false)
  const [editing,   setEditing]   = useState(null)
  const [saving,    setSaving]    = useState(false)
  const [form,      setForm]      = useState(BLANK_FORM)

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
    if (!confirm('Hapus mata kuliah ini? Semua data terkait (tugas, ujian, forum) akan terhapus.')) return
    const { error } = await supabase.from('courses').delete().eq('id', id)
    if (error) toast.error('Gagal menghapus')
    else { toast.success('Mata kuliah dihapus'); fetchCourses() }
  }

  const pageTitle    = isAdmin ? 'Semua Mata Kuliah' : 'Manajemen Mata Kuliah'
  const pageSubtitle = isAdmin
    ? `${courses.length} mata kuliah terdaftar`
    : `${courses.length} mata kuliah Anda`

  return (
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
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(c)}><Edit2 size={13}/></button>
                    <button className="btn btn-ghost btn-icon btn-sm" style={{ color:'var(--danger)' }} onClick={() => handleDelete(c.id)}><Trash2 size={13}/></button>
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
    </div>
  )
}
