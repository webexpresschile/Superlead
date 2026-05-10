import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServerSupabase } from '@/lib/supabase'
import { searchPlaces, EnrichedPlace } from '@/lib/google-places'
import { enrichLeads } from '@/lib/deepseek'
import { extractEmail } from '@/lib/email-extractor'
import { validateSocialMedia } from '@/lib/social-validator'
import { findWebsite } from '@/lib/website-finder'

const PLAN_CONFIG: Record<string, { searches: number; leads_per_search: number; daily_searches: number }> = {
  free:    { searches: 2,   leads_per_search: 10,  daily_searches: 1 },
  starter: { searches: 10,  leads_per_search: 20,  daily_searches: 3 },
  pro:     { searches: 20,  leads_per_search: 50,  daily_searches: 5 },
  agency:  { searches: 30,  leads_per_search: 100, daily_searches: 10 },
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const db = getServerSupabase()

    // Get or create user profile
    let { data: profile } = await db
      .from('users')
      .select('*')
      .eq('auth_id', userId)
      .single()

    if (!profile) {
      const config = PLAN_CONFIG.free
      const { data: newUser, error: createError } = await db
        .from('users')
        .insert({
          auth_id: userId,
          email: 'pending@update.com',
          name: 'User',
          plan: 'free',
          credits_used: 0,
          credits_limit: config.searches,
          credits_used_today: 0,
          daily_limit: config.daily_searches,
        })
        .select()
        .single()

      if (createError) {
        return NextResponse.json({ error: 'Error al crear perfil: ' + createError.message }, { status: 500 })
      }
      profile = newUser
    }

    if (!profile) throw new Error('No se pudo crear el perfil')

    // Reset counters if new day
    const today = new Date().toDateString()
    const lastActive = profile.last_active
      ? new Date(profile.last_active).toDateString()
      : null

    let searchesToday = profile.credits_used_today || 0
    let adsExtra = profile.ads_extra_daily || 0
    let adsWatched = profile.ads_watched_today || 0

    if (!lastActive || lastActive !== today) {
      searchesToday = 0
      adsExtra = 0
      adsWatched = 0
      const { error: resetErr } = await db
        .from('users')
        .update({
          credits_used_today: 0,
          ads_extra_daily: 0,
          ads_watched_today: 0,
          last_active: new Date().toISOString(),
        })
        .eq('id', profile.id)
      if (resetErr) console.error('Reset error:', resetErr)
    }

    // Plan config
    const config = PLAN_CONFIG[profile.plan] || PLAN_CONFIG.free
    const searchesLimit = profile.credits_limit || config.searches
    const baseDaily = profile.daily_limit || config.daily_searches
    const effectiveDaily = baseDaily + adsExtra
    const remainingSearches = searchesLimit - (profile.credits_used || 0)
    const remainingDaily = effectiveDaily - searchesToday

    // Check limits
    if (remainingSearches <= 0) {
      return NextResponse.json(
        { error: 'Plan completado. Cambia a un plan superior para seguir buscando.', code: 'limit_exceeded' },
        { status: 403 }
      )
    }
    if (remainingDaily <= 0) {
      return NextResponse.json(
        { error: 'Límite diario alcanzado. Ve el botón dorado y desbloquea +1 búsqueda viendo un anuncio.', code: 'daily_limit_exceeded' },
        { status: 429 }
      )
    }

    // Parse request body
    const { keyword, location, limit: requestedLimit = config.leads_per_search, reference_point } = await req.json()

    if (!keyword || !location) {
      return NextResponse.json({ error: 'keyword y location son requeridos' }, { status: 400 })
    }

    // Cap leads per search to the plan's max
    const leadsToFetch = Math.min(requestedLimit, config.leads_per_search, 60)

    if (leadsToFetch <= 0) {
      return NextResponse.json({ error: 'Cantidad inválida' }, { status: 400 })
    }

    // Search Google Places
    console.log(`Search [${profile.plan}]: "${keyword}" in "${location}", ref="${reference_point || '-'}", leads=${leadsToFetch}`)
    const places: EnrichedPlace[] = await searchPlaces({
      query: keyword,
      location,
      referencePoint: reference_point,
      limit: leadsToFetch,
    })

    const affordable = places.slice(0, leadsToFetch)
    console.log(`Got ${affordable.length} places`)

    // Enrich with DeepSeek
    const enriched = await enrichLeads(
      affordable.map(p => ({
        name: (typeof p.displayName === 'object' ? p.displayName?.text : p.displayName) || '',
        types: p.types || [],
        rating: p.rating || null,
        reviews_count: p.userRatingCount || null,
        address: p.formattedAddress || null,
        website: p.websiteUri || null,
      }))
    )

    // Extract emails + social media + website (parallel per lead)
    const enrichResults = await Promise.allSettled(
      affordable.map(async (place, i) => {
        const name = (typeof place.displayName === 'object' ? place.displayName?.text : place.displayName) || ''
        const [emailResult, socialResult, websiteResult] = await Promise.all([
          extractEmail({ name, website: place.websiteUri, address: place.formattedAddress }),
          validateSocialMedia({ name, website: place.websiteUri }),
          findWebsite(name, place.formattedAddress, place.websiteUri),
        ])
        return { emailResult, socialResult, websiteResult, index: i }
      })
    )

    // Create search record
    const { data: search, error: searchError } = await db
      .from('searches')
      .insert({
        user_id: profile.id,
        query: keyword,
        location,
        radius: 5,
        reference_point: reference_point || null,
        limit_leads: leadsToFetch,
        results_count: 0,
      })
      .select()
      .single()

    if (searchError) {
      return NextResponse.json({ error: 'Error al crear búsqueda: ' + searchError.message }, { status: 500 })
    }

    // Build leads array
    const leads = affordable.map((place, i) => {
      const name = (typeof place.displayName === 'object' ? place.displayName?.text : place.displayName) || ''
      const enrichment = enrichResults[i]
      const email = enrichment?.status === 'fulfilled' ? enrichment.value.emailResult.email : null
      const social = enrichment?.status === 'fulfilled' ? enrichment.value.socialResult : null
      const websiteFound = enrichment?.status === 'fulfilled'
        ? enrichment.value.websiteResult?.url
        : null
      const websiteUrl = place.websiteUri || websiteFound

      return {
        search_id: search.id,
        user_id: profile.id,
        name,
        address: place.formattedAddress || null,
        phone: place.nationalPhoneNumber || null,
        website: websiteUrl,
        rating: place.rating || null,
        reviews_count: place.userRatingCount || null,
        types: place.types || [],
        latitude: place.location?.latitude || null,
        longitude: place.location?.longitude || null,
        place_id: place.id,
        enriched_description: enriched[i]?.description || null,
        enriched_category: enriched[i]?.category || null,
        competition_level: enriched[i]?.competition_level || 'Medio',
        email,
        facebook_url: social?.facebook_url || null,
        instagram_url: social?.instagram_url || null,
        has_facebook: social?.has_facebook || false,
        has_instagram: social?.has_instagram || false,
        reference_point: reference_point || null,
        ref_latitude: place.ref_latitude,
        ref_longitude: place.ref_longitude,
        distance_km: place.distance_km,
      }
    })

    // Upsert leads (skip duplicates)
    const { data: savedLeads, error: insertError } = await db
      .from('leads')
      .upsert(leads, { onConflict: 'place_id', ignoreDuplicates: true })
      .select()

    if (insertError) {
      return NextResponse.json({ error: 'Error al guardar leads: ' + insertError.message }, { status: 500 })
    }

    // Count inserted leads
    const insertedCount = savedLeads?.length || 0
    const skippedCount = leads.length - insertedCount

    // Deduct 1 search credit (no por lead)
    const newTotalSearch = (profile.credits_used || 0) + 1
    const newSearchesToday = searchesToday + 1

    await Promise.all([
      db.from('searches').update({ results_count: insertedCount }).eq('id', search.id),
      db.from('users').update({
        credits_used: newTotalSearch,
        credits_used_today: newSearchesToday,
        last_active: new Date().toISOString(),
      }).eq('id', profile.id),
    ])

    return NextResponse.json({
      success: true,
      search_id: search.id,
      leads_got: insertedCount,
      skipped_duplicates: skippedCount,
      leads: savedLeads,
      plan: {
        name: profile.plan,
        searches_used: newTotalSearch,
        searches_limit: searchesLimit,
        searches_today: newSearchesToday,
        daily_limit: effectiveDaily,
        base_daily: baseDaily,
        ads_extra: adsExtra,
        searches_remaining: searchesLimit - newTotalSearch,
        leads_per_search: config.leads_per_search,
      },
    })
  } catch (error: any) {
    console.error('Search error:', error)
    return NextResponse.json({ error: error.message || 'Error al buscar leads' }, { status: 500 })
  }
}
