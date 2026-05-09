const BASE_URL = 'https://places.googleapis.com/v1'

interface GooglePlace {
  id: string
  displayName: string
  formattedAddress: string
  nationalPhoneNumber: string | null
  websiteUri: string | null
  rating: number | null
  userRatingCount: number | null
  types: string[]
  location: { latitude: number; longitude: number }
  googleMapsUri: string
}

interface SearchParams {
  query: string
  location: string
  radius?: number
}

async function geocodeLocation(location: string): Promise<{ lat: number; lng: number } | null> {
  const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
  const res = await fetch(geocodeUrl)
  const data = await res.json()
  if (data.status !== 'OK' || !data.results[0]) return null
  return data.results[0].geometry.location
}

export async function searchPlaces({ query, location, radius = 5000 }: SearchParams): Promise<GooglePlace[]> {
  const coords = await geocodeLocation(location)
  if (!coords) throw new Error('No se pudo geocodificar la ubicación')

  const allPlaces: GooglePlace[] = []
  let nextPageToken: string | null = null

  do {
    const body: Record<string, unknown> = {
      textQuery: query,
      locationBias: {
        circle: {
          center: { latitude: coords.lat, longitude: coords.lng },
          radius,
        },
      },
      pageSize: 20,
    }
    if (nextPageToken) body.pageToken = nextPageToken

    const res = await fetch(`${BASE_URL}/places:searchText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.types,places.location,places.googleMapsUri,nextPageToken',
      },
      body: JSON.stringify(body),
    })

    const data = await res.json()

    if (data.places) {
      allPlaces.push(...data.places)
    }

    nextPageToken = data.nextPageToken || null

    // Rate limit: 1 request per second
    if (nextPageToken) await new Promise(r => setTimeout(r, 1000))
  } while (nextPageToken && allPlaces.length < 60)

  return allPlaces
}
