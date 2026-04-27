import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Send, Loader2, MessageSquare, Coins } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function ForumDetail() {
  const { id } = useParams()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [forum,   setForum]   = useState(null)
  const [replies, setReplies] = useState([])
  const [body,    setBody]    = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [id])

  async function fetchData() {
    const [{ data: f }, { data: r }] = await Promise.all([
      supabase.from('forums').select('*, author:profiles(full_name, avatar_url), course:courses(name,code)').eq('id', id).single(),
      supabase.from('forum_replies').select('*, author:profiles(full_name, avatar_url)').eq('forum_id', id).order('created_at'),
    ])
    setForum(f); setReplies(r||[]); setLoading(false)
  }

  async function sendReply() {
    if (!body.trim()) return
    setSending(true)
    const { data: inserted, error } = await supabase
      .from('forum_replies')
      .insert({ forum_id: id, author_id: user.id, body: body.trim() })
      .select('id')
      .single()
    if (error) { toast.error('Gagal mengirim balasan'); setSending(false); return }

    // Award +3 poin untuk mahasiswa yang membalas forum
    if (forum?.course_id) {
      const { data: semData } = await supabase
        .from('semesters').select('id').eq('is_active', true).single()
      if (semData) {
        // Cek apakah sudah pernah dapat poin dari reply ini (idempotent)
        await supabase.from('points_log').insert({
          user_id:     user.id,
          course_id:   forum.course_id,
          semester_id: semData.id,
          points:      3,
          source:      'forum',
          reason:      'Balas forum: ' + id,
          reference_id: inserted?.id,
        })
        toast.success('Balasan terkirim! +3 pts 💬', { icon: '💬' })
      } else {
        toast.success('Balasan terkirim')
      }
    } else {
      toast.success('Balasan terkirim')
    }

    setBody(''); fetchData(); setSending(false)
  }

  if (loading) return <div style={{ display:'flex', justifyContent:'center', paddingTop:60 }}><div className="spinner"/></div>
  if (!forum)  return <div className="empty-state"><p>Thread tidak ditemukan.</p></div>

  return (
    <div style={{ maxWidth:720, margin:'0 auto' }}>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginBottom:16 }}>
        <ArrowLeft size={14}/> Kembali
      </button>

      {/* Original post */}
      <div className="card" style={{ marginBottom:16 }}>
        <div className="card-body">
          <div style={{ fontSize:11, color:'var(--gray-400)', marginBottom:8 }}>
            {forum.course?.code} · {forum.course?.name}
            {forum.is_pinned && <span style={{ marginLeft:8, color:'var(--indigo-600)', fontWeight:600 }}>📌 Pinned</span>}
          </div>
          <h1 style={{ fontSize:18, fontWeight:800, marginBottom:12 }}>{forum.title}</h1>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
            <div className="avatar" style={{ width:32, height:32 }}>
              {forum.author?.avatar_url ? <img src={forum.author.avatar_url} alt=""/> : forum.author?.full_name?.[0]||'U'}
            </div>
            <div>
              <div style={{ fontSize:12, fontWeight:600 }}>{forum.author?.full_name}</div>
              <div style={{ fontSize:11, color:'var(--gray-400)' }}>{new Date(forum.created_at).toLocaleString('id-ID')}</div>
            </div>
          </div>
          {forum.body && <p style={{ fontSize:13, color:'var(--gray-700)', lineHeight:1.7 }}>{forum.body}</p>}
        </div>
      </div>

      {/* Replies */}
      <div style={{ fontSize:12, fontWeight:700, color:'var(--gray-500)', marginBottom:10 }}>
        {replies.length} Balasan
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
        {replies.map(r => (
          <div key={r.id} className="card" style={{ padding:'12px 16px' }}>
            <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
              <div className="avatar" style={{ width:28, height:28, fontSize:11, flexShrink:0 }}>
                {r.author?.avatar_url ? <img src={r.author.avatar_url} alt=""/> : r.author?.full_name?.[0]||'U'}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                  <span style={{ fontSize:12, fontWeight:600 }}>{r.author?.full_name}</span>
                  <span style={{ fontSize:11, color:'var(--gray-400)' }}>{new Date(r.created_at).toLocaleString('id-ID')}</span>
                </div>
                <p style={{ fontSize:13, color:'var(--gray-700)', lineHeight:1.6 }}>{r.body}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Reply form */}
      <div className="card">
        <div className="card-body" style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
          <div className="avatar" style={{ width:32, height:32, flexShrink:0 }}>
            {profile?.avatar_url ? <img src={profile.avatar_url} alt=""/> : profile?.full_name?.[0]||'U'}
          </div>
          <div style={{ flex:1 }}>
            <textarea
              className="input"
              placeholder="Tulis balasan…"
              rows={3}
              value={body}
              onChange={e => setBody(e.target.value)}
              style={{ resize:'vertical', fontFamily:'inherit' }}
            />
            <div style={{ display:'flex', justifyContent:'flex-end', marginTop:8 }}>
              <button className="btn btn-primary btn-sm" onClick={sendReply} disabled={sending || !body.trim()}>
                {sending ? <Loader2 size={13} style={{ animation:'spin .7s linear infinite' }}/> : <Send size={13}/>}
                Kirim
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
