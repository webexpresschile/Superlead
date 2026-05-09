import { calculateDistance } from '@/lib/social-validator'

const BASE_URL = 'https://places.googleapis.com/v1'
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!

interface GooglePlace {
  id: string
  displayName: { text: string; languageCode?: string } | string
  formattedAddress: string
  nationalPhoneNumber: string | null
  websiteUri: string | null
  rating: number | null
  userRatingCount: number | null
  types: string[]
  location: { latitude: number; longitude: number }
  googleMapsUri: string
}

export interface EnrichedPlace extends GooglePlace {
  distance_km: number | null
  reference_point: string | null
  ref_latitude: number | null
  ref_longitude: number | null
}

interface SearchParams {
  query: string
  location: string
  radius?: number
  referencePoint?: string | null
  limit?: number
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; formatted: string } | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}`
  const res = await fetch(url)
  const data = await res.json()
  if (data.status !== 'OK' || !data.results[0]) return null
  const loc = data.results[0].geometry.location
  return { lat: loc.lat, lng: loc.lng, formatted: data.results[0].formatted_address }
}

async function searchNearby(
  keyword: string,
  lat: number,
  lng: number,
  radiusMeters: number
): Promise<GooglePlace[]> {
  const res = await fetch(`${BASE_URL}/places:searchNearby`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.types,places.location,places.googleMapsUri',
    },
    body: JSON.stringify({
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: radiusMeters,
        },
      },
      textQuery: keyword,
      pageSize: 20,
    }),
  })

  const data = await res.json()
  return data.places || []
}

async function searchText(
  keyword: string,
  lat: number,
  lng: number,
  radiusMeters: number
): Promise<GooglePlace[]> {
  const allPlaces: GooglePlace[] = []
  let nextPageToken: string | null = null

  do {
    const body: Record<string, unknown> = {
      textQuery: keyword,
      locationBias: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: radiusMeters,
        },
      },
      pageSize: 20,
    }
    if (nextPageToken) body.pageToken = nextPageToken

    const res = await fetch(`${BASE_URL}/places:searchText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.types,places.location,places.googleMapsUri,nextPageToken',
      },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    if (data.places) allPlaces.push(...data.places)
    nextPageToken = data.nextPageToken || null
    if (nextPageToken) await new Promise(r => setTimeout(r, 1000))
  } while (nextPageToken && allPlaces.length < 60)

  return allPlaces
}

export async function searchPlaces(params: SearchParams): Promise<EnrichedPlace[]> {
  const { query, location, radius = 5000, referencePoint, limit = 20 } = params

  // Geocode reference point if provided
  let refLat: number | null = null
  let refLng: number | null = null
  let refPointName = referencePoint || null

  if (referencePoint) {
    const refCoords = await geocodeAddress(referencePoint)
    if (refCoords) {
      refLat = refCoords.lat
      refLng = refCoords.lng
    }
  }

  // Geocode base location
  const locationCoords = await geocodeAddress(location)
  if (!locationCoords) throw new Error('No se pudo geocodificar la ubicación')

  const centerLat = refLat ?? locationCoords.lat
  const centerLng = refLng ?? locationCoords.lng

  // If reference point: expandable radius search
  if (referencePoint && refLat && refLng) {
    const radii = [500, 1000, 2000, 5000, 10000] // 0.5, 1, 2, 5, 10 km
    const seen = new Set<string>()
    const results: EnrichedPlace[] = []

    for (const r of radii) {
      if (results.length >= limit) break

      const places = await searchNearby(query, refLat, refLng, r)

      for (const place of places) {
        if (results.length >= limit) break
        if (seen.has(place.id)) continue
        seen.add(place.id)

        const distance = calculateDistance(
          refLat,
          refLng,
          place.location.latitude,
          place.location.longitude
        )

        results.push({
          ...place,
          distance_km: distance,
          reference_point: refPointName,
          ref_latitude: refLat,
          ref_longitude: refLng,
        })
      }
    }

    // Sort by distance
    return results.sort((a, b) => (a.distance_km || 0) - (b.distance_km || 0))
  }

  // Standard search (no reference point)
  const places = await searchText(query, centerLat, centerLng, radius)

  return places.map((place: GooglePlace) => {
    const dist = refLat && refLng
      ? calculateDistance(refLat, refLng, place.location.latitude, place.location.longitude)
      : null

    return {
      ...place,
      distance_km: dist,
      reference_point: refPointName,
      ref_latitude: refLat,
      ref_longitude: refLng,
    }
  })
}
