import { createContext, useContext, useState, useCallback } from 'react'

const AI_KEY_STORAGE = 'edusys_gemini_api_key'

const AIContext = createContext(null)

export function AIProvider({ children }) {
  const [apiKey, setApiKeyState] = useState(
    () => localStorage.getItem(AI_KEY_STORAGE) || ''
  )
  const [chatOpen, setChatOpen] = useState(false)

  const saveApiKey = useCallback((key) => {
    localStorage.setItem(AI_KEY_STORAGE, key)
    setApiKeyState(key)
  }, [])

  const clearApiKey = useCallback(() => {
    localStorage.removeItem(AI_KEY_STORAGE)
    setApiKeyState('')
  }, [])

  const hasKey = Boolean(apiKey)

  /**
   * Send a prompt to Gemini directly from browser
   * @param {string} prompt
   * @param {string} [systemPrompt]
   * @returns {Promise<string>} AI response text
   */
  const askGemini = useCallback(async (prompt, systemPrompt = '') => {
    if (!apiKey) throw new Error('NO_KEY')

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: systemPrompt
            ? { parts: [{ text: systemPrompt }] }
            : undefined,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        }),
      }
    )

    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error?.message || 'Gagal menghubungi AI')
    }

    const data = await response.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '(Tidak ada respons)'
  }, [apiKey])

  return (
    <AIContext.Provider value={{ apiKey, hasKey, saveApiKey, clearApiKey, askGemini, chatOpen, setChatOpen }}>
      {children}
    </AIContext.Provider>
  )
}

export const useAI = () => {
  const ctx = useContext(AIContext)
  if (!ctx) throw new Error('useAI must be used inside <AIProvider>')
  return ctx
}
