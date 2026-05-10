// Rate limiter: in-memory sliding window
// Lost on server restart, good enough for MVP + free tier

interface RateEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateEntry>()

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key)
  }
}, 300_000)

/**
 * Check if action is rate-limited
 * @returns true if allowed, false if rate-limited
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): boolean {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    // New window
    store.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= maxRequests) {
    return false
  }

  entry.count++
  return true
}

/**
 * Higher-order function: wraps an API handler with rate limiting
 */
export function withRateLimit(
  handler: (req: Request, context: any) => Promise<Response>,
  keyPrefix: string,
  maxRequests: number,
  windowMs: number
) {
  return async (req: Request, context: any) => {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown'
    const key = `${keyPrefix}:${ip}`

    if (!checkRateLimit(key, maxRequests, windowMs)) {
      return new Response(
        JSON.stringify({ error: 'Demasiadas solicitudes. Espera un momento.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil(windowMs / 1000)),
          },
        }
      )
    }

    return handler(req, context)
  }
}
