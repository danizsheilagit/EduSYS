/**
 * EduSYS — withRetry
 * Wrapper untuk operasi Supabase dengan automatic retry + exponential backoff.
 *
 * Penggunaan:
 *   const { data, error } = await withRetry(() =>
 *     supabase.from('submissions').update({ grade }).eq('id', id)
 *   )
 */

/**
 * @param {Function} fn       — async function yang return { data, error }
 * @param {Object}  [options]
 * @param {number}  [options.retries=3]      — max retry
 * @param {number}  [options.baseDelay=500]  — delay awal dalam ms
 * @param {Function} [options.onRetry]       — callback saat retry
 */
export async function withRetry(fn, { retries = 3, baseDelay = 500, onRetry } = {}) {
  let lastError = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await fn()

      // Supabase errors datang di result.error, bukan throw
      if (result?.error) {
        lastError = result.error

        // Jangan retry untuk error logic (RLS, not found, dsb.)
        const statusCode = result.error?.code || result.error?.status
        const noRetry = ['42501', 'PGRST116', '23505'].includes(String(statusCode))
        if (noRetry || attempt >= retries) return result

        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 200
        onRetry?.({ attempt: attempt + 1, error: result.error, delay })
        await sleep(delay)
        continue
      }

      return result  // sukses
    } catch (err) {
      lastError = err

      if (attempt >= retries) throw err

      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 200
      onRetry?.({ attempt: attempt + 1, error: err, delay })
      await sleep(delay)
    }
  }

  // Semua retry habis
  return { data: null, error: lastError }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
