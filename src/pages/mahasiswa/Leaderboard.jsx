import { useState, useEffect, useRef } from 'react'
import { Trophy, Star, Zap, TrendingUp, BookOpen } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

/* ── helpers ─────────────────────────────────────────────── */
const MEDAL = ['👑','🥇','🥈','🥉']
const RANK_GLOW = [
  '0 0 24px 6px rgba(251,191,36,.6)',   // #1 gold
  '0 0 18px 4px rgba(156,163,175,.5)',  // #2 silver
  '0 0 14px 4px rgba(180,83,9,.4)',     // #3 bronze
]
const BAR_COLORS = [
  'linear-gradient(180deg,#facc15,#f59e0b)',
  'linear-gradient(180deg,#e2e8f0,#94a3b8)',
  'linear-gradient(180deg,#fbbf24,#b45309)',
  'linear-gradient(180deg,#818cf8,#4f46e5)',
  'linear-gradient(180deg,#818cf8,#4f46e5)',
  'linear-gradient(180deg,#6366f1,#4338ca)',
  'linear-gradient(180deg,#6366f1,#4338ca)',
  'linear-gradient(180deg,#7c3aed,#5b21b6)',
  'linear-gradient(180deg,#7c3aed,#5b21b6)',
  'linear-gradient(180deg,#4c1d95,#3b0764)',
]

export default function Leaderboard() {
  const { user, profile } = useAuth()
  const [courses,    setCourses]    = useState([])
  const [courseId,   setCourseId]   = useState('')
  const [semester,   setSemester]   = useState(null)
  const [data,       setData]       = useState([])
  const [loading,    setLoading]    = useState(false)
  const [animated,   setAnimated]   = useState(false)
  const animRef = useRef(null)

  // Fetch enrolled courses
  useEffect(() => {
    supabase.from('enrollments')
      .select('course:courses(id,name,code)')
      .eq('student_id', user?.id)
      .then(({ data }) => {
        const list = (data || []).map(e => e.course).filter(Boolean)
        setCourses(list)
        if (list.length) setCourseId(list[0].id)
      })
    // Fetch active semester
    supabase.from('semesters').select('*').eq('is_active', true).single()
      .then(({ data }) => setSemester(data))
  }, [user])

  useEffect(() => { if (courseId && semester) fetchLeaderboard() }, [courseId, semester])

  async function fetchLeaderboard() {
    setLoading(true); setAnimated(false)
    const { data } = await supabase.from('course_leaderboard')
      .select('*')
      .eq('course_id', courseId)
      .eq('semester_id', semester?.id)
      .order('rank')
      .limit(50)
    setData(data || [])
    setLoading(false)
    // Trigger bar animation after render
    setTimeout(() => setAnimated(true), 80)
  }

  const top10 = data.slice(0, 10)
  const me    = data.find(d => d.user_id === user?.id)
  const maxPts = top10[0]?.total_points || 1

  return (
    <div style={{ minHeight:'100vh' }}>
      {/* ── Page header ───────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Trophy size={22} color="#f59e0b"/> Leaderboard
          </h1>
          <p className="page-subtitle">Peringkat per Mata Kuliah · {semester ? semester.name : 'Tidak ada semester aktif'}</p>
        </div>

        {/* Course selector */}
        <select className="input" style={{ maxWidth:300 }} value={courseId} onChange={e=>setCourseId(e.target.value)}>
          {courses.map(c => <option key={c.id} value={c.id}>{c.code} – {c.name}</option>)}
        </select>
      </div>

      {!semester && (
        <div style={{ marginBottom:16, padding:'12px 16px', background:'#fef3c7', borderRadius:10, fontSize:13, color:'#92400e', fontWeight:600 }}>
          ⚠ Belum ada semester aktif — leaderboard tidak tersedia
        </div>
      )}

      {loading && <div className="spinner" style={{ margin:'60px auto' }}/>}

      {!loading && semester && data.length === 0 && (
        <div className="empty-state card" style={{ padding:60 }}>
          <Trophy size={32} color="var(--gray-200)"/>
          <p className="empty-state-text">Belum ada poin di mata kuliah ini</p>
          <p className="empty-state-sub">Buka materi, kerjakan tugas, ikuti ujian, dan posting di forum untuk mendapatkan poin</p>
        </div>
      )}

      {!loading && top10.length > 0 && (
        <>
          {/* ── Esport Bar Chart ─────────────────────────── */}
          <div style={{
            background:'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
            borderRadius:18, padding:'32px 24px 0', marginBottom:24,
            boxShadow:'0 8px 40px rgba(79,70,229,.35)',
            overflow:'hidden', position:'relative',
          }}>
            {/* Glow orbs background */}
            <div style={{ position:'absolute', top:-80, left:'20%', width:300, height:300, borderRadius:'50%', background:'rgba(99,102,241,.15)', filter:'blur(60px)', pointerEvents:'none' }}/>
            <div style={{ position:'absolute', top:-40, right:'10%', width:200, height:200, borderRadius:'50%', background:'rgba(167,139,250,.1)', filter:'blur(50px)', pointerEvents:'none' }}/>

            <div style={{ position:'relative', zIndex:1 }}>
              {/* Section title */}
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:28 }}>
                <Zap size={16} color="#facc15"/>
                <span style={{ fontSize:13, fontWeight:800, color:'rgba(255,255,255,.8)', letterSpacing:1, textTransform:'uppercase' }}>
                  Top {top10.length} Student
                </span>
                <div style={{ flex:1, height:1, background:'rgba(255,255,255,.1)' }}/>
              </div>

              {/* Bar chart */}
              <div style={{ display:'flex', alignItems:'flex-end', gap:10, justifyContent:'center', minHeight:260 }}>
                {top10.map((d, i) => {
                  const isMe     = d.user_id === user?.id
                  const barH     = Math.max(30, Math.round((d.total_points / maxPts) * 220))
                  const medal    = MEDAL[i] || `#${d.rank}`
                  const glow     = RANK_GLOW[i] || ''
                  const barColor = BAR_COLORS[i] || BAR_COLORS[9]
                  const initials = d.full_name?.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() || '?'

                  return (
                    <div key={d.user_id} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:0, flex:1, maxWidth:88, position:'relative' }}>
                      {/* Crown for #1 */}
                      {i === 0 && (
                        <div style={{ fontSize:22, animation:'bounce 1.2s ease-in-out infinite', position:'absolute', top:-36, zIndex:3 }}>👑</div>
                      )}

                      {/* Avatar */}
                      <div style={{
                        width:40, height:40, borderRadius:'50%', overflow:'hidden',
                        border: isMe ? '2px solid #a5f3fc' : i < 3 ? `2px solid rgba(250,204,21,.7)` : '2px solid rgba(255,255,255,.2)',
                        background:'#1e1b4b', flexShrink:0, zIndex:2,
                        boxShadow: isMe ? '0 0 12px rgba(165,243,252,.5)' : glow,
                        marginBottom: 6,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:14, fontWeight:800, color:'#fff',
                      }}>
                        {d.avatar_url
                          ? <img src={d.avatar_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                          : initials}
                      </div>

                      {/* Points label */}
                      <div style={{ fontSize:11, fontWeight:800, color:'#facc15', marginBottom:4, textShadow:'0 0 8px rgba(250,204,21,.5)' }}>
                        {d.total_points}
                        <span style={{ fontSize:9, color:'rgba(255,255,255,.5)', marginLeft:2 }}>pts</span>
                      </div>

                      {/* Bar */}
                      <div style={{
                        width:'100%', borderRadius:'6px 6px 0 0',
                        height: animated ? barH : 0,
                        background: isMe ? 'linear-gradient(180deg,#a5f3fc,#06b6d4)' : barColor,
                        boxShadow: isMe ? '0 0 16px rgba(6,182,212,.5)' : (glow || 'none'),
                        transition:`height .6s cubic-bezier(.34,1.56,.64,1) ${i * 60}ms`,
                        position:'relative', minHeight:4,
                      }}>
                        {/* Rank badge inside bar */}
                        <div style={{ position:'absolute', top:6, left:'50%', transform:'translateX(-50%)', fontSize:13, textAlign:'center' }}>
                          {i < 3 ? medal : `#${d.rank}`}
                        </div>
                      </div>

                      {/* Name below bar */}
                      <div style={{
                        fontSize:10, fontWeight:700, color: isMe ? '#a5f3fc' : 'rgba(255,255,255,.75)',
                        marginTop:6, textAlign:'center', width:'100%',
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                        paddingBottom: 16,
                      }}>
                        {d.full_name?.split(' ')[0]}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── My Position ──────────────────────────────── */}
          {me && (
            <div style={{ marginBottom:20, padding:'14px 20px', background:'linear-gradient(135deg,#ede9fe,#eef2ff)', border:'2px solid #a5b4fc', borderRadius:12, display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ width:40, height:40, borderRadius:'50%', overflow:'hidden', border:'2px solid var(--indigo-400)', background:'var(--indigo-100)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:800, color:'var(--indigo-700)', flexShrink:0 }}>
                {profile?.avatar_url ? <img src={profile.avatar_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : profile?.full_name?.[0]||'U'}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:800, fontSize:14, color:'var(--indigo-900)' }}>
                  Posisi Saya: #{me.rank}
                  {me.rank <= 3 && <span style={{ marginLeft:6 }}>{MEDAL[me.rank-1]}</span>}
                </div>
                <div style={{ fontSize:12, color:'var(--indigo-600)', marginTop:2 }}>
                  {me.total_points} poin total
                  <span style={{ marginLeft:10, color:'var(--gray-400)' }}>
                    📖{me.materi_pts} · 📤{me.tugas_pts} · 💬{me.forum_pts} · 📝{me.ujian_pts}
                  </span>
                </div>
              </div>
              <div style={{ flexShrink:0 }}>
                <TrendingUp size={20} color="var(--indigo-500)"/>
              </div>
            </div>
          )}

          {/* ── Full List ─────────────────────────────────── */}
          <div className="card">
            <div className="card-header">
              <span style={{ fontWeight:700, fontSize:13, display:'flex', alignItems:'center', gap:6 }}>
                <Star size={14} color="#f59e0b"/> Semua Peringkat
              </span>
              <span style={{ fontSize:11, color:'var(--gray-400)' }}>Semester: {semester?.name}</span>
            </div>
            <div>
              {data.map((d, i) => {
                const isMe   = d.user_id === user?.id
                const rankIcon = d.rank <= 3 ? MEDAL[d.rank-1] : `#${d.rank}`
                const pct    = Math.round((d.total_points / maxPts) * 100)
                const initials = d.full_name?.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() || '?'
                return (
                  <div key={d.user_id} style={{
                    display:'flex', alignItems:'center', gap:12, padding:'12px 20px',
                    borderBottom: i < data.length-1 ? '1px solid var(--gray-100)' : 'none',
                    background: isMe ? '#f5f3ff' : 'transparent',
                    transition:'background .15s',
                  }}
                    onMouseEnter={e=>{ if(!isMe) e.currentTarget.style.background='var(--gray-50)' }}
                    onMouseLeave={e=>{ e.currentTarget.style.background = isMe?'#f5f3ff':'transparent' }}
                  >
                    {/* Rank */}
                    <div style={{ width:32, textAlign:'center', fontSize:d.rank<=3?18:13, flexShrink:0, fontWeight:800, color:d.rank===1?'#f59e0b':d.rank===2?'#94a3b8':d.rank===3?'#b45309':'var(--gray-500)' }}>
                      {rankIcon}
                    </div>

                    {/* Avatar */}
                    <div style={{ width:36, height:36, borderRadius:'50%', overflow:'hidden', border: isMe?'2px solid var(--indigo-400)':'2px solid var(--gray-200)', background:'var(--gray-100)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'var(--gray-600)', flexShrink:0 }}>
                      {d.avatar_url ? <img src={d.avatar_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : initials}
                    </div>

                    {/* Info */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:13, color: isMe?'var(--indigo-700)':'var(--gray-800)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {d.full_name}
                        {isMe && <span style={{ fontSize:10, color:'var(--indigo-500)', marginLeft:6, fontWeight:700 }}>(Anda)</span>}
                      </div>
                      <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:1 }}>{d.nim}</div>
                      {/* Mini bar */}
                      <div style={{ height:3, background:'var(--gray-100)', borderRadius:99, marginTop:5, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${pct}%`, background: isMe?'var(--indigo-500)':'#818cf8', borderRadius:99, transition:'width .5s ease' }}/>
                      </div>
                    </div>

                    {/* Points breakdown */}
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontWeight:800, fontSize:16, color: isMe?'var(--indigo-700)':'var(--gray-800)' }}>{d.total_points}</div>
                      <div style={{ fontSize:10, color:'var(--gray-400)' }}>poin</div>
                      <div style={{ fontSize:9, color:'var(--gray-300)', marginTop:2 }}>
                        📖{d.materi_pts} 📤{d.tugas_pts} 💬{d.forum_pts} 📝{d.ujian_pts}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* CSS */}
      <style>{`
        @keyframes bounce {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  )
}
