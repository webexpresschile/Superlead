import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { searchPlaces } from '@/lib/google-places'
import { enrichLeads } from '@/lib/deepseek'

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // Check user credits
    const { data: profile } = await supabase
      .from('users')
      .select('credits_used, credits_limit')
      .eq('id', user.id)
      .single()

    if (profile && profile.credits_used >= profile.credits_limit) {
      return NextResponse.json({ error: 'Límite de leads alcanzado. Actualiza tu plan.' }, { status: 403 })
    }

    const { query, location, radius } = await req.json()
    if (!query || !location) {
      return NextResponse.json({ error: 'query y location son requeridos' }, { status: 400 })
    }

    // Create search record
    const { data: search, error: searchError } = await supabase
      .from('searches')
      .insert({ user_id: user.id, query, location, radius: radius || 5 })
      .select()
      .single()

    if (searchError) throw searchError

    // Search Google Places
    const places = await searchPlaces({ query, location, radius: (radius || 5) * 1000 })

    // Batch enrich with DeepSeek (in batches of 10)
    const enriched = await enrichLeads(
      places.map(p => ({
        name: p.displayName?.text || p.displayName || '',
        types: p.types || [],
        rating: p.rating || null,
        reviews_count: p.userRatingCount || null,
        address: p.formattedAddress || null,
        website: p.websiteUri || null,
      }))
    )

    // Insert leads
    const leads = places.map((place, i) => ({
      search_id: search.id,
      user_id: user.id,
      name: place.displayName?.text || place.displayName || '',
      address: place.formattedAddress || null,
      phone: place.nationalPhoneNumber || null,
      website: place.websiteUri || null,
      rating: place.rating || null,
      reviews_count: place.userRatingCount || null,
      types: place.types || [],
      latitude: place.location?.latitude || null,
      longitude: place.location?.longitude || null,
      place_id: place.id,
      enriched_description: enriched[i]?.description || null,
      enriched_category: enriched[i]?.category || null,
      competition_level: enriched[i]?.competition_level || 'Medio',
    }))

    const { data: savedLeads, error: insertError } = await supabase
      .from('leads')
      .insert(leads)
      .select()

    if (insertError) throw insertError

    // Update search count + user credits
    await supabase.from('searches').update({ results_count: leads.length }).eq('id', search.id)
    await supabase.from('users').update({ 
      credits_used: (profile?.credits_used || 0) + leads.length 
    }).eq('id', user.id)

    return NextResponse.json({ 
      search_id: search.id,
      total: leads.length,
      leads: savedLeads 
    })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ error: 'Error al buscar leads' }, { status: 500 })
  }
}
