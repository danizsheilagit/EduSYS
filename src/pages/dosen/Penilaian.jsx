import { useState, useEffect } from 'react'
import {
  BarChart2, CheckCircle2, Clock, ChevronDown, ChevronUp,
  Loader2, Star, FileText, ClipboardList, BookOpen, Download, Table2
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import FilePreview from '@/components/drive/FilePreview'
import toast from 'react-hot-toast'
import Sk from '@/components/ui/Skeleton'

/* ── helpers ─────────────────────────────────────────────── */
const MODE_LABEL = { ujian:'Ujian', tryout:'Try Out', quiz:'Quiz' }
const MODE_COLOR = { ujian:'var(--indigo-600)', tryout:'#0891b2', quiz:'#7c3aed' }
const TYPE_LABEL = { uts:'UTS', uas:'UAS', kuis:'Kuis' }

/* ── Tab bar ─────────────────────────────────────────────── */
function TabBar({ active, onChange }) {
  const tabs = [
    { key:'tugas', icon: ClipboardList, label:'Tugas' },
    { key:'ujian', icon: FileText,      label:'Ujian'  },
    { key:'rekap', icon: Table2,        label:'Rekap'  },
  ]
  return (
    <div style={{ display:'flex', gap:4, background:'var(--gray-100)', borderRadius:10, padding:4, width:'fit-content', marginBottom:20 }}>
      {tabs.map(({ key, icon: Icon, label }) => (
        <button key={key} onClick={() => onChange(key)}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 18px', borderRadius:8, border:'none', cursor:'pointer', fontSize:13, fontWeight:600, transition:'all .15s',
            background: active===key ? '#fff' : 'transparent',
            color:      active===key ? 'var(--indigo-700)' : 'var(--gray-500)',
            boxShadow:  active===key ? 'var(--shadow-sm)' : 'none',
          }}>
          <Icon size={14}/> {label}
        </button>
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────── */
/*  TAB: TUGAS                                                 */
/* ─────────────────────────────────────────────────────────── */
function TugasTab({ userId }) {
  const [assignments, setAssignments] = useState([])
  const [expanded,    setExpanded]    = useState({})
  const [submissions, setSubmissions] = useState({})
  const [loadingSubs, setLoadingSubs] = useState({})
  const [grading,     setGrading]     = useState({})
  const [loading,     setLoading]     = useState(true)

  useEffect(() => { fetchAssignments() }, [userId])

  async function fetchAssignments() {
    const { data } = await supabase.from('assignments')
      .select('*, course:courses!inner(name, code, dosen_id)')
      .eq('courses.dosen_id', userId)
      .order('created_at', { ascending: false })
    setAssignments(data || [])
    setLoading(false)
  }

  async function loadSubmissions(assignmentId) {
    if (submissions[assignmentId]) return
    setLoadingSubs(p => ({ ...p, [assignmentId]: true }))
    const { data } = await supabase.from('submissions')
      .select('*, student:profiles(full_name, nim, avatar_url)')
      .eq('assignment_id', assignmentId)
      .in('status', ['submitted','graded','late'])
      .order('submitted_at')
    setSubmissions(p => ({ ...p, [assignmentId]: data || [] }))
    setLoadingSubs(p => ({ ...p, [assignmentId]: false }))
  }

  function toggleExpand(id) {
    setExpanded(p => { const next = { ...p, [id]: !p[id] }; if (next[id]) loadSubmissions(id); return next })
  }

  async function handleGrade(sub, assignment) {
    const g = grading[sub.id]
    const grade = parseFloat(g?.grade)
    if (isNaN(grade) || grade < 0 || grade > assignment.max_score) {
      toast.error(`Nilai harus antara 0–${assignment.max_score}`); return
    }
    setGrading(p => ({ ...p, [sub.id]: { ...p[sub.id], loading: true } }))
    await supabase.from('submissions').update({
      grade, feedback: g?.feedback || '', status: 'graded', graded_by: userId, graded_at: new Date().toISOString()
    }).eq('id', sub.id)
    toast.success(`Nilai ${sub.student?.full_name} disimpan`)
    setGrading(p => ({ ...p, [sub.id]: { loading: false } }))
    setSubmissions(p => ({
      ...p,
      [sub.assignment_id]: p[sub.assignment_id]?.map(s =>
        s.id === sub.id ? { ...s, grade, status: 'graded', feedback: g?.feedback||'' } : s
      )
    }))
  }

  if (loading) return (
    <div><Sk.PageHeader/><Sk.StatCards n={3}/><Sk.Table rows={5} cols={5}/></div>
  )
  if (!assignments.length) return (
    <div className="empty-state card" style={{ padding:40 }}>
      <ClipboardList size={32} color="var(--gray-200)"/>
      <p className="empty-state-text">Belum ada tugas</p>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {assignments.map(a => {
        const subs   = submissions[a.id] || []
        const graded = subs.filter(s => s.status === 'graded').length
        return (
          <div key={a.id} className="card">
            <div style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }} onClick={() => toggleExpand(a.id)}>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, fontSize:13 }}>{a.title}</div>
                <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:2 }}>
                  {a.course?.code} · {a.course?.name}
                  {a.due_date && ` · Deadline: ${new Date(a.due_date).toLocaleDateString('id-ID')}`}
                </div>
              </div>
              {expanded[a.id] && <span style={{ fontSize:12, color:'var(--gray-400)' }}>{graded}/{subs.length} dinilai</span>}
              {expanded[a.id] ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
            </div>

            {expanded[a.id] && (
              <div style={{ borderTop:'1px solid var(--gray-100)' }}>
                {loadingSubs[a.id] ? (
                  <div style={{ padding:20, display:'flex', justifyContent:'center' }}><div className="spinner"/></div>
                ) : subs.length === 0 ? (
                  <div style={{ padding:'20px', textAlign:'center', fontSize:12, color:'var(--gray-400)' }}>Belum ada yang mengumpulkan</div>
                ) : subs.map((s, i) => {
                  const g = grading[s.id] || {}
                  return (
                    <div key={s.id} style={{ padding:'14px 18px', borderBottom: i < subs.length-1 ? '1px solid var(--gray-100)' : 'none', display:'flex', gap:14, alignItems:'flex-start' }}>
                      <div className="avatar" style={{ width:34, height:34, flexShrink:0 }}>
                        {s.student?.avatar_url ? <img src={s.student.avatar_url} alt=""/> : s.student?.full_name?.[0]||'M'}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:600, fontSize:13 }}>{s.student?.full_name}</div>
                        <div style={{ fontSize:11, color:'var(--gray-400)' }}>{s.student?.nim} · {new Date(s.submitted_at).toLocaleString('id-ID')}</div>
                        {s.webview_link && <div style={{ marginTop:6 }}><FilePreview name={s.file_name} webViewLink={s.webview_link} compact/></div>}
                      </div>
                      <div style={{ flexShrink:0, display:'flex', flexDirection:'column', gap:8, minWidth:200 }}>
                        {s.status === 'graded' && g.loading === undefined ? (
                          <div style={{ textAlign:'right' }}>
                            <div style={{ fontSize:18, fontWeight:800, color:'var(--indigo-600)' }}>{s.grade} <span style={{ fontSize:11, color:'var(--gray-400)', fontWeight:400 }}>/ {a.max_score}</span></div>
                            {s.feedback && <div style={{ fontSize:11, color:'var(--gray-500)', marginTop:2 }}>{s.feedback}</div>}
                            <button className="btn btn-ghost btn-sm" style={{ marginTop:4, fontSize:11 }}
                              onClick={() => setGrading(p=>({...p,[s.id]:{grade:s.grade,feedback:s.feedback||''}}))}>
                              Edit Nilai
                            </button>
                          </div>
                        ) : (
                          <>
                            <div style={{ display:'flex', gap:6 }}>
                              <input type="number" className="input" placeholder={`0–${a.max_score}`} min={0} max={a.max_score}
                                style={{ width:80 }}
                                value={g.grade ?? (s.status==='graded' ? s.grade : '')}
                                onChange={e => setGrading(p=>({...p,[s.id]:{...p[s.id],grade:e.target.value}}))}/>
                              <span style={{ fontSize:11, color:'var(--gray-400)', alignSelf:'center' }}>/ {a.max_score}</span>
                            </div>
                            <textarea className="input" placeholder="Feedback (opsional)" rows={2}
                              style={{ resize:'vertical', fontSize:12 }}
                              value={g.feedback ?? (s.status==='graded' ? s.feedback : '')}
                              onChange={e => setGrading(p=>({...p,[s.id]:{...p[s.id],feedback:e.target.value}}))}/>
                            <button className="btn btn-primary btn-sm" onClick={() => handleGrade(s, a)} disabled={g.loading}>
                              {g.loading ? <Loader2 size={13} style={{ animation:'spin .7s linear infinite' }}/> : <Star size={13}/>}
                              Simpan Nilai
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────── */
/*  TAB: UJIAN                                                 */
/* ─────────────────────────────────────────────────────────── */
function UjianTab({ userId }) {
  const [exams,       setExams]       = useState([])
  const [expanded,    setExpanded]    = useState({})
  const [answers,     setAnswers]     = useState({})   // { examId: [rows] }
  const [loadingAns,  setLoadingAns]  = useState({})
  const [loading,     setLoading]     = useState(true)

  useEffect(() => { fetchExams() }, [userId])

  async function fetchExams() {
    // fetch exams from courses owned by this dosen
    const { data: courses } = await supabase.from('courses').select('id').eq('dosen_id', userId)
    const courseIds = (courses || []).map(c => c.id)
    if (!courseIds.length) { setLoading(false); return }

    const { data } = await supabase.from('exams')
      .select('*, course:courses(name, code)')
      .in('course_id', courseIds)
      .order('start_at', { ascending: false })
    setExams(data || [])
    setLoading(false)
  }

  async function loadAnswers(examId) {
    if (answers[examId]) return
    setLoadingAns(p => ({ ...p, [examId]: true }))
    const { data } = await supabase.from('exam_answers')
      .select('*, student:profiles(full_name, nim, avatar_url)')
      .eq('exam_id', examId)
      .not('submitted_at', 'is', null)
      .order('student_id').order('attempt_number')
    setAnswers(p => ({ ...p, [examId]: data || [] }))
    setLoadingAns(p => ({ ...p, [examId]: false }))
  }

  function toggleExpand(id) {
    setExpanded(p => { const next = { ...p, [id]: !p[id] }; if (next[id]) loadAnswers(id); return next })
  }

  if (loading) return (
    <div><Sk.PageHeader/><Sk.Table rows={5} cols={4}/></div>
  )
  if (!exams.length) return (
    <div className="empty-state card" style={{ padding:40 }}>
      <FileText size={32} color="var(--gray-200)"/>
      <p className="empty-state-text">Belum ada ujian</p>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {exams.map(exam => {
        const mode     = exam.exam_mode || 'ujian'
        const rows     = answers[exam.id] || []
        // Group by student: pick best score per student
        const byStudent = {}
        rows.forEach(r => {
          if (!byStudent[r.student_id]) byStudent[r.student_id] = { student: r.student, attempts: [] }
          byStudent[r.student_id].attempts.push(r)
        })
        const studentList = Object.values(byStudent)
        const gradedCount = studentList.filter(s => s.attempts.some(a => a.score !== null)).length

        return (
          <div key={exam.id} className="card">
            {/* Exam header row */}
            <div style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }} onClick={() => toggleExpand(exam.id)}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                  <span style={{ fontSize:10, fontWeight:700, background:'#eef2ff', color:'var(--indigo-600)', padding:'2px 8px', borderRadius:20 }}>
                    {TYPE_LABEL[exam.type] || exam.type}
                  </span>
                  <span style={{ fontSize:10, fontWeight:700, color: MODE_COLOR[mode], background: mode==='tryout'?'#e0f2fe':mode==='quiz'?'#f3e8ff':'#eef2ff', padding:'2px 8px', borderRadius:20 }}>
                    {MODE_LABEL[mode]}
                  </span>
                  <span style={{ fontWeight:600, fontSize:13 }}>{exam.title}</span>
                </div>
                <div style={{ fontSize:11, color:'var(--gray-400)' }}>
                  {exam.course?.code} · {exam.course?.name}
                  {exam.start_at && ` · ${new Date(exam.start_at).toLocaleDateString('id-ID')}`}
                </div>
              </div>
              {expanded[exam.id] && (
                <span style={{ fontSize:12, color:'var(--gray-400)' }}>{gradedCount}/{studentList.length} peserta</span>
              )}
              {expanded[exam.id] ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
            </div>

            {/* Expanded: student list */}
            {expanded[exam.id] && (
              <div style={{ borderTop:'1px solid var(--gray-100)' }}>
                {loadingAns[exam.id] ? (
                  <div style={{ padding:20, display:'flex', justifyContent:'center' }}><div className="spinner"/></div>
                ) : studentList.length === 0 ? (
                  <div style={{ padding:20, textAlign:'center', fontSize:12, color:'var(--gray-400)' }}>Belum ada yang mengumpulkan</div>
                ) : studentList.map(({ student, attempts }, i) => {
                  const best = attempts.reduce((b, a) => (a.score ?? -1) > (b.score ?? -1) ? a : b, attempts[0])
                  const isMultiAttempt = mode === 'tryout' || mode === 'quiz'
                  return (
                    <div key={student?.nim || i} style={{ padding:'14px 18px', borderBottom: i < studentList.length-1 ? '1px solid var(--gray-100)' : 'none', display:'flex', gap:14, alignItems:'flex-start' }}>
                      <div className="avatar" style={{ width:34, height:34, flexShrink:0 }}>
                        {student?.avatar_url ? <img src={student.avatar_url} alt=""/> : student?.full_name?.[0]||'M'}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:600, fontSize:13 }}>{student?.full_name}</div>
                        <div style={{ fontSize:11, color:'var(--gray-400)', marginBottom: isMultiAttempt ? 8 : 0 }}>
                          {student?.nim}
                          {isMultiAttempt && ` · ${attempts.length}× percobaan`}
                        </div>
                        {/* Attempt history for tryout/quiz */}
                        {isMultiAttempt && (
                          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                            {attempts.map((att, ai) => (
                              <div key={ai} style={{ padding:'4px 10px', borderRadius:8, background: att.id===best.id ? '#d1fae5' : 'var(--gray-100)', border: att.id===best.id ? '1px solid #6ee7b7' : '1px solid var(--gray-200)', fontSize:12 }}>
                                <span style={{ color:'var(--gray-500)', marginRight:4 }}>#{att.attempt_number}</span>
                                <span style={{ fontWeight:700, color: att.id===best.id ? '#065f46' : 'var(--gray-700)' }}>
                                  {att.score ?? '–'}
                                </span>
                                {att.id===best.id && <span style={{ fontSize:10, color:'#065f46', marginLeft:4 }}>✓ terbaik</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Score display */}
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        {best.score !== null ? (
                          <>
                            <div style={{ fontSize:20, fontWeight:800, color:'var(--indigo-600)' }}>{best.score}</div>
                            <div style={{ fontSize:10, color:'var(--gray-400)' }}>
                              {new Date(best.submitted_at).toLocaleDateString('id-ID')}
                            </div>
                          </>
                        ) : (
                          <span style={{ fontSize:11, color:'var(--gray-400)', fontStyle:'italic' }}>Belum dinilai</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────── */
/*  TAB: REKAP NILAI (matriks + bobot nilai akhir)            */
/* ─────────────────────────────────────────────────────────── */

function gradeColor(v) {
  if (v === null || v === undefined) return 'var(--gray-300)'
  if (v >= 80) return '#16a34a'
  if (v >= 75) return '#22c55e'
  if (v >= 70) return '#3b82f6'
  if (v >= 65) return '#6366f1'
  if (v >= 60) return '#ca8a04'
  if (v >= 55) return '#f97316'
  if (v >= 45) return '#dc2626'
  return '#991b1b'
}
function gradeLetter(v) {
  if (v === null || v === undefined) return '–'
  if (v >= 80) return 'A'
  if (v >= 75) return 'AB'
  if (v >= 70) return 'B'
  if (v >= 65) return 'BC'
  if (v >= 60) return 'C'
  if (v >= 55) return 'CD'
  if (v >= 45) return 'D'
  return 'E'
}

function RekapTab({ userId }) {
  const [courses,     setCourses]     = useState([])
  const [courseId,    setCourseId]    = useState('')
  const [matrix,      setMatrix]      = useState(null)
  const [loading,     setLoading]     = useState(false)
  const [weights,     setWeights]     = useState({})
  const [showConfig,  setShowConfig]  = useState(false)
  const [savingCfg,   setSavingCfg]   = useState(false)
  const [keaktifan,   setKeaktifan]   = useState({})   // { studentId: score }
  const [editCell,    setEditCell]    = useState(null)  // studentId being edited
  const [editVal,     setEditVal]     = useState('')

  useEffect(() => { fetchCourses() }, [userId])
  useEffect(() => { if (courseId) { buildMatrix(courseId); loadWeightConfig(courseId); loadKeaktifan(courseId) } }, [courseId])

  async function fetchCourses() {
    const { data } = await supabase.from('courses').select('id,name,code').eq('dosen_id', userId).order('name')
    setCourses(data || [])
    if (data?.length) setCourseId(data[0].id)
  }

  async function loadWeightConfig(cid) {
    const { data } = await supabase.from('course_grading_config')
      .select('config').eq('course_id', cid).eq('dosen_id', userId).maybeSingle()
    if (data?.config) setWeights(data.config)
    else setWeights({})
  }

  async function loadKeaktifan(cid) {
    const { data } = await supabase.from('student_keaktifan')
      .select('student_id, score').eq('course_id', cid)
    const map = {}
    ;(data || []).forEach(r => { map[r.student_id] = r.score })
    setKeaktifan(map)
  }

  async function saveKeaktifan(studentId, score) {
    const val = score === '' || score === null ? null : Number(score)
    await supabase.from('student_keaktifan')
      .upsert({ course_id: courseId, student_id: studentId, dosen_id: userId, score: val },
               { onConflict: 'course_id,student_id' })
    setKeaktifan(p => ({ ...p, [studentId]: val }))
  }

  async function saveWeightConfig() {
    setSavingCfg(true)
    await supabase.from('course_grading_config')
      .upsert({ course_id: courseId, dosen_id: userId, config: weights }, { onConflict: 'course_id,dosen_id' })
    toast.success('Konfigurasi bobot disimpan')
    setSavingCfg(false)
  }

  async function buildMatrix(cid) {
    setLoading(true); setMatrix(null)

    const { data: enrollments } = await supabase.from('enrollments')
      .select('student:profiles(id, full_name, nim)').eq('course_id', cid)
    const students = (enrollments || []).map(e => e.student).filter(Boolean)
      .sort((a, b) => (a.nim || '').localeCompare(b.nim || ''))

    const { data: assignments } = await supabase.from('assignments')
      .select('id, title, max_score, submissions(student_id, grade, status)')
      .eq('course_id', cid).order('created_at')

    const { data: exams } = await supabase.from('exams')
      .select('id, title, type, exam_mode, exam_answers(student_id, score, submitted_at)')
      .eq('course_id', cid).eq('is_published', true).order('start_at')

    const tugasCols = (assignments || []).map(a => ({
      key: 'tugas_' + a.id, label: a.title, max: a.max_score, kind: 'tugas',
      dataByStudent: Object.fromEntries((a.submissions || []).map(s => [s.student_id, s.grade]))
    }))
    const ujianCols = (exams || []).map(e => ({
      key: 'ujian_' + e.id, label: e.title, kind: 'ujian', max: 100, dataByStudent: {}
    }))
    ;(exams || []).forEach((e, ei) => {
      const byStudent = {}
      ;(e.exam_answers || []).filter(a => a.submitted_at).forEach(a => {
        if (byStudent[a.student_id] === undefined || (a.score ?? -1) > (byStudent[a.student_id] ?? -1))
          byStudent[a.student_id] = a.score
      })
      ujianCols[ei].dataByStudent = byStudent
    })

    const keaktifanCol = {
      key: 'keaktifan', label: 'Keaktifan', max: 100, kind: 'keaktifan',
      dataByStudent: {}   // filled from state at render — see `allColumns`
    }

    setMatrix({ students, tugasCols, keaktifanCol, ujianCols })
    setLoading(false)
  }

  // Compute weighted final score
  function finalScore(scores, cols) {
    const totalWeight = cols.reduce((s, c) => s + (Number(weights[c.key]) || 0), 0)
    if (totalWeight === 0) {
      // Fallback: simple average
      const nums = scores.filter(v => v !== undefined && v !== null)
      return nums.length ? nums.reduce((a, b) => a + Number(b), 0) / nums.length : null
    }
    let weighted = 0, usedWeight = 0
    cols.forEach((c, i) => {
      const w = Number(weights[c.key]) || 0
      const v = scores[i]
      if (w > 0 && v !== undefined && v !== null) {
        // Normalize score to 0-100 based on max
        weighted += (Number(v) / c.max * 100) * (w / totalWeight)
        usedWeight += w
      }
    })
    return usedWeight > 0 ? weighted : null
  }

  function exportCSV() {
    if (!matrix) return
    const { students } = matrix
    const cols = allColumns
    const header = ['NIM','Nama', ...cols.map(c => `"${c.label}"`), 'Nilai Akhir','Grade'].join(',')
    const rows = students.map(s => {
      const scores = cols.map(c => {
        const v = c.kind === 'keaktifan' ? (keaktifan[s.id] ?? '') : (c.dataByStudent[s.id] ?? '')
        return v
      })
      const final = finalScore(scores, cols)
      const grade = final !== null ? gradeLetter(final) : ''
      return [s.nim||'', `"${s.full_name||''}"`, ...scores, final !== null ? final.toFixed(1) : '', grade].join(',')
    })
    const csv  = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    const course = courses.find(c => c.id === courseId)
    a.href = url; a.download = `Rekap_${course?.code||'Nilai'}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  // Build full column list with live keaktifan data merged in
  const allColumns = matrix ? [
    ...matrix.tugasCols,
    { ...matrix.keaktifanCol, dataByStudent: keaktifan },
    ...matrix.ujianCols,
  ] : []

  const { students = [] } = matrix || {}
  const totalW    = allColumns.reduce((s, c) => s + (Number(weights[c.key]) || 0), 0)
  const hasWeights = totalW > 0

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16, flexWrap:'wrap' }}>
        <select className="input" style={{ maxWidth:300 }} value={courseId} onChange={e => setCourseId(e.target.value)}>
          {courses.map(c => <option key={c.id} value={c.id}>{c.code} – {c.name}</option>)}
        </select>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowConfig(v => !v)}
          style={{ display:'flex', alignItems:'center', gap:6 }}>
          ⚖ {showConfig ? 'Tutup' : 'Atur Bobot Nilai'}
          {hasWeights && <span style={{ fontSize:10, background:'var(--indigo-600)', color:'#fff', padding:'1px 6px', borderRadius:99 }}>{totalW}%</span>}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={exportCSV} disabled={!matrix||loading}
          style={{ display:'flex', alignItems:'center', gap:6 }}>
          <Download size={14}/> Ekspor CSV
        </button>
      </div>

      {/* Weight config panel */}
      {showConfig && matrix && (
        <div style={{ background:'#fafafa', border:'1px solid var(--gray-200)', borderRadius:10, padding:16, marginBottom:20 }}>
          <div style={{ fontWeight:700, fontSize:13, marginBottom:12, color:'var(--gray-800)' }}>
            ⚖ Konfigurasi Bobot Nilai Akhir
            <span style={{ fontSize:11, fontWeight:400, color:'var(--gray-400)', marginLeft:8 }}>
              Total bobot: <span style={{ color: Math.abs(totalW-100)<0.01?'#16a34a':'#dc2626', fontWeight:700 }}>{totalW.toFixed(0)}%</span> (idealnya 100%)
            </span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px,1fr))', gap:10, marginBottom:14 }}>
            {allColumns.map(c => (
              <div key={c.key} style={{ display:'flex', alignItems:'center', gap:8, background:'#fff', border:'1px solid var(--gray-200)', borderRadius:8, padding:'8px 10px' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:11, fontWeight:600, color:'var(--gray-700)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.label}</div>
                  <div style={{ fontSize:10, color:'var(--gray-400)' }}>
                    {c.kind==='tugas'?'Tugas':c.kind==='keaktifan'?'Keaktifan':'Ujian'}
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <input type="number" min={0} max={100}
                    className="input" style={{ width:64, textAlign:'center', padding:'4px 6px', fontWeight:700 }}
                    value={weights[c.key] ?? ''}
                    placeholder="0"
                    onChange={e => setWeights(p => ({ ...p, [c.key]: e.target.value === '' ? 0 : Number(e.target.value) }))}/>
                  <span style={{ fontSize:12, color:'var(--gray-400)', fontWeight:600 }}>%</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-primary btn-sm" onClick={saveWeightConfig} disabled={savingCfg}>
              {savingCfg ? <Loader2 size={13} style={{ animation:'spin .7s linear infinite' }}/> : '💾'}
              Simpan Bobot
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => {
              const equal = Math.floor(100 / allColumns.length)
              const newW = {}
              allColumns.forEach((c, i) => { newW[c.key] = i === allColumns.length-1 ? 100 - equal*(allColumns.length-1) : equal })
              setWeights(newW)
            }}>Rata Sama</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setWeights({})}>Reset</button>
          </div>
        </div>
      )}

      {loading && <div className="spinner" style={{ margin:'40px auto' }}/>}

      {!loading && matrix && (
        <>
          {students.length === 0 ? (
            <div className="empty-state card" style={{ padding:40 }}>
              <BarChart2 size={32} color="var(--gray-200)"/>
              <p className="empty-state-text">Belum ada mahasiswa terdaftar</p>
            </div>
          ) : (
            <div className="card" style={{ overflow:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:'var(--gray-50)' }}>
                    <th style={{ padding:'10px 14px', textAlign:'left', fontWeight:700, color:'var(--gray-500)', borderBottom:'1px solid var(--gray-200)', position:'sticky', left:0, background:'var(--gray-50)', whiteSpace:'nowrap', minWidth:170 }}>Mahasiswa</th>
                    {allColumns.map(c => (
                      <th key={c.key} style={{
                        padding:'10px 10px', textAlign:'center', fontWeight:700, color:'var(--gray-500)',
                        borderBottom:'1px solid var(--gray-200)', whiteSpace:'nowrap',
                        background: c.kind==='keaktifan' ? '#fefce8' : 'var(--gray-50)'
                      }}>
                        <div style={{ fontSize:11 }}>
                          {c.label}
                          {c.kind==='keaktifan' && <span style={{ fontSize:9, marginLeft:4 }}>✏</span>}
                        </div>
                        <div style={{ fontSize:9, fontWeight:500, color:'var(--gray-400)', marginTop:1 }}>
                          {c.kind==='tugas'?'Tugas':c.kind==='keaktifan'?'Manual':'Ujian'}
                          {weights[c.key] ? <span style={{ color:'var(--indigo-600)', fontWeight:700 }}> · {weights[c.key]}%</span> : null}
                        </div>
                      </th>
                    ))}
                    <th style={{ padding:'10px 10px', textAlign:'center', fontWeight:700, color:'var(--indigo-700)', borderBottom:'1px solid var(--gray-200)', borderLeft:'2px solid var(--gray-200)', background:'#eef2ff', whiteSpace:'nowrap' }}>
                      Nilai Akhir
                    </th>
                    <th style={{ padding:'10px 10px', textAlign:'center', fontWeight:700, color:'var(--indigo-700)', borderBottom:'1px solid var(--gray-200)', background:'#eef2ff', whiteSpace:'nowrap' }}>
                      Grade
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, si) => {
                    const scores = allColumns.map(c =>
                      c.kind === 'keaktifan' ? keaktifan[s.id] : c.dataByStudent[s.id]
                    )
                    const final  = finalScore(scores, allColumns)
                    const fStr   = final !== null ? final.toFixed(1) : null
                    const grade  = gradeLetter(final)
                    const rowBg  = si%2===0 ? '#fff' : 'var(--gray-50)'
                    return (
                      <tr key={s.id} style={{ background: rowBg }}>
                        <td style={{ padding:'10px 14px', borderBottom:'1px solid var(--gray-100)', position:'sticky', left:0, background: rowBg }}>
                          <div style={{ fontWeight:600, color:'var(--gray-800)' }}>{s.full_name}</div>
                          <div style={{ fontSize:10, color:'var(--gray-400)', marginTop:1 }}>{s.nim}</div>
                        </td>
                        {allColumns.map((c, ci) => {
                          const v = scores[ci]
                          // Keaktifan: inline editable cell
                          if (c.kind === 'keaktifan') {
                            const isEditing = editCell === s.id
                            return (
                              <td key={ci} style={{ padding:'6px 8px', textAlign:'center', borderBottom:'1px solid var(--gray-100)', background: si%2===0?'#fefce8':'#fef9c3', cursor:'pointer' }}
                                onClick={() => { if (!isEditing) { setEditCell(s.id); setEditVal(v ?? '') } }}>
                                {isEditing ? (
                                  <input
                                    autoFocus
                                    type="number" min={0} max={100}
                                    style={{ width:60, textAlign:'center', border:'1px solid var(--indigo-500)', borderRadius:6, padding:'3px 4px', fontSize:12, fontWeight:700, outline:'none' }}
                                    value={editVal}
                                    onChange={e => setEditVal(e.target.value)}
                                    onBlur={() => { saveKeaktifan(s.id, editVal); setEditCell(null) }}
                                    onKeyDown={e => { if (e.key==='Enter') { saveKeaktifan(s.id, editVal); setEditCell(null) } if (e.key==='Escape') setEditCell(null) }}
                                  />
                                ) : (
                                  v !== undefined && v !== null
                                    ? <span style={{ fontWeight:700, color: gradeColor(Number(v)) }}>{v}</span>
                                    : <span style={{ color:'var(--gray-300)', fontSize:11 }}>klik isi</span>
                                )}
                              </td>
                            )
                          }
                          return (
                            <td key={ci} style={{ padding:'10px', textAlign:'center', borderBottom:'1px solid var(--gray-100)' }}>
                              {v !== undefined && v !== null
                                ? <span style={{ fontWeight:700, color: gradeColor(Number(v)/c.max*100) }}>{v}</span>
                                : <span style={{ color:'var(--gray-300)' }}>–</span>}
                            </td>
                          )
                        })}
                        <td style={{ padding:'10px', textAlign:'center', borderBottom:'1px solid var(--gray-100)', borderLeft:'2px solid var(--gray-200)', background: si%2===0?'#f5f3ff':'#ede9fe' }}>
                          {fStr ? <span style={{ fontWeight:800, fontSize:15, color: gradeColor(final) }}>{fStr}</span>
                                : <span style={{ color:'var(--gray-300)' }}>–</span>}
                        </td>
                        <td style={{ padding:'10px', textAlign:'center', borderBottom:'1px solid var(--gray-100)', background: si%2===0?'#f5f3ff':'#ede9fe' }}>
                          {fStr ? (
                            <span style={{ fontWeight:800, fontSize:13, padding:'3px 10px', borderRadius:99, background: gradeColor(final)+'22', color: gradeColor(final) }}>
                              {grade}
                            </span>
                          ) : <span style={{ color:'var(--gray-300)' }}>–</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Legend */}
          <div style={{ display:'flex', gap:12, marginTop:12, fontSize:11, color:'var(--gray-500)', flexWrap:'wrap', alignItems:'center' }}>
            <span style={{ color:'#16a34a', fontWeight:700 }}>■ A ≥80</span>
            <span style={{ color:'#22c55e', fontWeight:700 }}>■ AB 75–79</span>
            <span style={{ color:'#3b82f6', fontWeight:700 }}>■ B 70–74</span>
            <span style={{ color:'#6366f1', fontWeight:700 }}>■ BC 65–69</span>
            <span style={{ color:'#ca8a04', fontWeight:700 }}>■ C 60–64</span>
            <span style={{ color:'#f97316', fontWeight:700 }}>■ CD 55–59</span>
            <span style={{ color:'#dc2626', fontWeight:700 }}>■ D 45–54</span>
            <span style={{ color:'#991b1b', fontWeight:700 }}>■ E &lt;45</span>
            <span>· – = Belum mengumpulkan</span>
            {!hasWeights && <span style={{ color:'#ca8a04' }}>⚠ Belum ada bobot → rata-rata sederhana</span>}
          </div>
        </>
      )}
    </div>
  )
}


export default function Penilaian() {
  const { user }      = useAuth()
  const [tab, setTab] = useState('tugas')

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Penilaian</h1>
        <p className="page-subtitle">Kelola nilai tugas dan ujian mahasiswa</p>
      </div>

      <TabBar active={tab} onChange={setTab} />

      {tab === 'tugas' && <TugasTab userId={user?.id} />}
      {tab === 'ujian' && <UjianTab userId={user?.id} />}
      {tab === 'rekap' && <RekapTab userId={user?.id} />}
    </div>
  )
}
