import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'
import { searchPlaces } from '@/lib/google-places'
import { enrichLeads } from '@/lib/deepseek'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // Get or create user in Supabase
    const { data: existing } = await supabase
      .from('users')
      .select('id, credits_used, credits_limit')
      .eq('auth_id', userId)
      .single()

    let profile = existing

    if (!existing) {
      // First time — auto-create profile
      const { data: newUser } = await supabase
        .from('users')
        .insert({
          auth_id: userId,
          email: 'pending@update.com',
          name: 'User',
          plan: 'free',
          credits_used: 0,
          credits_limit: 50,
        })
        .select('id, credits_used, credits_limit')
        .single()
      profile = newUser
    }

    if (!profile) throw new Error('No se pudo crear el perfil')

    // Check credits
    if (profile.credits_used >= profile.credits_limit) {
      return NextResponse.json(
        { error: 'Límite de leads alcanzado. Actualiza tu plan.' },
        { status: 403 }
      )
    }

    const { query, location, radius } = await req.json()
    if (!query || !location) {
      return NextResponse.json({ error: 'query y location son requeridos' }, { status: 400 })
    }

    // Create search record
    const { data: search, error: searchError } = await supabase
      .from('searches')
      .insert({ user_id: profile.id, query, location, radius: radius || 5 })
      .select()
      .single()

    if (searchError) throw searchError

    // Search Google Places
    const places = await searchPlaces({ query, location, radius: (radius || 5) * 1000 })

    // Batch enrich with DeepSeek
    const enriched = await enrichLeads(
      places.map(p => ({
        name: (typeof p.displayName === 'object' ? p.displayName?.text : p.displayName) || '',
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
      user_id: profile.id,
      name: (typeof place.displayName === 'object' ? place.displayName?.text : place.displayName) || '',
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

    // Update counts
    await supabase.from('searches').update({ results_count: leads.length }).eq('id', search.id)
    await supabase
      .from('users')
      .update({ credits_used: (profile.credits_used || 0) + leads.length })
      .eq('id', profile.id)

    return NextResponse.json({
      search_id: search.id,
      total: leads.length,
      leads: savedLeads,
    })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ error: 'Error al buscar leads' }, { status: 500 })
  }
}
