// Attempts to find a business website when Google Places doesn't provide one.
// Uses DuckDuckGo API (free, no key) + domain heuristics.

interface WebsiteResult {
  url: string | null
  source: string // 'google_places' | 'search' | 'heuristic' | 'none'
}

export async function findWebsite(
  name: string,
  address?: string | null,
  googleWebsite?: string | null
): Promise<WebsiteResult> {
  // 1. Already have it from Google Places
  if (googleWebsite) {
    return { url: googleWebsite, source: 'google_places' }
  }

  // 2. Try heuristic: check common Chilean domain patterns
  const slug = name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9]+/g, '')
    .replace(/^(el|la|los|las|the)/, '')
    .trim()

  const domains = [
    `${slug}.cl`,
    `${slug}.com`,
    `${slug}.com.cl`,
  ]

  for (const domain of domains) {
    try {
      const res = await fetch(`https://${domain}`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000),
      })
      if (res.ok || res.status === 403 || res.status === 401) {
        // Domain exists and responds
        return { url: `https://${domain}`, source: 'heuristic' }
      }
    } catch {
      continue
    }
  }

  // 3. Search via DuckDuckGo API (free, no API key)
  try {
    const searchQuery = encodeURIComponent(`${name} ${address || ''} Chile sitio web`)
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${searchQuery}&format=json&no_redirect=1`,
      { signal: AbortSignal.timeout(5000) }
    )
    const data = await res.json()

    // Check results for valid URLs
    if (data.AbstractURL && isValidBusinessUrl(data.AbstractURL)) {
      return { url: data.AbstractURL, source: 'search' }
    }

    // Check RelatedTopics
    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics) {
        if (topic.FirstURL && isValidBusinessUrl(topic.FirstURL)) {
          return { url: topic.FirstURL, source: 'search' }
        }
        if (topic.Topics) {
          for (const sub of topic.Topics) {
            if (sub.FirstURL && isValidBusinessUrl(sub.FirstURL)) {
              return { url: sub.FirstURL, source: 'search' }
            }
          }
        }
      }
    }

    // Check redirect URL
    if (data.Redirect && isValidBusinessUrl(data.Redirect)) {
      return { url: data.Redirect, source: 'search' }
    }
  } catch {
    console.log('DDG search failed for:', name)
  }

  return { url: null, source: 'none' }
}

function isValidBusinessUrl(url: string): boolean {
  try {
    const u = new URL(url)
    const hostname = u.hostname.toLowerCase()

    // Exclude social media, maps, directories
    const exclude = [
      'facebook.com', 'instagram.com', 'twitter.com', 'linkedin.com',
      'youtube.com', 'maps.google', 'google.cl', 'google.com',
      'mercadolibre', 'yelp', 'tripadvisor', 'pinterest',
    ]

    if (exclude.some(e => hostname.includes(e))) return false
    if (hostname === 'duckduckgo.com') return false

    return true
  } catch {
    return false
  }
}
