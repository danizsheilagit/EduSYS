import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Megaphone, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { queryCache } from '@/lib/queryCache'
import { useAuth } from '@/contexts/AuthContext'


const GRADIENTS = [
  'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
  'linear-gradient(135deg, #0891b2 0%, #4f46e5 100%)',
  'linear-gradient(135deg, #059669 0%, #0891b2 100%)',
  'linear-gradient(135deg, #dc2626 0%, #7c3aed 100%)',
  'linear-gradient(135deg, #d97706 0%, #dc2626 100%)',
]

export default function AnnouncementCarousel({ showManage = false, managePath = '/pengumuman' }) {
  const { user, role } = useAuth()
  const navigate        = useNavigate()
  const [slides,  setSlides]  = useState([])
  const [current, setCurrent] = useState(0)
  const [loading, setLoading] = useState(true)
  const [paused,  setPaused]  = useState(false)
  const [animDir, setAnimDir] = useState('right') // 'left' | 'right'
  const [visible, setVisible] = useState(true)
  const timerRef = useRef(null)

  useEffect(() => { if (user) fetchAnnouncements() }, [user])

  async function fetchAnnouncements() {
    const data = await queryCache.get(
      'announcements',
      () => supabase
        .from('announcements')
        .select('*, author:profiles(full_name), course:courses(name,code)')
        .eq('is_active', true)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(10),
      5 * 60 * 1000  // cache 5 menit
    )
    setSlides(data || [])
    setLoading(false)
  }

  const goTo = useCallback((idx, dir = 'right') => {
    setAnimDir(dir)
    setCurrent(idx)
  }, [])

  const next = useCallback(() => {
    if (!slides.length) return
    goTo((current + 1) % slides.length, 'right')
  }, [current, slides.length, goTo])

  const prev = useCallback(() => {
    if (!slides.length) return
    goTo((current - 1 + slides.length) % slides.length, 'left')
  }, [current, slides.length, goTo])

  // Auto-play
  useEffect(() => {
    if (paused || slides.length <= 1) return
    timerRef.current = setInterval(next, 5000)
    return () => clearInterval(timerRef.current)
  }, [paused, slides.length, next])


  if (loading || !slides.length) return null

  const slide    = slides[current]
  const gradient = GRADIENTS[current % GRADIENTS.length]
  const hasImage = Boolean(slide.image_url)

  return (
    <div style={{ marginBottom: 24 }}>
      <div
        style={{
          position:'relative', borderRadius:14, overflow:'hidden',
          boxShadow:'0 4px 20px rgba(79,70,229,.18)',
          minHeight: hasImage ? 220 : 140,
          background: hasImage ? 'var(--gray-900)' : gradient,
          transition: 'background .4s ease',
        }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* Background image */}
        {hasImage && (
          <>
            <img
              src={slide.image_url}
              alt={slide.title}
              style={{
                position:'absolute', inset:0, width:'100%', height:'100%',
                objectFit:'cover', opacity:.55,
                transition:'opacity .4s',
              }}
            />
            {/* Dark gradient overlay for text legibility */}
            <div style={{
              position:'absolute', inset:0,
              background:'linear-gradient(90deg, rgba(0,0,0,.75) 0%, rgba(0,0,0,.25) 60%, transparent 100%)',
            }}/>
          </>
        )}

        {/* Content */}
        <div style={{
          position:'relative', zIndex:1,
          padding: '24px 28px',
          display:'flex', alignItems:'center', gap:20,
          animation: `slideIn${animDir === 'right' ? 'Right' : 'Left'} .35s ease`,
        }}>
          {/* Icon / megaphone */}
          <div style={{
            width:48, height:48, borderRadius:12, flexShrink:0,
            background:'rgba(255,255,255,.15)',
            backdropFilter:'blur(6px)',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <Megaphone size={22} color="#fff"/>
          </div>

          <div style={{ flex:1, minWidth:0 }}>
            {/* Badge */}
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
              <span style={{
                fontSize:10, fontWeight:700, letterSpacing:.6,
                padding:'2px 9px', borderRadius:99,
                background: slide.type==='global' ? 'rgba(255,255,255,.25)' : 'rgba(245,158,11,.35)',
                color:'#fff',
                backdropFilter:'blur(4px)',
                border: '1px solid rgba(255,255,255,.2)',
              }}>
                {slide.type==='global' ? '🌐 GLOBAL' : `📘 ${slide.course?.code || 'MK'}`}
              </span>
              {slide.expires_at && (
                <span style={{ fontSize:10, color:'rgba(255,255,255,.6)' }}>
                  s/d {new Date(slide.expires_at).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}
                </span>
              )}
            </div>

            {/* Title */}
            <div style={{
              fontWeight:800, fontSize:18, color:'#fff', lineHeight:1.2,
              marginBottom:6, textShadow:'0 1px 4px rgba(0,0,0,.3)',
            }}>
              {slide.title}
            </div>

            {/* Content */}
            <div style={{
              fontSize:13, color:'rgba(255,255,255,.85)', lineHeight:1.5,
              display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden',
            }}>
              {slide.content}
            </div>

            {/* Author */}
            <div style={{ fontSize:11, color:'rgba(255,255,255,.55)', marginTop:8 }}>
              Oleh {slide.author?.full_name} · {new Date(slide.created_at).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}
            </div>
          </div>
        </div>

        {/* Prev / Next */}
        {slides.length > 1 && (
          <>
            <button onClick={prev}
              style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', zIndex:2,
                width:32, height:32, borderRadius:'50%', border:'none', cursor:'pointer',
                background:'rgba(255,255,255,.15)', backdropFilter:'blur(4px)',
                display:'flex', alignItems:'center', justifyContent:'center',
                color:'#fff', transition:'background .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.3)'}
              onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,.15)'}>
              <ChevronLeft size={16}/>
            </button>
            <button onClick={next}
              style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', zIndex:2,
                width:32, height:32, borderRadius:'50%', border:'none', cursor:'pointer',
                background:'rgba(255,255,255,.15)', backdropFilter:'blur(4px)',
                display:'flex', alignItems:'center', justifyContent:'center',
                color:'#fff', transition:'background .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.3)'}
              onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,.15)'}>
              <ChevronRight size={16}/>
            </button>
          </>
        )}


        {/* Manage button (dosen/admin) */}
        {showManage && (role === 'dosen' || role === 'admin') && (
          <button onClick={() => navigate(managePath)}
            style={{ position:'absolute', top:10, right:42, zIndex:2,
              padding:'3px 10px', borderRadius:99, border:'1px solid rgba(255,255,255,.3)',
              background:'rgba(255,255,255,.12)', backdropFilter:'blur(4px)',
              fontSize:11, fontWeight:600, color:'rgba(255,255,255,.85)', cursor:'pointer',
              display:'flex', alignItems:'center', gap:4,
              transition:'background .15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.25)'}
            onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,.12)'}>
            <ExternalLink size={11}/> Kelola
          </button>
        )}

        {/* Dot indicators */}
        {slides.length > 1 && (
          <div style={{
            position:'absolute', bottom:10, left:'50%', transform:'translateX(-50%)',
            display:'flex', gap:5, zIndex:2,
          }}>
            {slides.map((_, i) => (
              <button key={i} onClick={() => goTo(i, i > current ? 'right' : 'left')}
                style={{
                  width: i === current ? 22 : 7,
                  height:7, borderRadius:99, border:'none', cursor:'pointer', padding:0,
                  background: i === current ? '#fff' : 'rgba(255,255,255,.4)',
                  transition:'all .3s ease',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes slideInRight {
          from { opacity:0; transform:translateX(24px); }
          to   { opacity:1; transform:translateX(0); }
        }
        @keyframes slideInLeft {
          from { opacity:0; transform:translateX(-24px); }
          to   { opacity:1; transform:translateX(0); }
        }
      `}</style>
    </div>
  )
}
