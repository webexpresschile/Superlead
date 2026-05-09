import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServerSupabase } from '@/lib/supabase'
import { searchPlaces, EnrichedPlace } from '@/lib/google-places'
import { enrichLeads } from '@/lib/deepseek'
import { extractEmail } from '@/lib/email-extractor'
import { validateSocialMedia } from '@/lib/social-validator'
import { findWebsite } from '@/lib/website-finder'

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

    const db = getServerSupabase()

    // Get or create user profile
    let { data: profile } = await db
      .from('users')
      .select('*')
      .eq('auth_id', userId)
      .single()

    if (!profile) {
      const { data: newUser, error: createError } = await db
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

      if (createError) {
        return NextResponse.json({ error: 'Error al crear perfil: ' + createError.message }, { status: 500 })
      }
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
      await db
        .from('users')
        .update({ credits_used_today: 0, last_active: new Date().toISOString() })
        .eq('id', profile.id)
    }

    // Reset daily ad counters if new day
    let adsExtra = profile.ads_extra_daily || 0
    let adsWatched = profile.ads_watched_today || 0

    if (!lastActive || lastActive !== today) {
      adsExtra = 0
      adsWatched = 0
      await db
        .from('users')
        .update({ ads_extra_daily: 0, ads_watched_today: 0 })
        .eq('id', profile.id)
    }

    // Plan config
    const config = PLAN_CONFIG[profile.plan] || PLAN_CONFIG.free
    const creditsLimit = profile.credits_limit || config.credits_limit
    const baseDailyLimit = profile.daily_limit || config.daily_limit
    const effectiveDailyLimit = baseDailyLimit + adsExtra
    const remainingTotal = creditsLimit - (profile.credits_used || 0)
    const remainingDaily = effectiveDailyLimit - creditsUsedToday

    if (remainingTotal <= 0) {
      return NextResponse.json(
        { error: 'Límite mensual alcanzado. Compra más créditos.', code: 'limit_exceeded' },
        { status: 403 }
      )
    }
    if (remainingDaily <= 0) {
      return NextResponse.json(
        { error: 'Límite diario alcanzado. Vuelve mañana.', code: 'daily_limit_exceeded' },
        { status: 429 }
      )
    }

    // Parse request body
    const { keyword, location, limit: requestedLimit = 20, reference_point } = await req.json()

    if (!keyword || !location) {
      return NextResponse.json({ error: 'keyword y location son requeridos' }, { status: 400 })
    }

    const limit = Math.min(requestedLimit, remainingTotal, remainingDaily, 60)

    if (limit <= 0) {
      return NextResponse.json({ error: 'Sin créditos disponibles' }, { status: 403 })
    }

    // Search Google Places
    console.log(`Searching: "${keyword}" in "${location}", ref="${reference_point || '-'}", limit=${limit}`)
    const places: EnrichedPlace[] = await searchPlaces({
      query: keyword,
      location,
      referencePoint: reference_point,
      limit,
    })

    const affordable = places.slice(0, limit)
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

    // Extract emails + social media + website (parallel, sequential per lead to avoid rate limits)
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
        limit_leads: limit,
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
      // Use website from search/find if Google didn't provide one
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

    const { data: savedLeads, error: insertError } = await db
      .from('leads')
      .insert(leads)
      .select()

    if (insertError) {
      return NextResponse.json({ error: 'Error al guardar leads: ' + insertError.message }, { status: 500 })
    }

    // Update counters
    const newTotal = (profile.credits_used || 0) + leads.length
    const newDaily = creditsUsedToday + leads.length

    await Promise.all([
      db.from('searches').update({ results_count: leads.length }).eq('id', search.id),
      db.from('users').update({
        credits_used: newTotal,
        credits_used_today: newDaily,
        last_active: new Date().toISOString(),
      }).eq('id', profile.id),
    ])

    return NextResponse.json({
      success: true,
      search_id: search.id,
      total: leads.length,
      leads: savedLeads,
      credits_used: leads.length,
      credits_remaining: creditsLimit - newTotal,
      credits: {
        used: newTotal,
        limit: creditsLimit,
        used_today: newDaily,
        daily_limit: effectiveDailyLimit,
        base_daily: baseDailyLimit,
      },
    })
  } catch (error: any) {
    console.error('Search error:', error)
    return NextResponse.json({ error: error.message || 'Error al buscar leads' }, { status: 500 })
  }
}
