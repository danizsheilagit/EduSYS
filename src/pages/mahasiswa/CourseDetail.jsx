import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, BookOpen, ClipboardList, MessageSquare, FileText, ExternalLink, Calendar, User, Star, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import FilePreview from '@/components/drive/FilePreview'
import toast from 'react-hot-toast'

const TABS = [
  { id: 'materi',  label: 'Materi',   icon: BookOpen },
  { id: 'tugas',   label: 'Tugas',    icon: ClipboardList },
  { id: 'forum',   label: 'Forum',    icon: MessageSquare },
  { id: 'ujian',   label: 'Ujian',    icon: FileText },
  { id: 'absensi', label: 'Absensi',  icon: CheckCircle2 },
]

export default function CourseDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate  = useNavigate()
  const [course,   setCourse]   = useState(null)
  const [tab,      setTab]      = useState('materi')
  const [loading,  setLoading]  = useState(true)

  useEffect(() => { fetchCourse() }, [id])

  async function fetchCourse() {
    const { data } = await supabase
      .from('courses')
      .select('*, dosen:profiles!courses_dosen_id_fkey(full_name, avatar_url)')
      .eq('id', id)
      .single()
    setCourse(data)
    setLoading(false)
  }

  if (loading) return <div style={{ display:'flex', justifyContent:'center', paddingTop:60 }}><div className="spinner"/></div>
  if (!course)  return <div className="empty-state"><p>Mata kuliah tidak ditemukan.</p></div>

  return (
    <div>
      {/* Back + header */}
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/mata-kuliah')} style={{ marginBottom:16 }}>
        <ArrowLeft size={14} /> Kembali
      </button>

      <div className="card" style={{ marginBottom:20 }}>
        <div style={{ height:8, background: course.cover_color || '#4f46e5', borderRadius:'10px 10px 0 0' }} />
        <div style={{ padding:'20px 24px', display:'flex', alignItems:'flex-start', gap:16, justifyContent:'space-between' }}>
          <div>
            <span style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.4px' }}>{course.code}</span>
            <h1 style={{ fontSize:20, fontWeight:800, color:'var(--gray-900)', marginTop:2 }}>{course.name}</h1>
            {course.description && <p style={{ fontSize:13, color:'var(--gray-500)', marginTop:4 }}>{course.description}</p>}
            <div style={{ display:'flex', gap:16, marginTop:10, fontSize:12, color:'var(--gray-400)' }}>
              <span style={{ display:'flex', alignItems:'center', gap:4 }}><User size={12}/> {course.dosen?.full_name || 'TBA'}</span>
              <span style={{ display:'flex', alignItems:'center', gap:4 }}><BookOpen size={12}/> {course.credits} SKS</span>
              <span style={{ display:'flex', alignItems:'center', gap:4 }}><Calendar size={12}/> {course.semester}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:20, borderBottom:'1px solid var(--gray-200)', paddingBottom:0 }}>
        {TABS.map(({ id: tid, label, icon: Icon }) => (
          <button
            key={tid}
            onClick={() => setTab(tid)}
            style={{
              display:'flex', alignItems:'center', gap:6,
              padding:'8px 16px',
              border:'none', background:'none', cursor:'pointer',
              fontSize:13, fontWeight: tab===tid ? 600 : 400,
              color: tab===tid ? 'var(--indigo-600)' : 'var(--gray-500)',
              borderBottom: tab===tid ? '2px solid var(--indigo-600)' : '2px solid transparent',
              marginBottom:-1, transition:'color .15s',
            }}
          >
            <Icon size={14}/> {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'materi'  && <MateriTab   courseId={id} userId={user?.id} />}
      {tab === 'tugas'   && <TugasTab    courseId={id} userId={user?.id} navigate={navigate} />}
      {tab === 'forum'   && <ForumTab    courseId={id} userId={user?.id} navigate={navigate} />}
      {tab === 'ujian'   && <UjianTab    courseId={id} userId={user?.id} navigate={navigate} />}
      {tab === 'absensi' && <AbsensiTab  courseId={id} userId={user?.id} />}
    </div>
  )
}

/* ── Progress helpers (localStorage) ─────────────────────────── */
const MATTYPE = {
  'video/youtube':                        { label:'YouTube',      color:'#ff0000', bg:'#fff0f0', icon:'🎬', canEmbed: true  },
  'application/vnd.google-apps.document': { label:'Google Drive', color:'#4285f4', bg:'#e8f0fe', icon:'📁', canEmbed: true  },
  'application/pdf':                      { label:'PDF',          color:'#ef4444', bg:'#fef2f2', icon:'📄', canEmbed: true  },
  'text/html':                            { label:'Artikel',      color:'#10b981', bg:'#f0fdf4', icon:'🌐', canEmbed: false },
}
function matType(mime) { return MATTYPE[mime] || { label:'Link', color:'var(--gray-500)', bg:'var(--gray-100)', icon:'🔗', canEmbed: false } }

function getProg(uid)           { try { return JSON.parse(localStorage.getItem(`edusys_mp_${uid}`) || '{}') } catch { return {} } }
function saveProg(uid, key, st) { const d = getProg(uid); d[key] = { ...d[key], ...st }; localStorage.setItem(`edusys_mp_${uid}`, JSON.stringify(d)) }
function pkey(mid, i)           { return `${mid}_${i}` }

function getYouTubeId(url = '') {
  // Handle all YouTube URL formats
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,          // watch?v=ID
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,      // youtu.be/ID
    /embed\/([a-zA-Z0-9_-]{11})/,          // embed/ID
    /shorts\/([a-zA-Z0-9_-]{11})/,         // shorts/ID
    /live\/([a-zA-Z0-9_-]{11})/,           // live/ID
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

function getEmbedUrl(mime, url = '') {
  if (mime === 'video/youtube') {
    const id = getYouTubeId(url)
    return id ? `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1` : null
  }
  if (mime === 'application/vnd.google-apps.document') {
    const id = url.match(/\/file\/d\/([^/?\s]+)/)?.[1] || url.match(/[?&]id=([^&]+)/)?.[1]
    return id ? `https://drive.google.com/file/d/${id}/preview` : null
  }
  if (mime === 'application/pdf') {
    const id = url.match(/\/file\/d\/([^/?\s]+)/)?.[1]
    if (id) return `https://drive.google.com/file/d/${id}/preview`
    return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`
  }
  return null
}

/* ── Single attachment row ───────────────────────────────────── */
function AttachItem({ attach, matId, idx, userId, onUpdate, onFirstOpen }) {
  const [open,     setOpen]   = useState(false)
  const [, tick]   = useState(0)
  const rerender   = () => tick(n => n + 1)

  const key   = pkey(matId, idx)
  const prog  = getProg(userId)[key] || {}
  const t     = matType(attach.mime)
  const embed = getEmbedUrl(attach.mime, attach.url)
  const ytId  = attach.mime === 'video/youtube' ? getYouTubeId(attach.url) : null

  const status = prog.completed ? 'selesai' : prog.opened ? 'dibuka' : 'belum'
  const SC = {
    belum:   { label:'Belum Dibuka',      color:'var(--gray-400)', bg:'var(--gray-100)', dot:'#9ca3af' },
    dibuka:  { label:'Sedang Dipelajari', color:'#2563eb',         bg:'#dbeafe',         dot:'#2563eb' },
    selesai: { label:'✓ Selesai',         color:'#16a34a',         bg:'#dcfce7',         dot:'#16a34a' },
  }[status]

  function handleToggleOpen(e) {
    e.stopPropagation?.()
    const next = !open
    setOpen(next)
    if (next && !prog.opened) {
      saveProg(userId, key, { opened: true, openedAt: Date.now() })
      rerender(); onUpdate?.()
      onFirstOpen?.()   // ← award materi points on first open
    }
  }
  function markDone(e) {
    e.stopPropagation()
    saveProg(userId, key, { opened: true, completed: true, completedAt: Date.now() })
    rerender(); onUpdate?.()
  }
  function markUndone(e) {
    e.stopPropagation()
    const d = getProg(userId)
    if (d[key]) { d[key].completed = false; delete d[key].completedAt }
    localStorage.setItem(`edusys_mp_${userId}`, JSON.stringify(d))
    rerender(); onUpdate?.()
  }

  return (
    <div style={{ border:'1.5px solid', borderColor: open ? t.color+'60' : 'var(--gray-200)', borderRadius:12, overflow:'hidden', transition:'border-color .2s', marginBottom:8 }}>

      {/* ── Header row ── */}
      <div onClick={handleToggleOpen} style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 14px', cursor:'pointer', background: status==='selesai' ? '#f0fdf4' : open ? t.bg+'80' : '#fff', transition:'background .2s', userSelect:'none' }}>
        {/* Type icon */}
        <div style={{ width:34, height:34, borderRadius:8, background:t.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0, border:`1.5px solid ${t.color}25` }}>
          {t.icon}
        </div>
        {/* Label + hint */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:700, fontSize:13, color:'var(--gray-900)' }}>{attach.label || t.label}</div>
          <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:1 }}>
            {embed ? 'Klik untuk buka preview' : 'Klik untuk lihat opsi'}
          </div>
        </div>
        {/* Status label (hidden on mobile) */}
        <span style={{ fontSize:11, fontWeight:600, color:SC.color, display:'flex', alignItems:'center', gap:4, flexShrink:0 }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:SC.dot, display:'inline-block' }}/>
          {SC.label}
        </span>
        {/* ✅ Quick-check circle — toggle done without expanding */}
        <button
          onClick={e => { status !== 'selesai' ? markDone(e) : markUndone(e) }}
          title={status === 'selesai' ? 'Tandai Belum Selesai' : 'Tandai Selesai'}
          style={{
            width:28, height:28, borderRadius:'50%', flexShrink:0, cursor:'pointer',
            background: status === 'selesai' ? '#16a34a' : '#fff',
            border: status === 'selesai' ? 'none' : '2px solid var(--gray-300)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:13, color: status === 'selesai' ? '#fff' : 'transparent',
            transition:'all .2s', boxShadow: status === 'selesai' ? '0 2px 6px #16a34a50' : 'none',
          }}
        >✓</button>
        {/* Expand chevron */}
        <span style={{ color:'var(--gray-400)', fontSize:11, transform: open ? 'rotate(180deg)' : 'none', transition:'transform .2s', flexShrink:0 }}>▾</span>
      </div>

      {/* ── Expanded content ── */}
      {open && (
        <div style={{ borderTop:'1px solid var(--gray-100)' }}>
          {embed ? (
            <>
              {/* iframe viewer */}
              <div style={{ position:'relative', width:'100%', aspectRatio: attach.mime==='video/youtube' ? '16/9' : '4/3', background:'#111' }}>
                <iframe
                  src={embed}
                  title={attach.label || t.label}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                  style={{ width:'100%', height:'100%', border:'none', display:'block' }}
                />
              </div>
              {/* Action bar */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:'#f9fafb', borderTop:'1px solid var(--gray-100)' }}>
                <a href={attach.url} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize:12, color:'var(--gray-400)', display:'flex', alignItems:'center', gap:4, textDecoration:'none' }}>
                  <ExternalLink size={12}/> Buka di tab baru
                </a>
                {status !== 'selesai' ? (
                  <button onClick={markDone} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 18px', borderRadius:20, border:'none', background:'#16a34a', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', boxShadow:'0 2px 8px #16a34a40' }}>
                    ✓ Tandai Selesai
                  </button>
                ) : (
                  <button onClick={markUndone} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:20, border:'1px solid var(--gray-200)', background:'#fff', color:'var(--gray-500)', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                    ↩ Belum Selesai
                  </button>
                )}
              </div>
            </>
          ) : attach.mime === 'video/youtube' && ytId ? (
            /* YouTube thumbnail card (embed blocked/restricted) */
            <div style={{ padding:16 }}>
              <a href={attach.url} target="_blank" rel="noopener noreferrer"
                onClick={() => { if (!prog.opened) { saveProg(userId, key, { opened:true, openedAt:Date.now() }); rerender(); onUpdate?.() } }}
                style={{ display:'block', position:'relative', borderRadius:12, overflow:'hidden', aspectRatio:'16/9', background:'#000', textDecoration:'none' }}>
                <img src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', opacity:.85 }}/>
                <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8 }}>
                  <div style={{ width:56, height:56, borderRadius:'50%', background:'#ff0000', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 16px rgba(0,0,0,.5)' }}>
                    <span style={{ fontSize:24, marginLeft:4 }}>▶</span>
                  </div>
                  <span style={{ color:'#fff', fontSize:12, fontWeight:700, background:'rgba(0,0,0,.5)', padding:'4px 12px', borderRadius:20 }}>
                    Buka di YouTube
                  </span>
                </div>
              </a>
              <div style={{ display:'flex', justifyContent:'flex-end', marginTop:10 }}>
                {status !== 'selesai' ? (
                  <button onClick={markDone} style={{ padding:'7px 18px', borderRadius:20, border:'none', background:'#16a34a', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', boxShadow:'0 2px 8px #16a34a40' }}>
                    ✓ Sudah Nonton — Tandai Selesai
                  </button>
                ) : (
                  <button onClick={markUndone} style={{ padding:'7px 14px', borderRadius:20, border:'1px solid var(--gray-200)', background:'#fff', color:'var(--gray-500)', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                    ↩ Belum Selesai
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Non-embeddable (artikel/web) */
            <div style={{ padding:'20px 16px', background:'#f9fafb' }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:14 }}>
                <div style={{ width:44, height:44, borderRadius:10, background:t.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 }}>{t.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:13, color:'var(--gray-800)', marginBottom:4 }}>{attach.label || t.label}</div>
                  <div style={{ fontSize:12, color:'var(--gray-500)', marginBottom:12 }}>
                    Panduan belajar:
                    <ol style={{ margin:'6px 0 0 16px', padding:0, lineHeight:1.8, color:'var(--gray-600)', fontSize:12 }}>
                      <li>Klik <strong>"Buka Konten"</strong> di bawah untuk membaca di tab baru</li>
                      <li>Setelah selesai membaca, kembali ke halaman ini</li>
                      <li>Klik <strong>"Tandai Selesai"</strong> atau tekan ✓ di baris atas</li>
                    </ol>
                  </div>
                  <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                    <a href={attach.url} target="_blank" rel="noopener noreferrer"
                      onClick={() => { if (!prog.opened) { saveProg(userId, key, { opened:true, openedAt:Date.now() }); rerender(); onUpdate?.() } }}
                      style={{ padding:'8px 18px', borderRadius:20, background:t.color, color:'#fff', fontSize:13, fontWeight:700, textDecoration:'none', display:'flex', alignItems:'center', gap:6, boxShadow:`0 2px 8px ${t.color}40` }}>
                      {t.icon} Buka Konten
                    </a>
                    {status !== 'selesai' ? (
                      <button onClick={markDone} style={{ padding:'8px 18px', borderRadius:20, border:'none', background:'#16a34a', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', boxShadow:'0 2px 8px #16a34a40' }}>
                        ✓ Tandai Selesai
                      </button>
                    ) : (
                      <button onClick={markUndone} style={{ padding:'8px 14px', borderRadius:20, border:'1px solid var(--gray-200)', background:'#fff', color:'var(--gray-500)', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                        ↩ Belum Selesai
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}


/* ── Materi Tab ──────────────────────────────────────────────── */
function MateriTab({ courseId, userId }) {
  const [items,   setItems]   = useState([])
  const [views,   setViews]   = useState({})   // material_id -> {points_awarded}
  const [loading, setLoading] = useState(true)
  const [, tick]  = useState(0)
  const rerender  = () => tick(n => n + 1)

  useEffect(() => {
    Promise.all([
      supabase.from('materials').select('*').eq('course_id', courseId).order('week_number').order('created_at'),
      supabase.from('material_views').select('material_id,points_awarded').eq('student_id', userId),
    ]).then(([{ data: mats }, { data: mv }]) => {
      setItems(mats || [])
      const map = {}
      ;(mv || []).forEach(v => { map[v.material_id] = v })
      setViews(map)
      setLoading(false)

      // Retroactive: klaim poin untuk materi yang sudah dibuka via localStorage tapi belum ada di DB
      const prog = getProg(userId)
      const opened = (mats || []).filter(m => {
        const links = (m.attachments?.length) ? m.attachments : m.webview_link ? [{ mime:m.mime_type, url:m.webview_link, label:'' }] : []
        const wasOpened = links.some((_, i) => prog[pkey(m.id, i)]?.opened)
        return wasOpened && !map[m.id]
      })
      if (opened.length > 0) {
        supabase.from('semesters').select('id').eq('is_active', true).single().then(({ data: sem }) => {
          if (!sem) return
          opened.forEach(m => {
            supabase.from('material_views').upsert({
              material_id: m.id, student_id: userId,
              semester_id: sem.id, points_awarded: true,
            }, { onConflict: 'material_id,student_id' }).then(({ error }) => {
              if (!error) {
                supabase.from('points_log').insert({
                  user_id: userId, course_id: courseId, semester_id: sem.id,
                  points: 5, source: 'materi',
                  reason: 'Buka materi: ' + m.id, reference_id: m.id,
                }).then(() => {
                  setViews(prev => ({ ...prev, [m.id]: { points_awarded: true } }))
                })
              }
            })
          })
        })
      }
    })
  }, [courseId])

  // Called when a material is first opened — award +5 pts
  async function handleMaterialOpen(materialId) {
    if (views[materialId]) return   // already tracked
    // Get active semester
    const { data: sem } = await supabase.from('semesters').select('id').eq('is_active', true).single()
    // Insert material_view (UPSERT — UNIQUE constraint handles dupes)
    const { error } = await supabase.from('material_views').upsert({
      material_id:    materialId,
      student_id:     userId,
      semester_id:    sem?.id || null,
      points_awarded: Boolean(sem),
    }, { onConflict: 'material_id,student_id' })
    if (!error) {
      setViews(prev => ({ ...prev, [materialId]: { points_awarded: Boolean(sem) } }))
      if (sem) {
        await supabase.from('points_log').insert({
          user_id:     userId,
          course_id:   courseId,
          semester_id: sem.id,
          points:      5,
          source:      'materi',
          reason:      'Buka materi: ' + materialId,
          reference_id: materialId,
        })
        toast.success('+5 pts ⭐ Poin materi diperoleh!', { duration: 2500 })
      }
    }
  }

  if (loading) return <div className="spinner" style={{ margin:'32px auto' }}/>
  if (!items.length) return (
    <div className="empty-state card" style={{ padding:40 }}>
      <BookOpen size={32} color="var(--gray-200)"/>
      <p className="empty-state-text">Belum ada materi</p>
    </div>
  )

  const byWeek = items.reduce((acc, m) => {
    const w = m.week_number || 0
    if (!acc[w]) acc[w] = []
    acc[w].push(m)
    return acc
  }, {})

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
      {Object.entries(byWeek).sort(([a],[b]) => +a - +b).map(([week, mats]) => (
        <div key={week}>
          {/* Week header */}
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
            <div style={{ height:1, flex:1, background:'var(--gray-200)' }}/>
            <span style={{ fontSize:11, fontWeight:800, color:'var(--indigo-600)', textTransform:'uppercase', letterSpacing:'.8px', padding:'3px 12px', background:'var(--indigo-50)', borderRadius:20 }}>
              {week === '0' ? '📌 Materi Umum' : `📖 Pertemuan ${week}`}
            </span>
            <div style={{ height:1, flex:1, background:'var(--gray-200)' }}/>
          </div>

          {/* Material cards */}
          {mats.map(m => {
            const links    = (m.attachments?.length) ? m.attachments : m.webview_link ? [{ mime:m.mime_type, url:m.webview_link, label:'' }] : []
            const prog     = getProg(userId)
            const doneCount = links.filter((_,i) => prog[pkey(m.id,i)]?.completed).length
            const openCount = links.filter((_,i) => prog[pkey(m.id,i)]?.opened).length
            const pct      = links.length > 0 ? Math.round(doneCount / links.length * 100) : 0
            const viewInfo = views[m.id]
            const ptsGiven = viewInfo?.points_awarded

            return (
              <div key={m.id} className="card" style={{ marginBottom:12, overflow:'hidden' }}>
                {/* Progress bar top */}
                <div style={{ height:3, background:'var(--gray-100)' }}>
                  <div style={{ height:'100%', width:`${pct}%`, background: pct===100 ? '#16a34a' : '#4f46e5', borderRadius:2, transition:'width .4s ease' }}/>
                </div>
                <div style={{ padding:'16px 18px 12px' }}>
                  {/* Card header */}
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, marginBottom:12 }}>
                    <div>
                      <div style={{ fontWeight:800, fontSize:14, color:'var(--gray-900)', display:'flex', alignItems:'center', gap:8 }}>
                        {m.title}
                        {/* Points indicator */}
                        {ptsGiven && (
                          <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:99, background:'#fef9c3', color:'#92400e', border:'1px solid #fde68a', display:'flex', alignItems:'center', gap:3, whiteSpace:'nowrap' }}>
                            <Star size={9} color="#f59e0b" fill="#f59e0b"/> +5 pts
                          </span>
                        )}
                        {viewInfo && !ptsGiven && (
                          <span style={{ fontSize:10, color:'var(--gray-400)', fontWeight:500 }}>dibuka</span>
                        )}
                      </div>
                      {m.description && <div style={{ fontSize:12, color:'var(--gray-500)', marginTop:3 }}>{m.description}</div>}
                    </div>
                    {links.length > 0 && (
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <div style={{ fontSize:11, fontWeight:700, color: pct===100 ? '#16a34a' : 'var(--gray-400)' }}>
                          {pct===100 ? '✓ Selesai' : `${doneCount}/${links.length} selesai`}
                        </div>
                        {openCount > 0 && openCount < links.length && (
                          <div style={{ fontSize:10, color:'var(--gray-400)', marginTop:1 }}>{openCount} sedang dipelajari</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Attachments */}
                  <div>
                    {links.map((a, ai) => (
                      <AttachItem
                        key={ai} attach={a} matId={m.id} idx={ai} userId={userId}
                        onUpdate={rerender}
                        onFirstOpen={() => handleMaterialOpen(m.id)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}


/* ── Tugas Tab ───────────────────────────────────────────────── */
function TugasTab({ courseId, userId, navigate }) {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('assignments').select('*, submissions!left(status, grade, student_id)')
      .eq('course_id', courseId).order('due_date')
      .then(({ data }) => { setItems(data||[]); setLoading(false) })
  }, [courseId])

  if (loading) return <div className="spinner" style={{ margin:'32px auto' }}/>
  if (!items.length) return (
    <div className="empty-state card" style={{ padding:40 }}>
      <ClipboardList size={32} color="var(--gray-200)"/>
      <p className="empty-state-text">Belum ada tugas</p>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {items.map(a => {
        const mySubmission = a.submissions?.find(s => s.student_id === userId)
        const due = a.due_date ? new Date(a.due_date) : null
        const daysLeft = due ? Math.ceil((due - Date.now()) / 86400000) : null
        const overdue = daysLeft !== null && daysLeft < 0
        const statusMap = { graded:'Sudah Dinilai', submitted:'Dikumpulkan', draft:'Draft', late:'Terlambat' }
        const statusColor = { graded:'badge-green', submitted:'badge-indigo', draft:'badge-slate', late:'badge-red' }
        return (
          <div key={a.id} className="card" style={{ padding:'14px 16px', cursor:'pointer' }}
            onClick={() => navigate(`/tugas/${a.id}`)}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, fontSize:13 }}>{a.title}</div>
                {a.description && <div style={{ fontSize:12, color:'var(--gray-500)', marginTop:2 }}>{a.description}</div>}
                <div style={{ display:'flex', gap:10, marginTop:8, alignItems:'center' }}>
                  {due && (
                    <span style={{ fontSize:11, color: overdue ? 'var(--danger)' : 'var(--gray-400)' }}>
                      📅 {due.toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' })}
                      {daysLeft !== null && !overdue && daysLeft <= 7 && ` · ${daysLeft} hari lagi`}
                      {overdue && ' · Lewat deadline'}
                    </span>
                  )}
                  <span style={{ fontSize:11, color:'var(--gray-400)' }}>Nilai maks: {a.max_score}</span>
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
                {mySubmission
                  ? <span className={`badge-pill ${statusColor[mySubmission.status] || 'badge-slate'}`}>{statusMap[mySubmission.status]}</span>
                  : <span className="badge-pill badge-amber">Belum Dikumpulkan</span>
                }
                {mySubmission?.grade !== null && mySubmission?.grade !== undefined && (
                  <span style={{ fontSize:13, fontWeight:700, color:'var(--indigo-600)' }}>{mySubmission.grade}/{a.max_score}</span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── Forum Tab ───────────────────────────────────────────────── */
function ForumTab({ courseId, navigate }) {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('forums').select('*, author:profiles(full_name), reply_count:forum_replies(count)')
      .eq('course_id', courseId).order('is_pinned', { ascending:false }).order('created_at', { ascending:false })
      .then(({ data }) => { setItems(data||[]); setLoading(false) })
  }, [courseId])

  if (loading) return <div className="spinner" style={{ margin:'32px auto' }}/>
  if (!items.length) return (
    <div className="empty-state card" style={{ padding:40 }}>
      <MessageSquare size={32} color="var(--gray-200)"/>
      <p className="empty-state-text">Belum ada diskusi</p>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {items.map(f => (
        <div key={f.id} className="card" style={{ padding:'14px 16px', cursor:'pointer' }}
          onClick={() => navigate(`/forum/${f.id}`)}>
          <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
            {f.is_pinned && <span style={{ fontSize:11, color:'var(--indigo-600)', fontWeight:700, flexShrink:0 }}>📌</span>}
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:600, fontSize:13 }}>{f.title}</div>
              <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:3 }}>
                {f.author?.full_name} · {new Date(f.created_at).toLocaleDateString('id-ID')} · {f.reply_count?.[0]?.count || 0} balasan
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Ujian Tab ───────────────────────────────────────────────── */
function UjianTab({ courseId, userId, navigate }) {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('exams').select('*, exam_answers!left(score, submitted_at, student_id, attempt_number)')
      .eq('course_id', courseId).eq('is_published', true).order('start_at')
      .then(({ data }) => { setItems(data||[]); setLoading(false) })
  }, [courseId])

  if (loading) return <div className="spinner" style={{ margin:'32px auto' }}/>
  if (!items.length) return (
    <div className="empty-state card" style={{ padding:40 }}>
      <FileText size={32} color="var(--gray-200)"/>
      <p className="empty-state-text">Belum ada ujian</p>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {items.map(e => {
        const myAnswers  = e.exam_answers?.filter(a => a.student_id === userId) || []
        const submitted  = myAnswers.filter(a => a.submitted_at)
        const latest     = myAnswers[myAnswers.length - 1] || null
        const typeLabel  = { uts:'UTS', uas:'UAS', kuis:'Kuis' }
        const mode       = e.exam_mode || 'ujian'
        const maxAtt     = e.max_attempts || 1
        const now        = Date.now()
        const started    = e.start_at ? new Date(e.start_at) <= now : true
        const ended      = e.end_at   ? new Date(e.end_at)   <= now : false
        const bestScore  = submitted.length ? Math.max(...submitted.map(a => a.score ?? 0)) : null

        // Determine button state
        const inProgress = latest && !latest.submitted_at   // currently active (resumed)
        const canRetry   = mode === 'quiz' || (mode === 'tryout' && submitted.length < maxAtt)
        const doneFinal  = submitted.length > 0 && !canRetry  // ujian selesai or tryout habis

        const modeColor  = mode==='tryout'?'#0891b2':mode==='quiz'?'#7c3aed':'var(--indigo-600)'
        const modeBg     = mode==='tryout'?'#e0f2fe':mode==='quiz'?'#f3e8ff':'#eef2ff'
        const modeLabel  = mode==='tryout'?'Try Out':mode==='quiz'?'Quiz':'Ujian'

        return (
          <div key={e.id} className="card" style={{ padding:'14px 16px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                  <span className="badge-pill badge-indigo">{typeLabel[e.type]}</span>
                  <span style={{ fontSize:10, fontWeight:700, background:modeBg, color:modeColor, padding:'2px 8px', borderRadius:20 }}>{modeLabel}</span>
                  <span style={{ fontWeight:600, fontSize:13 }}>{e.title}</span>
                </div>
                <div style={{ fontSize:11, color:'var(--gray-400)' }}>
                  Durasi: {e.duration_minutes} menit
                  {e.start_at && ` · Mulai: ${new Date(e.start_at).toLocaleString('id-ID')}`}
                  {submitted.length > 0 && mode !== 'ujian' && (
                    <span style={{ marginLeft:8, color: modeColor, fontWeight:600 }}>
                      {submitted.length}× percobaan
                      {mode==='tryout' && ` (maks ${maxAtt})`}
                      {bestScore !== null && ` · Terbaik: ${bestScore}`}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ textAlign:'right', flexShrink:0 }}>
                {doneFinal ? (
                  // Ujian selesai / tryout habis — tidak bisa lagi
                  <div>
                    <span className="badge-pill badge-green">Selesai</span>
                    {bestScore !== null && <div style={{ fontSize:13, fontWeight:700, color:'var(--indigo-600)', marginTop:4 }}>{bestScore} pts</div>}
                  </div>
                ) : ended ? (
                  <span className="badge-pill badge-red">Berakhir</span>
                ) : started ? (
                  // Can start / retry
                  <button className="btn btn-primary btn-sm" onClick={() => navigate(`/ujian/${e.id}`)}>
                    {inProgress ? 'Lanjutkan' : submitted.length > 0 ? (mode==='quiz' ? 'Kerjakan Lagi' : 'Coba Lagi') : 'Mulai'}
                  </button>
                ) : (
                  <span className="badge-pill badge-slate">Belum Dimulai</span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── Absensi Tab ───────────────────────────────────────── */
const STATUS_COLOR = {
  hadir: { label:'Hadir',  bg:'#dcfce7', color:'#16a34a' },
  izin:  { label:'Izin',   bg:'#dbeafe', color:'#2563eb' },
  sakit: { label:'Sakit',  bg:'#fef3c7', color:'#d97706' },
  alpha: { label:'Alpha',  bg:'#fee2e2', color:'#dc2626' },
}

function AbsensiTab({ courseId, userId }) {
  const [code,     setCode]     = useState('')
  const [submitting, setSubmit] = useState(false)
  const [history,  setHistory]  = useState([])  // {session, attendance}
  const [loading,  setLoading]  = useState(true)

  useEffect(() => { fetchHistory() }, [courseId])

  async function fetchHistory() {
    setLoading(true)
    // Fetch all sessions for this course + my attendance record
    const { data: sessions } = await supabase
      .from('attendance_sessions')
      .select('id,title,meeting_number,code,created_at,expires_at,is_active')
      .eq('course_id', courseId)
      .order('meeting_number')

    const { data: atts } = await supabase
      .from('attendances')
      .select('session_id,status,checked_in_at')
      .eq('student_id', userId)

    const attMap = {}
    ;(atts || []).forEach(a => { attMap[a.session_id] = a })

    setHistory((sessions || []).map(s => ({ session: s, attendance: attMap[s.id] || null })))
    setLoading(false)
  }

  async function handleCheckin() {
    const trimmed = code.trim().toUpperCase()
    if (trimmed.length !== 6) { toast.error('Kode harus 6 karakter'); return }
    setSubmit(true)

    // Find matching active session
    const { data: session } = await supabase
      .from('attendance_sessions')
      .select('id,expires_at,is_active')
      .eq('course_id', courseId)
      .eq('code', trimmed)
      .single()

    if (!session) { toast.error('Kode tidak ditemukan atau bukan untuk mata kuliah ini'); setSubmit(false); return }
    if (!session.is_active || new Date(session.expires_at) < new Date()) {
      toast.error('Sesi absensi sudah ditutup'); setSubmit(false); return
    }

    const { error } = await supabase.from('attendances').insert({
      session_id: session.id, student_id: userId, status: 'hadir',
    })

    if (error?.code === '23505') { toast.error('Anda sudah absen di sesi ini'); setSubmit(false); return }
    if (error) { toast.error('Gagal absen'); setSubmit(false); return }

    toast.success('✅ Absensi berhasil dicatat!', { duration: 3000 })
    setCode('')
    setSubmit(false)
    fetchHistory()
  }

  // Active session check (from history)
  const activeSession = history.find(h => h.session.is_active && new Date(h.session.expires_at) > new Date() && !h.attendance)

  const totalHadir = history.filter(h => h.attendance?.status === 'hadir').length
  const pctHadir   = history.length > 0 ? Math.round(totalHadir / history.length * 100) : 0

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* Check-in card */}
      <div className="card" style={{ padding:'20px 24px' }}>
        <div style={{ fontWeight:700, fontSize:14, marginBottom:4 }}>Input Kode Absensi</div>
        <div style={{ fontSize:12, color:'var(--gray-400)', marginBottom:16 }}>
          Masukkan kode 6 digit yang diberikan dosen
        </div>

        {activeSession && (
          <div style={{ marginBottom:12, padding:'10px 14px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, fontSize:12, color:'#16a34a', fontWeight:600 }}>
            ✅ Ada sesi aktif: Pertemuan {activeSession.session.meeting_number} — {activeSession.session.title}
          </div>
        )}

        <div style={{ display:'flex', gap:10 }}>
          <input
            className="input"
            placeholder="Masukkan kode (contoh: AB3C9F)"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            style={{ fontFamily:'monospace', fontSize:18, fontWeight:700, letterSpacing:4, textAlign:'center', maxWidth:260 }}
            onKeyDown={e => e.key === 'Enter' && handleCheckin()}
          />
          <button className="btn btn-primary" onClick={handleCheckin} disabled={submitting || code.length !== 6}
            style={{ display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap' }}>
            {submitting ? <div className="spinner" style={{ width:14, height:14, borderWidth:2 }}/> : <CheckCircle2 size={15}/>}
            Absen Sekarang
          </button>
        </div>
      </div>

      {/* Stats */}
      {history.length > 0 && (
        <div className="card" style={{ padding:'16px 20px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:20 }}>
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:.4 }}>Kehadiran Saya</div>
              <div style={{ fontSize:28, fontWeight:800, color: pctHadir >= 75 ? '#16a34a' : pctHadir >= 50 ? '#d97706' : '#dc2626' }}>
                {pctHadir}%
              </div>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ height:8, background:'var(--gray-100)', borderRadius:99, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${pctHadir}%`, background: pctHadir>=75?'#16a34a':pctHadir>=50?'#d97706':'#dc2626', borderRadius:99, transition:'width .5s ease' }}/>
              </div>
              <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:4 }}>
                {totalHadir} hadir dari {history.length} pertemuan
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History table */}
      <div className="card">
        <div className="card-header">
          <span style={{ fontWeight:700, fontSize:13 }}>Riwayat Kehadiran</span>
          <span style={{ fontSize:11, color:'var(--gray-400)' }}>{history.length} pertemuan</span>
        </div>
        {loading ? (
          <div style={{ padding:32, display:'flex', justifyContent:'center' }}><div className="spinner"/></div>
        ) : history.length === 0 ? (
          <div className="empty-state" style={{ padding:40 }}>
            <CheckCircle2 size={28} color="var(--gray-200)"/>
            <p className="empty-state-text">Belum ada sesi absensi</p>
          </div>
        ) : (
          <div>
            {history.map(({ session: s, attendance: a }) => {
              const expired = !s.is_active || new Date(s.expires_at) < new Date()
              const st = a ? STATUS_COLOR[a.status] : null
              return (
                <div key={s.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 20px', borderBottom:'1px solid var(--gray-100)' }}>
                  <div style={{ width:30, height:30, borderRadius:8, background:'var(--indigo-50)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color:'var(--indigo-600)', flexShrink:0 }}>
                    {s.meeting_number}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:13 }}>{s.title}</div>
                    <div style={{ fontSize:11, color:'var(--gray-400)' }}>
                      {new Date(s.created_at).toLocaleDateString('id-ID',{dateStyle:'medium'})}
                    </div>
                  </div>
                  {st ? (
                    <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:99, background:st.bg, color:st.color }}>
                      {st.label}
                      {a.checked_in_at && <span style={{ fontWeight:400, marginLeft:4, opacity:.7 }}>
                        · {new Date(a.checked_in_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}
                      </span>}
                    </span>
                  ) : (
                    <span style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:99, background:'var(--gray-100)', color:'var(--gray-400)' }}>
                      {expired ? 'Tidak Absen' : 'Belum Absen'}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
