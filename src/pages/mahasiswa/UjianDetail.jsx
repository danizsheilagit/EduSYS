import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, AlertTriangle, ChevronRight, CheckCircle2, RotateCcw, Trophy } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const MODE_LABEL = { ujian:'Ujian', tryout:'Try Out', quiz:'Quiz' }
const MODE_COLOR = { ujian:'var(--indigo-600)', tryout:'#0891b2', quiz:'#7c3aed' }

export default function UjianDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate  = useNavigate()
  const [exam,       setExam]       = useState(null)
  const [allAttempts,setAllAttempts] = useState([])   // all past attempts
  const [myAnswer,   setMyAnswer]   = useState(null)  // current/latest attempt
  const [answers,    setAnswers]    = useState({})
  const [flagged,    setFlagged]    = useState(new Set())  // ragu-ragu IDs
  const [currentQ,   setCurrentQ]   = useState(0)          // active question index
  const [timeLeft,   setTimeLeft]   = useState(null)
  const [phase,      setPhase]      = useState('loading')
  const timerRef = useRef(null)

  useEffect(() => { fetchExam() }, [id])

  async function fetchExam() {
    const [{ data: e }, { data: aList }] = await Promise.all([
      supabase.from('exams').select('*, course:courses(name,code)').eq('id', id).single(),
      supabase.from('exam_answers')
        .select('*').eq('exam_id', id).eq('student_id', user.id)
        .order('attempt_number', { ascending: true }),
    ])
    setExam(e)
    const attempts = aList || []
    setAllAttempts(attempts)
    const latest = attempts[attempts.length - 1] || null
    setMyAnswer(latest)
    if (!latest)                    { setPhase('preview') }
    else if (latest.submitted_at)   { setPhase('submitted'); setAnswers(latest.answers || {}) }
    else                            { setPhase('active'); setAnswers(latest.answers || {}); startTimer(e, latest.started_at) }
  }

  function startTimer(examData, startedAt) {
    if (!examData?.duration_minutes) return
    const endTime = new Date(startedAt).getTime() + examData.duration_minutes * 60000
    function tick() {
      const left = Math.max(0, Math.ceil((endTime - Date.now()) / 1000))
      setTimeLeft(left)
      if (left <= 0) { clearInterval(timerRef.current); handleSubmit(true) }
    }
    tick()
    timerRef.current = setInterval(tick, 1000)
  }
  useEffect(() => () => clearInterval(timerRef.current), [])

  function shuffle(arr) {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  async function buildQuestionsFromBank(exam) {
    const cfg = exam.question_config
    const topicConfigs = Array.isArray(cfg)
      ? cfg
      : [{ topic: null, mudah: cfg?.mudah||0, sedang: cfg?.sedang||0, sulit: cfg?.sulit||0 }]
    const allPicked = []
    const shortages = []   // track kekurangan soal

    for (const tc of topicConfigs) {
      const diffs = ['mudah','sedang','sulit'].filter(d => (tc[d]||0) > 0)
      if (!diffs.length) continue
      let query = supabase.from('questions')
        .select('id,question_text,options,correct_answer,difficulty,explanation')
        .eq('course_id', exam.course_id).in('difficulty', diffs)
      if (tc.topic) query = query.eq('category', tc.topic)
      const { data: qPool } = await query
      const byDiff = { mudah:[], sedang:[], sulit:[] }
      ;(qPool || []).forEach(q => byDiff[q.difficulty]?.push(q))
      for (const d of ['mudah','sedang','sulit']) {
        const need = tc[d] || 0; if (!need) continue
        const available = byDiff[d].length
        if (available < need) {
          shortages.push(`"${tc.topic||'Umum'}" ${d}: butuh ${need}, tersedia ${available}`)
        }
        shuffle(byDiff[d]).slice(0, need).forEach(q => {
          const idxMap = q.options.map((_, i) => i)
          const shuffledIdx = shuffle(idxMap)
          allPicked.push({
            id: q.id, type: 'multiple_choice', text: q.question_text,
            options: shuffledIdx.map(i => q.options[i]),
            answer: String.fromCharCode(65 + shuffledIdx.indexOf(q.correct_answer)),
            difficulty: q.difficulty, topic: tc.topic || null,
            explanation: q.explanation || null,
          })
        })
      }
    }
    if (shortages.length) {
      toast(`⚠️ Soal kurang di bank: ${shortages.join(' | ')}. Menampilkan ${allPicked.length} soal yang tersedia.`, { duration: 6000 })
    }
    return shuffle(allPicked)
  }

  async function handleStart() {
    const mode = exam.exam_mode || 'ujian'
    const maxAtt = exam.max_attempts || 1
    const doneCount = allAttempts.filter(a => a.submitted_at).length

    // Guard for tryout
    if (mode === 'tryout' && doneCount >= maxAtt) {
      toast.error(`Batas percobaan (${maxAtt}×) sudah tercapai`); return
    }

    let snapshot = []
    if (exam.use_question_bank) {
      snapshot = await buildQuestionsFromBank(exam)
      if (!snapshot.length) { toast.error('Bank soal kosong atau tidak cukup soal'); return }
    }

    const nextAttempt = allAttempts.length + 1
    const { data, error } = await supabase.from('exam_answers').insert({
      exam_id: id, student_id: user.id, answers: {},
      started_at: new Date().toISOString(),
      questions_snapshot: snapshot,
      attempt_number: nextAttempt,
    }).select().single()
    if (error) { toast.error('Gagal memulai: ' + error.message); return }
    setMyAnswer(data)
    setAllAttempts(prev => [...prev, data])
    setAnswers({})
    setPhase('active')
    startTimer(exam, data.started_at)
  }

  const handleSubmit = useCallback(async (auto = false) => {
    if (phase !== 'active') return
    clearInterval(timerRef.current)
    const now = new Date().toISOString()
    const qs = (myAnswer?.questions_snapshot?.length ? myAnswer.questions_snapshot : exam?.questions) || []
    let score = 0, total = 0
    qs.forEach(q => {
      if (q.type === 'multiple_choice') { total++; if (answers[q.id] === q.answer) score += q.points || 1 }
    })
    const finalScore = myAnswer?.questions_snapshot?.length && total > 0
      ? Math.round((score / total) * 100) : score
    const { error } = await supabase.from('exam_answers')
      .update({ answers, score: finalScore, submitted_at: now })
      .eq('id', myAnswer.id)
    if (error) { toast.error('Gagal mengumpulkan ujian'); return }
    const updated = { ...myAnswer, answers, score: finalScore, submitted_at: now }
    setMyAnswer(updated)
    setAllAttempts(prev => prev.map(a => a.id === myAnswer.id ? updated : a))
    setPhase('submitted')
    if (!auto) toast.success('Berhasil dikumpulkan! 🎉')
    else       toast('Waktu habis — dikumpulkan otomatis', { icon: '⏰' })
  }, [phase, exam, myAnswer, answers, id])

  function formatTime(s) {
    if (s === null) return '--:--'
    const m = Math.floor(s / 60), sec = s % 60
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  }

  function scoreColor(s) { return s >= 80 ? '#16a34a' : s >= 60 ? '#ca8a04' : '#dc2626' }

  if (phase === 'loading') return <div style={{ display:'flex', justifyContent:'center', paddingTop:60 }}><div className="spinner"/></div>
  if (!exam) return <div className="empty-state"><p>Ujian tidak ditemukan.</p></div>

  const mode       = exam.exam_mode || 'ujian'
  const maxAtt     = exam.max_attempts || 1
  const submitted  = allAttempts.filter(a => a.submitted_at)
  const doneCount  = submitted.length
  const questions  = (myAnswer?.questions_snapshot?.length ? myAnswer.questions_snapshot : exam.questions) || []
  const answered   = Object.keys(answers).length
  const typeLabel  = { uts:'UTS', uas:'UAS', kuis:'Kuis' }
  const canRetry   = mode === 'quiz' || (mode === 'tryout' && doneCount < maxAtt)

  /* ── Submitted view ─────────────────────────────────── */
  if (phase === 'submitted') {
    const isBank     = myAnswer?.questions_snapshot?.length > 0
    const qs         = isBank ? myAnswer.questions_snapshot : (exam.questions || [])
    const mcTotal    = qs.filter(q => q.type === 'multiple_choice').length
    const mcCorrect  = qs.filter(q => q.type === 'multiple_choice' && (myAnswer?.answers||{})[q.id] === q.answer).length
    const finalScore = myAnswer?.score ?? null
    const bestScore  = submitted.length ? Math.max(...submitted.map(a => a.score ?? 0)) : null

    return (
      <div style={{ maxWidth:580, margin:'0 auto' }}>
        <div className="card" style={{ padding:'40px 32px' }}>
          {/* Icon */}
          <div style={{ textAlign:'center', marginBottom:24 }}>
            <div style={{ width:68, height:68, borderRadius:'50%', background:'linear-gradient(135deg,#d1fae5,#a7f3d0)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
              <CheckCircle2 size={34} color="#10b981"/>
            </div>
            <h1 style={{ fontSize:20, fontWeight:800, marginBottom:4 }}>
              {mode === 'ujian' ? 'Ujian Dikumpulkan!' : mode === 'tryout' ? `Percobaan ${doneCount} Selesai!` : 'Quiz Selesai!'}
            </h1>
            <p style={{ color:'var(--gray-500)', fontSize:13 }}>{exam.title}</p>
          </div>

          {/* Score for bank soal */}
          {isBank && finalScore !== null && (
            <div style={{ textAlign:'center', background:'linear-gradient(135deg,#eef2ff,#f0fdf4)', border:'1px solid #c7d2fe', borderRadius:12, padding:'18px', marginBottom:20 }}>
              <div style={{ fontSize:40, fontWeight:900, color: scoreColor(finalScore), lineHeight:1 }}>{finalScore}</div>
              <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:4 }}>dari 100 poin</div>
              <div style={{ fontSize:13, color:'var(--gray-600)', marginTop:6 }}>{mcCorrect} / {mcTotal} soal benar</div>
            </div>
          )}

          {/* Ujian mode: waiting for assessment */}
          {mode === 'ujian' && (
            <div style={{ display:'flex', justifyContent:'center', marginBottom:20 }}>
              <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:20, padding:'8px 18px' }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:'#f97316', animation:'pulse 1.5s infinite' }}/>
                <span style={{ fontSize:13, fontWeight:700, color:'#ea580c' }}>Menunggu Penilaian Dosen</span>
              </div>
            </div>
          )}

          {/* Attempt history for tryout/quiz */}
          {(mode === 'tryout' || mode === 'quiz') && submitted.length > 0 && (
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--gray-500)', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                <Trophy size={13} color="#f59e0b"/> Riwayat Percobaan
                {bestScore !== null && <span style={{ marginLeft:'auto', color:'var(--indigo-600)', fontWeight:800 }}>Terbaik: {bestScore}</span>}
              </div>
              <div style={{ border:'1px solid var(--gray-200)', borderRadius:10, overflow:'hidden' }}>
                {submitted.map((a, i) => {
                  const isBest = a.score === bestScore
                  const isCurrent = a.id === myAnswer?.id
                  return (
                    <div key={a.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'9px 14px', background: isCurrent ? '#f5f3ff' : '#fff', borderBottom: i < submitted.length-1 ? '1px solid var(--gray-100)' : 'none' }}>
                      <span style={{ fontSize:12, color:'var(--gray-400)', width:80, flexShrink:0 }}>
                        Percobaan {a.attempt_number ?? i+1}
                      </span>
                      <span style={{ fontSize:14, fontWeight:800, color: scoreColor(a.score ?? 0), flex:1 }}>
                        {a.score ?? '—'}
                      </span>
                      <span style={{ fontSize:11, color:'var(--gray-400)' }}>
                        {a.submitted_at ? new Date(a.submitted_at).toLocaleDateString('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : ''}
                      </span>
                      {isBest && <span style={{ fontSize:10, fontWeight:800, background:'#fef9c3', color:'#92400e', padding:'2px 8px', borderRadius:20 }}>Terbaik</span>}
                      {isCurrent && !isBest && <span style={{ fontSize:10, color:'var(--indigo-400)' }}>ini</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Try out progress */}
          {mode === 'tryout' && (
            <div style={{ fontSize:12, color:'var(--gray-400)', textAlign:'center', marginBottom:16 }}>
              {doneCount} / {maxAtt} percobaan terpakai
            </div>
          )}

          {/* Buttons */}
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {canRetry && (
              <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }}
                onClick={() => { setPhase('preview') }}>
                <RotateCcw size={14}/>
                {mode === 'quiz' ? 'Mulai Lagi' : `Coba Lagi (${maxAtt - doneCount} tersisa)`}
              </button>
            )}
            <button className="btn btn-secondary" style={{ width:'100%', justifyContent:'center' }} onClick={() => navigate(-1)}>
              <ArrowLeft size={14}/> Kembali ke Daftar Ujian
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ── Preview view ───────────────────────────────────── */
  if (phase === 'preview') {
    const totalSoal = exam.use_question_bank && exam.question_config
      ? (Array.isArray(exam.question_config)
          ? exam.question_config.reduce((s,r) => s+(r.mudah||0)+(r.sedang||0)+(r.sulit||0), 0)
          : (exam.question_config.mudah||0)+(exam.question_config.sedang||0)+(exam.question_config.sulit||0))
      : questions.length
    const blockedTryout = mode === 'tryout' && doneCount >= maxAtt
    return (
      <div style={{ maxWidth:560, margin:'0 auto' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginBottom:16 }}>
          <ArrowLeft size={14}/> Kembali
        </button>
        <div className="card">
          <div style={{ textAlign:'center', padding:'36px 32px' }}>
            <span style={{ fontSize:11, fontWeight:800, background: MODE_COLOR[mode]+'22', color: MODE_COLOR[mode], padding:'4px 14px', borderRadius:20, marginBottom:12, display:'inline-block' }}>
              {MODE_LABEL[mode]}
            </span>
            <span className="badge-pill badge-indigo" style={{ marginLeft:8 }}>{typeLabel[exam.type]||exam.type}</span>
            <h1 style={{ fontSize:20, fontWeight:800, margin:'12px 0 4px' }}>{exam.title}</h1>
            <p style={{ fontSize:12, color:'var(--gray-400)', marginBottom:24 }}>{exam.course?.code} · {exam.course?.name}</p>
            <div style={{ display:'flex', justifyContent:'center', gap:32, marginBottom:28, fontSize:13 }}>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:24, fontWeight:800, color:'var(--indigo-600)' }}>{totalSoal}</div>
                <div style={{ color:'var(--gray-400)' }}>Soal</div>
              </div>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:24, fontWeight:800, color:'var(--indigo-600)' }}>{exam.duration_minutes}</div>
                <div style={{ color:'var(--gray-400)' }}>Menit</div>
              </div>
              {mode !== 'ujian' && (
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:24, fontWeight:800, color: MODE_COLOR[mode] }}>
                    {mode === 'quiz' ? '∞' : `${doneCount}/${maxAtt}`}
                  </div>
                  <div style={{ color:'var(--gray-400)' }}>Percobaan</div>
                </div>
              )}
            </div>
            {blockedTryout ? (
              <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'12px', fontSize:13, color:'#dc2626', marginBottom:20 }}>
                Batas percobaan ({maxAtt}×) sudah tercapai.
              </div>
            ) : (
              <div style={{ background:'#fef3c7', border:'1px solid #fde68a', borderRadius:8, padding:'12px 14px', fontSize:12, color:'#92400e', marginBottom:24, textAlign:'left' }}>
                <AlertTriangle size={13} style={{ display:'inline', marginRight:6 }}/>
                Setelah memulai, timer akan berjalan. Pastikan koneksi internet stabil.
                {mode !== 'ujian' && ' Soal akan diacak ulang tiap percobaan.'}
              </div>
            )}
            {!blockedTryout && (
              <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }} onClick={handleStart}>
                {doneCount > 0 ? <RotateCcw size={14}/> : <ChevronRight size={14}/>}
                {doneCount > 0 ? (mode==='quiz' ? 'Mulai Lagi' : `Coba Lagi (${maxAtt-doneCount} tersisa)`) : 'Mulai'}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  /* Active exam view */
  const attemptNum    = myAnswer?.attempt_number || allAttempts.length
  const q             = questions[currentQ]
  const isFlagged     = q && flagged.has(q.id)
  const answeredCount = questions.filter(x => answers[x.id] && !flagged.has(x.id)).length
  const flaggedCount  = questions.filter(x => flagged.has(x.id)).length

  function toggleFlag(qid) {
    setFlagged(prev => { const s = new Set(prev); s.has(qid) ? s.delete(qid) : s.add(qid); return s })
  }

  const STATUS_STYLE = {
    answered:   { bg:'#16a34a', color:'#fff', border:'#16a34a' },
    flagged:    { bg:'#f97316', color:'#fff', border:'#f97316' },
    unanswered: { bg:'#fff',    color:'#dc2626', border:'#fca5a5' },
  }
  function qStatus(question) {
    if (flagged.has(question.id)) return 'flagged'   // flagged takes priority
    if (answers[question.id]) return 'answered'
    return 'unanswered'
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 56px)', overflow:'hidden' }}>

      {/* Top bar */}
      <div style={{ flexShrink:0, background:'#fff', borderBottom:'1px solid var(--gray-200)', padding:'10px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', zIndex:10, boxShadow:'0 1px 4px rgba(0,0,0,.06)' }}>
        <div>
          <div style={{ fontWeight:700, fontSize:14 }}>
            {exam.title}
            {mode !== 'ujian' && <span style={{ fontSize:11, fontWeight:500, color: MODE_COLOR[mode], marginLeft:8 }}>· Percobaan ke-{attemptNum}</span>}
          </div>
          <div style={{ fontSize:11, marginTop:2, display:'flex', gap:12 }}>
            <span style={{ color:'#16a34a', fontWeight:700 }}>&#10003; {answeredCount} dijawab</span>
            {flaggedCount > 0 && <span style={{ color:'#f97316', fontWeight:700 }}>&#128681; {flaggedCount} ragu-ragu</span>}
            <span style={{ color:'#dc2626', fontWeight:700 }}>&#10007; {questions.length - answeredCount - flaggedCount} belum</span>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:20, fontWeight:800, fontVariantNumeric:'tabular-nums', color: timeLeft !== null && timeLeft < 300 ? '#dc2626' : 'var(--gray-800)' }}>
            <Clock size={16}/> {formatTime(timeLeft)}
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => handleSubmit(false)}>Kumpulkan</button>
        </div>
      </div>

      {/* Body: sidebar + question */}
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>

        {/* Left sidebar */}
        <div style={{ width:190, flexShrink:0, background:'#f8fafc', borderRight:'1px solid var(--gray-200)', display:'flex', flexDirection:'column', overflowY:'auto' }}>
          <div style={{ padding:'12px 12px 6px', fontSize:10, fontWeight:800, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.6px' }}>Navigasi Soal</div>
          <div style={{ padding:'4px 10px 10px', display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:5 }}>
            {questions.map((question, i) => {
              const st = STATUS_STYLE[qStatus(question)]
              const isActive = i === currentQ
              return (
                <button key={question.id} onClick={() => setCurrentQ(i)} title={`Soal ${i+1}`}
                  style={{ width:'100%', aspectRatio:'1', borderRadius:8, border:`2px solid ${isActive ? '#4f46e5' : st.border}`, background: isActive ? '#4f46e5' : st.bg, color: isActive ? '#fff' : st.color, fontSize:12, fontWeight:800, cursor:'pointer', transition:'all .12s', boxShadow: isActive ? '0 0 0 3px #c7d2fe' : 'none', padding:0 }}>
                  {i+1}
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div style={{ padding:'12px 12px', marginTop:'auto', borderTop:'1px solid var(--gray-200)' }}>
            {[
              { bg:'#16a34a', border:'#16a34a', label:'Dijawab' },
              { bg:'#f97316', border:'#f97316', label:'Ragu-ragu' },
              { bg:'#fff',    border:'#fca5a5', label:'Belum', color:'#dc2626' },
            ].map(l => (
              <div key={l.label} style={{ display:'flex', alignItems:'center', gap:7, marginBottom:6 }}>
                <div style={{ width:13, height:13, borderRadius:3, background:l.bg, border:`2px solid ${l.border}`, flexShrink:0 }}/>
                <span style={{ fontSize:11, color: l.color || 'var(--gray-600)', fontWeight:600 }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Main question area */}
        <div style={{ flex:1, overflowY:'auto', padding:'28px 32px' }}>
          {q ? (
            <div style={{ maxWidth:660, margin:'0 auto' }}>

              {/* Meta row */}
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
                <div style={{ width:38, height:38, borderRadius:'50%', background:'#4f46e5', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:800, flexShrink:0 }}>{currentQ+1}</div>
                <span style={{ fontSize:12, color:'var(--gray-400)', flex:1 }}>Soal {currentQ+1} dari {questions.length}</span>
                <button onClick={() => toggleFlag(q.id)}
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 16px', borderRadius:8, border:`2px solid ${isFlagged ? '#f97316' : 'var(--gray-200)'}`, background: isFlagged ? '#fff7ed' : '#fff', color: isFlagged ? '#f97316' : 'var(--gray-400)', fontSize:12, fontWeight:700, cursor:'pointer', transition:'all .15s' }}>
                  &#128681; {isFlagged ? 'Ragu-ragu' : 'Tandai Ragu-ragu'}
                </button>
              </div>

              {/* Question card */}
              <div className="card" style={{ padding:'20px 24px', marginBottom:20, fontSize:14, color:'var(--gray-900)', lineHeight:1.85, fontWeight:500 }}>
                {q.text}
              </div>

              {/* Options */}
              {q.type === 'multiple_choice' && (
                <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:28 }}>
                  {q.options?.map((opt, oi) => {
                    const letter = String.fromCharCode(65 + oi)
                    const selected = answers[q.id] === letter
                    return (
                      <label key={letter} style={{ display:'flex', alignItems:'center', gap:14, padding:'13px 18px', border:`2px solid ${selected ? '#4f46e5' : 'var(--gray-200)'}`, background: selected ? '#eef2ff' : '#fff', borderRadius:12, cursor:'pointer', fontSize:13, transition:'all .12s', boxShadow: selected ? '0 0 0 3px #c7d2fe40' : 'none' }}>
                        <input type="radio" name={q.id} value={letter} checked={selected}
                          onChange={() => setAnswers(prev => ({ ...prev, [q.id]: letter }))}
                          style={{ display:'none' }}/>
                        <div style={{ width:30, height:30, borderRadius:'50%', border:`2px solid ${selected ? '#4f46e5' : 'var(--gray-300)'}`, background: selected ? '#4f46e5' : '#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color: selected ? '#fff' : 'var(--gray-500)', flexShrink:0 }}>{letter}</div>
                        <span style={{ color: selected ? '#3730a3' : 'var(--gray-700)', fontWeight: selected ? 600 : 400 }}>{opt}</span>
                      </label>
                    )
                  })}
                </div>
              )}
              {q.type === 'essay' && (
                <textarea className="input" placeholder="Tulis jawaban Anda..." rows={6}
                  value={answers[q.id] || ''}
                  onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                  style={{ resize:'vertical', fontFamily:'inherit', fontSize:13, marginBottom:28 }}/>
              )}

              {/* Prev / Next */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setCurrentQ(i => Math.max(0, i-1))} disabled={currentQ === 0}>
                  &larr; Sebelumnya
                </button>
                <span style={{ fontSize:12, color:'var(--gray-400)', fontWeight:600 }}>{currentQ+1} / {questions.length}</span>
                {currentQ < questions.length - 1
                  ? <button className="btn btn-primary btn-sm" onClick={() => setCurrentQ(i => i+1)}>Selanjutnya &rarr;</button>
                  : <button className="btn btn-primary" onClick={() => handleSubmit(false)}>Kumpulkan &#10003;</button>
                }
              </div>

            </div>
          ) : (
            <div style={{ textAlign:'center', paddingTop:80, color:'var(--gray-400)' }}>Tidak ada soal.</div>
          )}
        </div>
      </div>
    </div>
  )
}


