import * as cheerio from 'cheerio'

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'

export async function extractEmail(business: {
  name: string
  website?: string | null
  address?: string | null
}): Promise<{ email: string | null; source: string }> {
  // 1. Intentar scraping del sitio web
  if (business.website) {
    try {
      const email = await extractFromWebsite(business.website)
      if (email) return { email, source: 'website' }
    } catch {
      console.log('Website scrape failed:', business.website)
    }
  }

  // 2. DeepSeek como fallback
  try {
    const email = await extractViaDeepSeek(business.name, business.address || '')
    if (email) return { email, source: 'deepseek' }
  } catch {
    console.log('DeepSeek email extraction failed')
  }

  return { email: null, source: 'none' }
}

async function extractFromWebsite(url: string): Promise<string | null> {
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
  const html = await res.text()

  // Buscar patrones de email en el HTML
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  const matches = html.match(emailRegex)

  if (!matches) return null

  // Filtrar emails no deseados
  const valid = matches.find(e =>
    !e.includes('noreply') &&
    !e.includes('no-reply') &&
    !e.includes('admin@') &&
    !e.includes('webmaster@') &&
    !e.startsWith('@')
  )

  return valid || matches[0]
}

async function extractViaDeepSeek(name: string, address: string): Promise<string | null> {
  if (!DEEPSEEK_KEY) return null

  const prompt = `Encuentra el email de contacto de este negocio chileno.
Si no encuentras un email específico, responde solo "NO_EMAIL".
NO inventes emails.

Negocio: ${name}
Dirección: ${address}
Ciudad: Chile`

  const res = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 100,
    }),
  })

  const data = await res.json()
  const text = data.choices?.[0]?.message?.content?.trim() || 'NO_EMAIL'

  if (text === 'NO_EMAIL') return null

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(text) ? text : null
}
