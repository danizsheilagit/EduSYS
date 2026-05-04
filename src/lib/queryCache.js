/**
 * EduSYS — Simple In-Memory Query Cache
 * TTL-based cache untuk mengurangi query Supabase yang berulang.
 *
 * Penggunaan:
 *   const data = await queryCache.get('announcements', () =>
 *     supabase.from('announcements').select('*').eq('is_active', true)
 *   )
 */

const cache = new Map()

const DEFAULT_TTL = {
  announcements: 5 * 60 * 1000,   // 5 menit
  semester:      10 * 60 * 1000,  // 10 menit (jarang berubah)
  courses:       2 * 60 * 1000,   // 2 menit
  default:       60 * 1000,       // 1 menit
}

export const queryCache = {
  /**
   * Ambil data — dari cache jika masih valid, fetch jika tidak.
   * @param {string} key  — cache key unik
   * @param {Function} fetcher — async function yang return { data, error }
   * @param {number} [ttl] — TTL dalam ms (default 60 detik)
   */
  async get(key, fetcher, ttl) {
    const cached = cache.get(key)
    const now    = Date.now()

    if (cached && now - cached.timestamp < (ttl ?? DEFAULT_TTL[key] ?? DEFAULT_TTL.default)) {
      return cached.data
    }

    const result = await fetcher()
    const data   = result?.data ?? result

    cache.set(key, { data, timestamp: now })
    return data
  },

  /** Hapus cache untuk key tertentu (setelah mutation) */
  invalidate(key) {
    if (key) {
      cache.delete(key)
    }
  },

  /** Hapus semua cache yang prefixnya cocok */
  invalidatePrefix(prefix) {
    for (const key of cache.keys()) {
      if (key.startsWith(prefix)) cache.delete(key)
    }
  },

  /** Hapus semua cache */
  clear() {
    cache.clear()
  },
}
