import { useState, useRef, useEffect } from 'react'
import { Sparkles, X, Send, Loader2, KeyRound } from 'lucide-react'
import { useAI }  from '@/contexts/AIContext'
import { useAuth } from '@/contexts/AuthContext'
import AISettingsModal from './AISettingsModal'

// System prompt adapts to user role
function buildSystemPrompt(role, pageName = '') {
  const base = `Kamu adalah Asisten AI EduSYS milik STIKOM Yos Sudarso. Jawab dalam Bahasa Indonesia yang ramah dan ringkas. Hindari markdown berlebihan.`
  if (role === 'mahasiswa') return `${base} Bantu mahasiswa memahami materi kuliah, mengerjakan tugas, dan belajar lebih efektif.`
  if (role === 'dosen')     return `${base} Bantu dosen membuat rubrik tugas, soal ujian, bahan ajar, dan memberikan feedback yang konstruktif.`
  if (role === 'admin')     return `${base} Bantu admin mengelola sistem, menyusun laporan, dan membuat pengumuman institusi.`
  return base
}

export default function AIAssistant() {
  const { hasKey, chatOpen, setChatOpen, askGemini } = useAI()
  const { role } = useAuth()

  const [messages, setMessages] = useState([
    { role: 'bot', text: 'Halo! 👋 Saya AI Assistant EduSYS. Ada yang bisa saya bantu?' }
  ])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [keyModal, setKeyModal] = useState(false)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => {
    if (chatOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      inputRef.current?.focus()
    }
  }, [chatOpen, messages])

  async function send() {
    const text = input.trim()
    if (!text || loading) return

    setMessages(m => [...m, { role: 'user', text }])
    setInput('')
    setLoading(true)

    try {
      const reply = await askGemini(text, buildSystemPrompt(role))
      setMessages(m => [...m, { role: 'bot', text: reply }])
    } catch (err) {
      const errText = err.message === 'NO_KEY'
        ? '⚠️ API Key belum diatur. Klik tombol kunci untuk menambahkan key Gemini Anda.'
        : `❌ Error: ${err.message}`
      setMessages(m => [...m, { role: 'bot', text: errText }])
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <>
      {/* FAB */}
      {!chatOpen && (
        <button className="fab-ai" onClick={() => setChatOpen(true)} title="AI Assistant">
          <Sparkles size={20} />
        </button>
      )}

      {/* Chat panel */}
      {chatOpen && (
        <div className="ai-panel">
          {/* Panel header */}
          <div className="ai-panel-header">
            <Sparkles size={16} />
            <span className="ai-panel-title">AI Assistant</span>
            <button
              style={{ background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 6, padding: '3px 6px', color: '#fff', cursor: 'pointer' }}
              onClick={() => setKeyModal(true)}
              title="Pengaturan API Key"
            >
              <KeyRound size={13} />
            </button>
            <button
              style={{ background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 6, padding: '3px 6px', color: '#fff', cursor: 'pointer', marginLeft: 4 }}
              onClick={() => setChatOpen(false)}
            >
              <X size={13} />
            </button>
          </div>

          {/* No key warning banner */}
          {!hasKey && (
            <div style={{
              padding: '8px 14px', fontSize: 11,
              background: '#fef3c7', color: '#92400e',
              display: 'flex', alignItems: 'center', gap: 6,
              borderBottom: '1px solid #fde68a'
            }}>
              <KeyRound size={11} />
              API Key belum diset —{' '}
              <button
                onClick={() => setKeyModal(true)}
                style={{ background: 'none', border: 'none', color: '#92400e', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', fontSize: 11 }}
              >
                Atur sekarang
              </button>
            </div>
          )}

          {/* Messages */}
          <div className="ai-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`ai-msg ai-msg-${msg.role}`}>
                {msg.text}
              </div>
            ))}
            {loading && (
              <div className="ai-msg ai-msg-bot">
                <div className="ai-typing">
                  <div className="ai-dot" />
                  <div className="ai-dot" />
                  <div className="ai-dot" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="ai-input-row">
            <input
              ref={inputRef}
              className="input"
              placeholder="Tanya sesuatu…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={loading}
            />
            <button
              className="btn btn-primary btn-icon"
              onClick={send}
              disabled={!input.trim() || loading}
            >
              {loading
                ? <Loader2 size={14} style={{ animation: 'spin .7s linear infinite' }} />
                : <Send size={14} />
              }
            </button>
          </div>
        </div>
      )}

      {keyModal && <AISettingsModal onClose={() => setKeyModal(false)} />}
    </>
  )
}
