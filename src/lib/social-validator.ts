interface SocialResult {
  facebook_url: string | null
  instagram_url: string | null
  has_facebook: boolean
  has_instagram: boolean
}

export async function validateSocialMedia(business: {
  name: string
  website?: string | null
}): Promise<SocialResult> {
  const result: SocialResult = {
    facebook_url: null,
    instagram_url: null,
    has_facebook: false,
    has_instagram: false,
  }

  // Buscar en el sitio web primero (más confiable)
  if (business.website) {
    try {
      const social = await findSocialFromWebsite(business.website)
      if (social.facebook_url) {
        result.facebook_url = social.facebook_url
        result.has_facebook = true
      }
      if (social.instagram_url) {
        result.instagram_url = social.instagram_url
        result.has_instagram = true
      }
    } catch {
      console.log('Website social scan failed')
    }
  }

  return result
}

async function findSocialFromWebsite(url: string): Promise<SocialResult> {
  const result: SocialResult = {
    facebook_url: null,
    instagram_url: null,
    has_facebook: false,
    has_instagram: false,
  }

  const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
  const html = await res.text()

  // Facebook links
  const fbRegex = /https?:\/\/(www\.)?facebook\.com\/[a-zA-Z0-9.]+/g
  const fbMatches = html.match(fbRegex)
  if (fbMatches) {
    result.facebook_url = fbMatches[0].split('?')[0] // Remove query params
    result.has_facebook = true
  }

  // Instagram links
  const igRegex = /https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9._]+/g
  const igMatches = html.match(igRegex)
  if (igMatches) {
    result.instagram_url = igMatches[0].split('?')[0]
    result.has_instagram = true
  }

  return result
}

// Haversine distance formula (km)
const EARTH_RADIUS_KM = 6371

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return parseFloat((EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2))
}
