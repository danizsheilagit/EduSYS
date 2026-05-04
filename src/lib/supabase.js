import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('[EduSYS] Missing Supabase environment variables.')
}

// Fetch wrapper dengan timeout 15 detik
// Mencegah request "hang" tanpa batas saat koneksi lambat
function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController()
  const timeout    = setTimeout(() => controller.abort(), 15_000)

  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timeout))
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession:   true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: fetchWithTimeout,
    headers: {
      'x-app-name': 'edusys',
    },
  },
  // Matikan realtime secara default
  // (aktifkan hanya di komponen yang benar-benar butuh live update)
  realtime: {
    params: {
      eventsPerSecond: 2,
    },
  },
  db: {
    schema: 'public',
  },
})
