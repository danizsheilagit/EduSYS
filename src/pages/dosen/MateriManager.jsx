import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BookMarked, Plus, Trash2, Edit2, X, Loader2, ExternalLink, ChevronDown, PlusCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'

// ── Attachment type definitions ────────────────────────────────
const ATTACH_TYPES = [
  { id: 'drive',   label: 'Google Drive',   icon: '📁', color: '#4285f4', bg: '#e8f0fe', mime: 'application/vnd.google-apps.document', placeholder: 'https://drive.google.com/file/d/...' },
  { id: 'youtube', label: 'YouTube',         icon: '🎬', color: '#ff0000', bg: '#fff1f2', mime: 'video/youtube',                        placeholder: 'https://www.youtube.com/watch?v=...' },
  { id: 'pdf',     label: 'PDF / Dokumen',   icon: '📄', color: '#ef4444', bg: '#fef2f2', mime: 'application/pdf',                      placeholder: 'https://example.com/file.pdf' },
  { id: 'web',     label: 'Artikel / Web',   icon: '🌐', color: '#10b981', bg: '#f0fdf4', mime: 'text/html',                            placeholder: 'https://...' },
]

const BLANK_ATTACH = () => ({ mime: ATTACH_TYPES[0].mime, url: '', label: '' })
const BLANK_FORM   = () => ({ title: '', description: '', week_number: 1, attachments: [BLANK_ATTACH()] })

function typeOf(mime) { return ATTACH_TYPES.find(t => t.mime === mime) || ATTACH_TYPES[3] }

function extractYouTubeId(url = '') {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
}

// ── Row for one attachment ─────────────────────────────────────
function AttachRow({ attach, idx, onChange, onRemove, canRemove }) {
  const t = typeOf(attach.mime)
  const ytId = attach.mime === 'video/youtube' ? extractYouTubeId(attach.url) : null

  return (
    <div style={{ border:'1px solid var(--gray-200)', borderRadius:10, padding:'12px 14px', marginBottom:10, background:'var(--gray-50)' }}>
      {/* Type + Remove */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
        <span style={{ fontSize:18 }}>{t.icon}</span>
        <div style={{ position:'relative', flex:'0 0 160px' }}>
          <select
            className="input"
            value={attach.mime}
            onChange={e => onChange(idx, 'mime', e.target.value)}
            style={{ paddingRight:28, fontSize:12 }}
          >
            {ATTACH_TYPES.map(a => (
              <option key={a.id} value={a.mime}>{a.icon} {a.label}</option>
            ))}
          </select>
          <ChevronDown size={12} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'var(--gray-400)' }}/>
        </div>
        <input
          className="input"
          placeholder="Label (opsional)"
          value={attach.label}
          onChange={e => onChange(idx, 'label', e.target.value)}
          style={{ flex:1, fontSize:12 }}
        />
        {canRemove && (
          <button className="btn btn-ghost btn-icon btn-sm" style={{ color:'var(--danger)', flexShrink:0 }} onClick={() => onRemove(idx)}>
            <X size={14}/>
          </button>
        )}
      </div>

      {/* URL */}
      <input
        className="input"
        placeholder={t.placeholder}
        value={attach.url}
        onChange={e => onChange(idx, 'url', e.target.value)}
        style={{ fontSize:12 }}
      />

      {/* YouTube preview */}
      {ytId && (
        <div style={{ position:'relative', marginTop:8, borderRadius:8, overflow:'hidden', aspectRatio:'16/9', maxHeight:120, background:'#000' }}>
          <img src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`} alt="thumbnail" style={{ width:'100%', height:'100%', objectFit:'cover', opacity:.85 }}/>
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ width:40, height:40, background:'#ff0000', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ fontSize:16 }}>▶</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────
export default function DosenMateriManager() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const { confirmDialog, showConfirm } = useConfirm()
  const [courses,   setCourses]   = useState([])
  const [courseId,  setCourseId]  = useState('')
  const [materials, setMaterials] = useState([])
  const [loading,   setLoading]   = useState(false)
  const [modal,     setModal]     = useState(false)
  const [editing,   setEditing]   = useState(null)
  const [saving,    setSaving]    = useState(false)
  const [form,      setForm]      = useState(BLANK_FORM())

  useEffect(() => { if (user) fetchCourses() }, [user])
  useEffect(() => { if (courseId) fetchMaterials() }, [courseId])

  async function fetchCourses() {
    const { data } = await supabase.from('courses').select('id,code,name').eq('dosen_id', user.id).order('name')
    setCourses(data || [])
    const paramId = searchParams.get('courseId')
    const match   = paramId && data?.find(c => c.id === paramId)
    setCourseId(match ? paramId : (data?.[0]?.id || ''))
  }

  async function fetchMaterials() {
    setLoading(true)
    const { data } = await supabase.from('materials').select('*').eq('course_id', courseId).order('week_number').order('created_at')
    setMaterials(data || [])
    setLoading(false)
  }

  function openNew() { setForm(BLANK_FORM()); setEditing(null); setModal(true) }
  function openEdit(m) {
    // Backward compat: if no attachments array, build from webview_link
    const attachments = (m.attachments && m.attachments.length > 0)
      ? m.attachments
      : m.webview_link ? [{ mime: m.mime_type || ATTACH_TYPES[0].mime, url: m.webview_link, label: '' }]
      : [BLANK_ATTACH()]
    setForm({ title: m.title, description: m.description||'', week_number: m.week_number||1, attachments })
    setEditing(m.id); setModal(true)
  }

  function updateAttach(idx, key, val) {
    setForm(f => {
      const arr = [...f.attachments]
      arr[idx] = { ...arr[idx], [key]: val }
      return { ...f, attachments: arr }
    })
  }
  function addAttach()      { setForm(f => ({ ...f, attachments: [...f.attachments, BLANK_ATTACH()] })) }
  function removeAttach(idx){ setForm(f => ({ ...f, attachments: f.attachments.filter((_,i) => i !== idx) })) }

  async function handleSave() {
    if (!form.title.trim()) { toast.error('Judul wajib diisi'); return }
    const filled = form.attachments.filter(a => a.url.trim())
    if (filled.length === 0) { toast.error('Tambahkan minimal 1 lampiran dengan URL'); return }
    setSaving(true)
    const first = filled[0]

    // Full payload (requires attachments column)
    const payload = {
      title: form.title, description: form.description,
      week_number: form.week_number,
      attachments:  filled,
      webview_link: first.url,
      mime_type:    first.mime,
    }

    let error
    if (editing) {
      ;({ error } = await supabase.from('materials').update(payload).eq('id', editing))
    } else {
      ;({ error } = await supabase.from('materials').insert({ ...payload, course_id: courseId, uploaded_by: user.id }))
    }

    // Fallback: if attachments column doesn't exist yet, save without it
    if (error && error.message?.includes('attachments')) {
      toast('⚠️ Kolom attachments belum ada. Jalankan SQL: ALTER TABLE materials ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT \'[]\';', { duration: 6000 })
      const fallbackPayload = { title: form.title, description: form.description, week_number: form.week_number, webview_link: first.url, mime_type: first.mime }
      if (editing) {
        ;({ error } = await supabase.from('materials').update(fallbackPayload).eq('id', editing))
      } else {
        ;({ error } = await supabase.from('materials').insert({ ...fallbackPayload, course_id: courseId, uploaded_by: user.id }))
      }
    }

    if (error) toast.error('Gagal menyimpan: ' + error.message)
    else {
      toast.success(editing ? 'Materi diperbarui' : 'Materi ditambahkan')
      setModal(false); setEditing(null); fetchMaterials()
    }
    setSaving(false)
  }

  async function handleDelete(id) {
    const ok = await showConfirm({
      title: 'Hapus Materi?',
      message: 'Materi dan semua file terkait akan dihapus. Tindakan ini tidak bisa dibatalkan.',
      confirmLabel: 'Ya, Hapus',
      variant: 'danger',
    })
    if (!ok) return
    await supabase.from('materials').delete().eq('id', id)
    toast('Materi dihapus', { icon: '🗑️' })
    fetchMaterials()
  }

  // Group by week
  const byWeek = materials.reduce((acc, m) => {
    const w = m.week_number || 0
    if (!acc[w]) acc[w] = []
    acc[w].push(m)
    return acc
  }, {})

  return (
    <>
    {confirmDialog}
    <div>
      <div className="page-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1 className="page-title">Kelola Materi</h1>
          <p className="page-subtitle">Upload dan atur materi perkuliahan</p>
        </div>
        <button className="btn btn-primary" onClick={openNew} disabled={!courseId}>
          <Plus size={14}/> Tambah Materi
        </button>
      </div>

      {/* Course Selector */}
      <div className="card" style={{ padding:'12px 16px', marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <label style={{ fontSize:12, fontWeight:600, color:'var(--gray-600)', flexShrink:0 }}>Mata Kuliah:</label>
          <div style={{ position:'relative', flex:1, maxWidth:360 }}>
            <select className="input" value={courseId} onChange={e => setCourseId(e.target.value)} style={{ paddingRight:32 }}>
              {courses.length === 0 && <option value="">Belum ada mata kuliah</option>}
              {courses.map(c => <option key={c.id} value={c.id}>{c.code} – {c.name}</option>)}
            </select>
            <ChevronDown size={13} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'var(--gray-400)' }}/>
          </div>
        </div>
      </div>

      {/* Material List */}
      {loading ? (
        <div className="spinner" style={{ margin:'40px auto' }}/>
      ) : Object.keys(byWeek).length === 0 ? (
        <div className="empty-state card" style={{ padding:48 }}>
          <BookMarked size={36} color="var(--gray-300)"/>
          <p className="empty-state-text">Belum ada materi</p>
          <p className="empty-state-sub">Tambahkan materi untuk mata kuliah ini</p>
          <button className="btn btn-primary btn-sm" onClick={openNew}><Plus size={13}/> Tambah</button>
        </div>
      ) : (
        Object.entries(byWeek).sort(([a],[b]) => +a - +b).map(([week, items]) => (
          <div key={week} className="card" style={{ marginBottom:12 }}>
            <div className="card-header">
              <span style={{ fontWeight:700, fontSize:13, color:'var(--indigo-600)' }}>
                {+week === 0 ? 'Umum' : `Pertemuan ${week}`}
              </span>
              <span className="badge-pill badge-slate">{items.length} materi</span>
            </div>
            {items.map((m, i) => {
              // Resolve attachments (new or old format)
              const links = (m.attachments && m.attachments.length)
                ? m.attachments
                : m.webview_link ? [{ mime: m.mime_type, url: m.webview_link, label: '' }]
                : []
              return (
                <div key={m.id} style={{
                  padding:'12px 16px',
                  borderTop: i > 0 ? '1px solid var(--gray-100)' : 'none',
                }}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:600, fontSize:13 }}>{m.title}</div>
                      {m.description && <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:2 }}>{m.description}</div>}
                      {/* Attachment chips */}
                      {links.length > 0 && (
                        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:8 }}>
                          {links.map((a, ai) => {
                            const t = typeOf(a.mime)
                            return (
                              <a key={ai} href={a.url} target="_blank" rel="noopener noreferrer"
                                style={{
                                  display:'inline-flex', alignItems:'center', gap:4, padding:'3px 10px',
                                  borderRadius:20, fontSize:11, fontWeight:600, textDecoration:'none',
                                  color: t.color, background: t.bg, border: `1px solid ${t.color}30`,
                                  cursor:'pointer', transition:'opacity .15s',
                                }}
                              >
                                <span>{t.icon}</span>
                                {a.label || t.label}
                                <ExternalLink size={9}/>
                              </a>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(m)} title="Edit">
                        <Edit2 size={13}/>
                      </button>
                      <button className="btn btn-ghost btn-icon btn-sm" style={{ color:'var(--danger)' }} onClick={() => handleDelete(m.id)}>
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ))
      )}

      {/* Modal */}
      {modal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth:540, maxHeight:'90vh', overflow:'auto' }}>
            <div className="modal-header" style={{ position:'sticky', top:0, background:'var(--surface)', zIndex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <BookMarked size={16} color="var(--indigo-600)"/>
                <span className="modal-title">{editing ? 'Edit Materi' : 'Tambah Materi'}</span>
              </div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setModal(false)}><X size={14}/></button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label className="input-label">Judul Materi *</label>
                <input className="input" placeholder="cth: Pengantar Sistem Operasi" value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))}/>
              </div>
              <div className="input-group">
                <label className="input-label">Deskripsi</label>
                <textarea className="input" rows={2} style={{ resize:'vertical' }} value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))}/>
              </div>
              <div className="input-group">
                <label className="input-label">Nomor Pertemuan</label>
                <input className="input" type="number" min={0} max={16} value={form.week_number} onChange={e => setForm(f=>({...f,week_number:+e.target.value}))}/>
                <span className="input-hint">Isi 0 untuk materi umum</span>
              </div>

              {/* Lampiran section */}
              <div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                  <label className="input-label" style={{ margin:0 }}>
                    Lampiran ({form.attachments.length})
                  </label>
                  <button className="btn btn-ghost btn-sm" onClick={addAttach} style={{ gap:5, color:'var(--indigo-600)' }}>
                    <PlusCircle size={13}/> Tambah Lampiran
                  </button>
                </div>

                {form.attachments.map((a, i) => (
                  <AttachRow
                    key={i}
                    attach={a}
                    idx={i}
                    onChange={updateAttach}
                    onRemove={removeAttach}
                    canRemove={form.attachments.length > 1}
                  />
                ))}
              </div>
            </div>
            <div className="modal-footer" style={{ position:'sticky', bottom:0, background:'var(--surface)', zIndex:1 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setModal(false)}>Batal</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 size={13} style={{ animation:'spin .7s linear infinite' }}/> : editing ? <Edit2 size={13}/> : <Plus size={13}/>}
                {editing ? 'Simpan Perubahan' : 'Tambahkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  )
}
