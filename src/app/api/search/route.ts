import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'
import { searchPlaces } from '@/lib/google-places'
import { enrichLeads } from '@/lib/deepseek'

const PLAN_CONFIG: Record<string, { credits_limit: number; daily_limit: number }> = {
  free:    { credits_limit: 50,  daily_limit: 7 },
  starter: { credits_limit: 200,  daily_limit: 7 },
  pro:     { credits_limit: 1000, daily_limit: 30 },
  agency:  { credits_limit: 5000, daily_limit: 150 },
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // Get or create user in Supabase
    let { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', userId)
      .single()

    if (!profile) {
      const { data: newUser } = await supabase
        .from('users')
        .insert({
          auth_id: userId,
          email: 'pending@update.com',
          name: 'User',
          plan: 'free',
          credits_used: 0,
          credits_limit: 50,
          credits_used_today: 0,
          daily_limit: 7,
        })
        .select()
        .single()
      profile = newUser
    }

    if (!profile) throw new Error('No se pudo crear el perfil')

    // Reset daily counter if new day
    const today = new Date().toDateString()
    const lastActive = profile.last_active
      ? new Date(profile.last_active).toDateString()
      : null
    let creditsUsedToday = profile.credits_used_today || 0

    if (!lastActive || lastActive !== today) {
      creditsUsedToday = 0
      await supabase
        .from('users')
        .update({
          credits_used_today: 0,
          last_active: new Date().toISOString(),
        })
        .eq('id', profile.id)
    }

    // Get config for user's plan
    const config = PLAN_CONFIG[profile.plan] || PLAN_CONFIG.free
    const creditsLimit = profile.credits_limit || config.credits_limit
    const dailyLimit = profile.daily_limit || config.daily_limit

    // Check total credits
    const remainingTotal = creditsLimit - (profile.credits_used || 0)
    if (remainingTotal <= 0) {
      return NextResponse.json(
        { error: 'Límite mensual alcanzado. Compra más créditos.', code: 'limit_exceeded' },
        { status: 403 }
      )
    }

    // Check daily credits
    const remainingDaily = dailyLimit - creditsUsedToday
    if (remainingDaily <= 0) {
      return NextResponse.json(
        { error: 'Límite diario alcanzado. Vuelve mañana o compra más créditos.', code: 'daily_limit_exceeded' },
        { status: 429 }
      )
    }

    const { query, location, radius, max_results } = await req.json()
    if (!query || !location) {
      return NextResponse.json({ error: 'query y location son requeridos' }, { status: 400 })
    }

    // Calculate how many leads the user can actually get
    const requestedLeads = Math.min(
      max_results || 20,
      remainingTotal,
      remainingDaily,
      60 // Google Places max per search
    )

    if (requestedLeads <= 0) {
      return NextResponse.json({ error: 'Sin créditos disponibles' }, { status: 403 })
    }

    // Create search record
    const { data: search, error: searchError } = await supabase
      .from('searches')
      .insert({
        user_id: profile.id,
        query,
        location,
        radius: radius || 5,
        results_count: 0,
      })
      .select()
      .single()

    if (searchError) throw searchError

    // Search Google Places (always fetch up to 60 for pagination, but limit saved)
    const places = await searchPlaces({ query, location, radius: (radius || 5) * 1000 })

    // Limit results to what the user can afford
    const affordablePlaces = places.slice(0, requestedLeads)

    // Batch enrich with DeepSeek
    const enriched = await enrichLeads(
      affordablePlaces.map(p => ({
        name: (typeof p.displayName === 'object' ? p.displayName?.text : p.displayName) || '',
        types: p.types || [],
        rating: p.rating || null,
        reviews_count: p.userRatingCount || null,
        address: p.formattedAddress || null,
        website: p.websiteUri || null,
      }))
    )

    // Insert leads
    const leads = affordablePlaces.map((place, i) => ({
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

    // Update counters
    const newTotal = (profile.credits_used || 0) + leads.length
    const newDaily = creditsUsedToday + leads.length

    await Promise.all([
      supabase.from('searches').update({ results_count: leads.length }).eq('id', search.id),
      supabase.from('users').update({
        credits_used: newTotal,
        credits_used_today: newDaily,
        last_active: new Date().toISOString(),
      }).eq('id', profile.id),
    ])

    return NextResponse.json({
      search_id: search.id,
      total: leads.length,
      leads: savedLeads,
      credits: {
        used: newTotal,
        limit: creditsLimit,
        used_today: newDaily,
        daily_limit: dailyLimit,
      },
    })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ error: 'Error al buscar leads' }, { status: 500 })
  }
}
