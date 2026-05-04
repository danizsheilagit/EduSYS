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

// ── Persistensi timer & done per lampiran ────────────────────────────────
// Timer: simpan kapan lampiran pertama kali dibuka (epoch ms)
function timerKey(uid, mid, i)   { return `edusys_tmr_${uid}_${mid}_${i}` }
function getOpenedAt(uid,mid,i)  { return parseInt(localStorage.getItem(timerKey(uid,mid,i)) || '0') }
function saveOpenedAt(uid,mid,i) { if (!getOpenedAt(uid,mid,i)) localStorage.setItem(timerKey(uid,mid,i), String(Date.now())) }
// Done set: track per lampiran yang sudah selesai
function doneKey(uid)            { return `edusys_done_v2_${uid}` }
function getDoneSet(uid)         { try { return new Set(JSON.parse(localStorage.getItem(doneKey(uid)) || '[]')) } catch { return new Set() } }
function saveDone(uid, refId)    { const s = getDoneSet(uid); s.add(refId); localStorage.setItem(doneKey(uid), JSON.stringify([...s])) }

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

/* ── Countdown ring SVG helper ──────────────────────────────── */
const COUNTDOWN_SEC = 180
function CountdownRing({ seconds }) {
  const r = 12, circ = 2 * Math.PI * r
  const pct  = ((COUNTDOWN_SEC - seconds) / COUNTDOWN_SEC)
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return (
    <div style={{ width:28, height:28, flexShrink:0, position:'relative' }}>
      <svg width="28" height="28" style={{ transform:'rotate(-90deg)', position:'absolute', inset:0 }}>
        <circle cx="14" cy="14" r={r} fill="none" stroke="#e5e7eb" strokeWidth="2.5"/>
        <circle cx="14" cy="14" r={r} fill="none" stroke="#f59e0b" strokeWidth="2.5"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          style={{ transition:'stroke-dashoffset .9s linear' }}/>
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:6.5, fontWeight:800, color:'#d97706', lineHeight:1 }}>
        {mins}:{String(secs).padStart(2,'0')}
      </div>
    </div>
  )
}

/* ── Single attachment row ───────────────────────────────────── */
function AttachItem({ attach, matId, idx, userId, isCompleted, onMarkDone, onUpdate, onFirstOpen }) {
  const [open,      setOpen]      = useState(false)
  // Init countdown dari localStorage — lanjutkan dari sisa waktu sebelumnya
  const elapsed0   = isCompleted ? 0 : Math.floor((Date.now() - (getOpenedAt(userId, matId, idx) || Date.now())) / 1000)
  const initCd     = isCompleted ? 0 : Math.max(0, COUNTDOWN_SEC - elapsed0)
  const [countdown, setCountdown] = useState(initCd)
  const timerRef = useRef(null)
  const [, tick]   = useState(0)
  const rerender   = () => tick(n => n + 1)

  const key   = pkey(matId, idx)
  const prog  = getProg(userId)[key] || {}
  const t     = matType(attach.mime)
  const embed = getEmbedUrl(attach.mime, attach.url)
  const ytId  = attach.mime === 'video/youtube' ? getYouTubeId(attach.url) : null

  const status = isCompleted ? 'selesai' : prog.opened ? 'dibuka' : 'belum'
  const SC = {
    belum:   { label:'Belum Dibuka',      color:'var(--gray-400)', bg:'var(--gray-100)', dot:'#9ca3af' },
    dibuka:  { label:'Sedang Dipelajari', color:'#2563eb',         bg:'#dbeafe',         dot:'#2563eb' },
    selesai: { label:'✓ Selesai',         color:'#16a34a',         bg:'#dcfce7',         dot:'#16a34a' },
  }[status]

  // Start/stop countdown — lanjutkan dari sisa waktu (bukan reset ke 180)
  useEffect(() => {
    if (open && !isCompleted && countdown > 0) {
      timerRef.current = setInterval(() => {
        setCountdown(c => {
          if (c <= 1) { clearInterval(timerRef.current); return 0 }
          return c - 1
        })
      }, 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [open, isCompleted])

  function handleToggleOpen(e) {
    e.stopPropagation?.()
    const next = !open
    setOpen(next)
    if (next && !prog.opened) {
      saveProg(userId, key, { opened: true, openedAt: Date.now() })
      rerender(); onUpdate?.()
    }
    if (next && !isCompleted) {
      // Simpan waktu pertama buka ke localStorage (tidak overwrite jika sudah ada)
      saveOpenedAt(userId, matId, idx)
      // Recalculate remaining dari openedAt yang tersimpan
      const elapsed = Math.floor((Date.now() - getOpenedAt(userId, matId, idx)) / 1000)
      const remaining = Math.max(0, COUNTDOWN_SEC - elapsed)
      setCountdown(remaining)
    }
  }

  function tryMarkDone(e) {
    e.stopPropagation()
    if (countdown > 0 || isCompleted) return
    onMarkDone?.(idx)
  }

  // Shared "Selesai" button shown in every content type's action bar
  function SelesaiBtn() {
    if (isCompleted) return (
      <span style={{ fontSize:12, color:'#16a34a', fontWeight:700, display:'flex', alignItems:'center', gap:5 }}>
        ✓ Sudah Dipelajari
      </span>
    )
    const ready = countdown === 0
    return (
      <button onClick={tryMarkDone} disabled={!ready}
        style={{
          display:'flex', alignItems:'center', gap:6, padding:'7px 18px',
          borderRadius:20, border:'none', fontSize:12, fontWeight:700,
          cursor: ready ? 'pointer' : 'not-allowed', transition:'all .3s',
          background: ready ? '#16a34a' : 'var(--gray-100)',
          color:      ready ? '#fff'    : 'var(--gray-400)',
          boxShadow:  ready ? '0 2px 8px #16a34a40' : 'none',
          animation:  ready ? 'pulse-green 1.5s infinite' : 'none',
        }}>
        {ready
          ? '✓ Selesai Dipelajari (+3 pts)'
          : `⏱ ${Math.floor(countdown/60)}:${String(countdown%60).padStart(2,'0')} tersisa`}
      </button>
    )
  }

  return (
    <div style={{ border:'1.5px solid', borderColor: open ? t.color+'60' : 'var(--gray-200)', borderRadius:12, overflow:'hidden', transition:'border-color .2s', marginBottom:8 }}>

      {/* ── Header row ── */}
      <div onClick={handleToggleOpen} style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 14px', cursor:'pointer', background: status==='selesai' ? '#f0fdf4' : open ? t.bg+'80' : '#fff', transition:'background .2s', userSelect:'none' }}>
        <div style={{ width:34, height:34, borderRadius:8, background:t.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0, border:`1.5px solid ${t.color}25` }}>
          {t.icon}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:700, fontSize:13, color:'var(--gray-900)' }}>{attach.label || t.label}</div>
          <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:1 }}>
            {!isCompleted && open && countdown > 0
              ? <span style={{ color:'#d97706', fontWeight:600 }}>⏱ Baca {Math.floor(countdown/60)}:{String(countdown%60).padStart(2,'0')} lagi untuk dapat poin</span>
              : embed ? 'Klik untuk buka preview' : 'Klik untuk lihat opsi'}
          </div>
        </div>
        {/* Status pill */}
        <span style={{ fontSize:11, fontWeight:600, color:SC.color, display:'flex', alignItems:'center', gap:4, flexShrink:0 }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:SC.dot, display:'inline-block' }}/>
          {SC.label}
        </span>
        {/* Right indicator: done ✓, countdown ring, or empty circle */}
        {isCompleted ? (
          <div style={{ width:28, height:28, borderRadius:'50%', background:'#16a34a', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, color:'#fff', flexShrink:0, boxShadow:'0 2px 6px #16a34a50' }}>✓</div>
        ) : open && countdown > 0 ? (
          <CountdownRing seconds={countdown}/>
        ) : open && countdown === 0 ? (
          <div style={{ width:28, height:28, borderRadius:'50%', border:'2px solid #16a34a', background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, color:'#16a34a', flexShrink:0, animation:'pulse-ring 1.5s infinite' }}>✓</div>
        ) : (
          <div style={{ width:28, height:28, borderRadius:'50%', border:'2px solid var(--gray-200)', flexShrink:0 }}/>
        )}
        <span style={{ color:'var(--gray-400)', fontSize:11, transform: open ? 'rotate(180deg)' : 'none', transition:'transform .2s', flexShrink:0 }}>▾</span>
      </div>

      {/* ── Expanded content ── */}
      {open && (
        <div style={{ borderTop:'1px solid var(--gray-100)' }}>
          {embed ? (
            <>
              <div style={{ position:'relative', width:'100%', aspectRatio: attach.mime==='video/youtube' ? '16/9' : '4/3', background:'#111' }}>
                <iframe src={embed} title={attach.label || t.label}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  style={{ width:'100%', height:'100%', border:'none', display:'block' }}/>
              </div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:'#f9fafb', borderTop:'1px solid var(--gray-100)' }}>
                <a href={attach.url} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize:12, color:'var(--gray-400)', display:'flex', alignItems:'center', gap:4, textDecoration:'none' }}>
                  <ExternalLink size={12}/> Buka di tab baru
                </a>
                <SelesaiBtn/>
              </div>
            </>
          ) : attach.mime === 'video/youtube' && ytId ? (
            <div style={{ padding:16 }}>
              <a href={attach.url} target="_blank" rel="noopener noreferrer"
                onClick={() => { if (!prog.opened) { saveProg(userId, key, { opened:true, openedAt:Date.now() }); rerender(); onUpdate?.() } }}
                style={{ display:'block', position:'relative', borderRadius:12, overflow:'hidden', aspectRatio:'16/9', background:'#000', textDecoration:'none' }}>
                <img src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', opacity:.85 }}/>
                <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8 }}>
                  <div style={{ width:56, height:56, borderRadius:'50%', background:'#ff0000', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 16px rgba(0,0,0,.5)' }}>
                    <span style={{ fontSize:24, marginLeft:4 }}>▶</span>
                  </div>
                  <span style={{ color:'#fff', fontSize:12, fontWeight:700, background:'rgba(0,0,0,.5)', padding:'4px 12px', borderRadius:20 }}>Buka di YouTube</span>
                </div>
              </a>
              <div style={{ display:'flex', justifyContent:'flex-end', marginTop:10 }}><SelesaiBtn/></div>
            </div>
          ) : (
            <div style={{ padding:'20px 16px', background:'#f9fafb' }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:14 }}>
                <div style={{ width:44, height:44, borderRadius:10, background:t.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 }}>{t.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:13, color:'var(--gray-800)', marginBottom:4 }}>{attach.label || t.label}</div>
                  <div style={{ fontSize:12, color:'var(--gray-500)', marginBottom:12 }}>
                    Buka konten di tab baru, pelajari minimal 3 menit, lalu kembali dan klik "Selesai Dipelajari" untuk mendapat poin.
                  </div>
                  <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
                    <a href={attach.url} target="_blank" rel="noopener noreferrer"
                      onClick={() => { if (!prog.opened) { saveProg(userId, key, { opened:true, openedAt:Date.now() }); rerender(); onUpdate?.() } }}
                      style={{ padding:'8px 18px', borderRadius:20, background:t.color, color:'#fff', fontSize:13, fontWeight:700, textDecoration:'none', display:'flex', alignItems:'center', gap:6, boxShadow:`0 2px 8px ${t.color}40` }}>
                      {t.icon} Buka Konten
                    </a>
                    <SelesaiBtn/>
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
const STORAGE_VER = 'v2_countdown'
function MateriTab({ courseId, userId }) {
  const [items,         setItems]         = useState([])
  const [completedRefs, setCompletedRefs] = useState(new Set()) // 'mat_{id}_{idx}'
  const [loading,       setLoading]       = useState(true)
  const [, tick]  = useState(0)
  const rerender  = () => tick(n => n + 1)

  useEffect(() => {
    // Reset localStorage lama (versi sebelumnya)
    if (localStorage.getItem('edusys_mat_ver') !== STORAGE_VER) {
      Object.keys(localStorage).filter(k => k.startsWith('edusys_mp_') || k.startsWith('edusys_tmr_')).forEach(k => localStorage.removeItem(k))
      localStorage.setItem('edusys_mat_ver', STORAGE_VER)
    }
    // Load completedRefs dari localStorage (persisten)
    setCompletedRefs(getDoneSet(userId))
    // Load materials saja dari DB
    supabase.from('materials').select('*').eq('course_id', courseId)
      .order('week_number').order('created_at')
      .then(({ data: mats }) => {
        setItems(mats || [])
        setLoading(false)
      })
  }, [courseId])

  // Called when mahasiswa klik "Selesai Dipelajari" pada suatu lampiran
  async function handleMarkDone(materialId, attachIdx) {
    const refId = `mat_${materialId}_${attachIdx}`
    if (completedRefs.has(refId)) return  // sudah selesai

    // 1. Simpan ke localStorage dulu (langsung update UI)
    saveDone(userId, refId)
    setCompletedRefs(getDoneSet(userId))
    toast.success('+3 pts ⭐ Lampiran berhasil dipelajari!', { duration: 2500 })

    // 2. Insert ke DB (background) — reference_id = materialId (UUID valid)
    const { data: sem } = await supabase.from('semesters').select('id').eq('is_active', true).maybeSingle()
    const { error } = await supabase.from('points_log').insert({
      user_id:      userId,
      course_id:    courseId,
      semester_id:  sem?.id || null,
      points:       3,
      source:       'materi',
      reason:       `Selesai lampiran ${attachIdx + 1} materi ${materialId}`,
      reference_id: materialId,   // UUID valid — bukan string 'mat_xxx_0'
    })
    if (error) {
      console.error('points_log insert error:', error)
      // Poin tetap tercatat di localStorage meski DB gagal
    } else {
      // Upsert material_views agar fitur cetak & analitik berfungsi
      supabase.from('material_views').upsert(
        { material_id: materialId, student_id: userId, semester_id: sem?.id || null, points_awarded: true },
        { onConflict: 'material_id,student_id' }
      )
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
            const links     = (m.attachments?.length) ? m.attachments : m.webview_link ? [{ mime:m.mime_type, url:m.webview_link, label:'' }] : []
            const doneSet   = getDoneSet(userId)   // baca langsung dari localStorage
            const doneCount = links.filter((_,i) => doneSet.has(`mat_${m.id}_${i}`)).length
            const prog      = getProg(userId)
            const openCount = links.filter((_,i) => prog[pkey(m.id,i)]?.opened).length
            const pct       = links.length > 0 ? Math.round(doneCount / links.length * 100) : 0
            const ptsEarned = doneCount * 3

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
                        {ptsEarned > 0 && (
                          <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:99, background:'#fef9c3', color:'#92400e', border:'1px solid #fde68a', display:'flex', alignItems:'center', gap:3, whiteSpace:'nowrap' }}>
                            <Star size={9} color="#f59e0b" fill="#f59e0b"/> +{ptsEarned} pts
                          </span>
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
                        isCompleted={completedRefs.has(`mat_${m.id}_${ai}`)}
                        onMarkDone={(idx) => handleMarkDone(m.id, idx)}
                        onUpdate={rerender}
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
