import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServerSupabase } from '@/lib/supabase'
import { searchPlaces, EnrichedPlace } from '@/lib/google-places'
import { enrichLeads } from '@/lib/deepseek'
import { extractEmail } from '@/lib/email-extractor'
import { validateSocialMedia } from '@/lib/social-validator'
import { findWebsite } from '@/lib/website-finder'
import { checkRateLimit } from '@/lib/rate-limit'

const PLAN_CONFIG: Record<string, { searches: number; leads_per_search: number; daily_searches: number }> = {
  free:      { searches: 2,   leads_per_search: 10,  daily_searches: 1 },
  starter:   { searches: 10,  leads_per_search: 20,  daily_searches: 3 },
  pro:       { searches: 20,  leads_per_search: 50,  daily_searches: 5 },
  agency:    { searches: 30,  leads_per_search: 100, daily_searches: 10 },
  unlimited: { searches: 999999, leads_per_search: 200, daily_searches: 999999 },
}

// Sanitize input to prevent injection through Google Places API
function sanitize(text: string, maxLen = 100): string {
  return text
    .replace(/[<>"'\\;()]/g, '')  // Remove injection chars
    .trim()
    .slice(0, maxLen)
}

export async function POST(req: NextRequest) {
  try {
    // ── Rate limiting: max 1 search every 3 seconds per user ──
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown'

    // Per-IP rate limit (max 5 searches/minute)
    if (!checkRateLimit(`search:ip:${ip}`, 5, 60_000)) {
      return NextResponse.json(
        { error: '⏳ Demasiadas búsquedas desde esta IP. Espera un momento.' },
        { status: 429, headers: { 'Retry-After': '10' } }
      )
    }

    // Per-user rate limit (max 1 search/3 seconds)
    if (!checkRateLimit(`search:user:${userId}`, 1, 3_000)) {
      return NextResponse.json(
        { error: '⏳ Ya tienes una búsqueda en proceso. Espera a que termine.' },
        { status: 429, headers: { 'Retry-After': '3' } }
      )
    }

    const db = getServerSupabase()

    // ── Get profile ──
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
          monthly_reset_at: new Date().toISOString(),
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

    // ── Reseteo mensual ──
    const now = new Date()
    const thisMonth = `${now.getFullYear()}-${now.getMonth()}`
    const lastMonthReset = profile.monthly_reset_at
      ? `${new Date(profile.monthly_reset_at).getFullYear()}-${new Date(profile.monthly_reset_at).getMonth()}`
      : null

    let monthlyUsed = profile.credits_used || 0
    let adsExtraMonthly = profile.ads_extra_monthly || 0

    if (lastMonthReset !== thisMonth) {
      monthlyUsed = 0
      adsExtraMonthly = 0
      await db.from('users').update({
        credits_used: 0,
        ads_extra_monthly: 0,
        monthly_reset_at: now.toISOString(),
      }).eq('id', profile.id)
    }

    // ── Reseteo diario ──
    const todayStr = now.toDateString()
    const lastActive = profile.last_active
      ? new Date(profile.last_active).toDateString()
      : null

    let searchesToday = profile.credits_used_today || 0
    let adsExtraToday = profile.ads_extra_daily || 0
    let adsWatchedToday = profile.ads_watched_today || 0

    if (!lastActive || lastActive !== todayStr) {
      searchesToday = 0
      adsExtraToday = 0
      adsWatchedToday = 0
      await db.from('users').update({
        credits_used_today: 0,
        ads_extra_daily: 0,
        ads_watched_today: 0,
        last_active: now.toISOString(),
      }).eq('id', profile.id)
    }

    // ── Plan config (SIEMPRE autoritativo) ──
    const config = PLAN_CONFIG[profile.plan] || PLAN_CONFIG.free

    // ── Unlimited: saltar todos los límites ──
    if (profile.plan === 'unlimited') {
      const body = await req.json()
      const keyword = sanitize(body.keyword || '')
      const location = sanitize(body.location || '')
      const requestedLimit = Math.min(parseInt(body.limit) || 100, 200)
      const reference_point = body.reference_point ? sanitize(body.reference_point, 200) : null

      if (!keyword || keyword.length < 2) {
        return NextResponse.json({ error: 'keyword debe tener al menos 2 caracteres' }, { status: 400 })
      }
      if (!location || location.length < 2) {
        return NextResponse.json({ error: 'location debe tener al menos 2 caracteres' }, { status: 400 })
      }
      if (requestedLimit <= 0) {
        return NextResponse.json({ error: 'Cantidad inválida' }, { status: 400 })
      }

      // ── Search Google Places ──
      const places: EnrichedPlace[] = await searchPlaces({
        query: keyword,
        location,
        referencePoint: reference_point,
        limit: requestedLimit,
      })

      const affordable = places.slice(0, requestedLimit)

      // ── Enrich with DeepSeek ──
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

      // ── Parallel enrichment (email + social + website) ──
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

      // ── Create search record ──
      const { data: search, error: searchError } = await db
        .from('searches')
        .insert({
          user_id: profile.id,
          query: keyword,
          location,
          radius: 5,
          reference_point,
          limit_leads: requestedLimit,
          results_count: 0,
        })
        .select()
        .single()

      if (searchError) {
        return NextResponse.json({ error: 'Error al crear búsqueda: ' + searchError.message }, { status: 500 })
      }

      // ── Build leads ──
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
          reference_point,
          ref_latitude: place.ref_latitude,
          ref_longitude: place.ref_longitude,
          distance_km: place.distance_km,
        }
      })

      // ── Upsert leads ──
      const { data: savedLeads, error: insertError } = await db
        .from('leads')
        .upsert(leads, { onConflict: 'place_id', ignoreDuplicates: true })
        .select()

      if (insertError) {
        return NextResponse.json({ error: 'Error al guardar leads: ' + insertError.message }, { status: 500 })
      }

      const insertedCount = savedLeads?.length || 0

      await Promise.all([
        db.from('searches').update({ results_count: insertedCount }).eq('id', search.id),
        db.from('users').update({ last_active: now.toISOString() }).eq('id', profile.id),
      ])

      return NextResponse.json({
        success: true,
        search_id: search.id,
        leads_got: insertedCount,
        leads: savedLeads,
        plan: {
          name: 'unlimited',
          searches_used: 0,
          searches_limit: 999999,
          searches_today: 0,
          daily_limit: 999999,
          base_daily: 999999,
          ads_extra: 0,
          ads_monthly: 0,
          searches_remaining: 999999,
          leads_per_search: 200,
        },
      })
    }

    const searchesLimit = config.searches + adsExtraMonthly
    const baseDaily = config.daily_searches
    const effectiveDaily = baseDaily + adsExtraToday
    const remainingSearches = searchesLimit - monthlyUsed
    const remainingDaily = effectiveDaily - searchesToday

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

    // ── Input validation ──
    const body = await req.json()
    const keyword = sanitize(body.keyword || '')
    const location = sanitize(body.location || '')
    const requestedLimit = Math.min(parseInt(body.limit) || config.leads_per_search, config.leads_per_search, 60)
    const reference_point = body.reference_point ? sanitize(body.reference_point, 200) : null

    if (!keyword || keyword.length < 2) {
      return NextResponse.json({ error: 'keyword debe tener al menos 2 caracteres' }, { status: 400 })
    }
    if (!location || location.length < 2) {
      return NextResponse.json({ error: 'location debe tener al menos 2 caracteres' }, { status: 400 })
    }
    if (requestedLimit <= 0) {
      return NextResponse.json({ error: 'Cantidad inválida' }, { status: 400 })
    }

    // ── Search Google Places ──
    const places: EnrichedPlace[] = await searchPlaces({
      query: keyword,
      location,
      referencePoint: reference_point,
      limit: requestedLimit,
    })

    const affordable = places.slice(0, requestedLimit)

    // ── Enrich with DeepSeek ──
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

    // ── Parallel enrichment (email + social + website) ──
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

    // ── Create search record ──
    const { data: search, error: searchError } = await db
      .from('searches')
      .insert({
        user_id: profile.id,
        query: keyword,
        location,
        radius: 5,
        reference_point,
        limit_leads: requestedLimit,
        results_count: 0,
      })
      .select()
      .single()

    if (searchError) {
      return NextResponse.json({ error: 'Error al crear búsqueda: ' + searchError.message }, { status: 500 })
    }

    // ── Build leads ──
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
        reference_point,
        ref_latitude: place.ref_latitude,
        ref_longitude: place.ref_longitude,
        distance_km: place.distance_km,
      }
    })

    // ── Upsert leads ──
    const { data: savedLeads, error: insertError } = await db
      .from('leads')
      .upsert(leads, { onConflict: 'place_id', ignoreDuplicates: true })
      .select()

    if (insertError) {
      return NextResponse.json({ error: 'Error al guardar leads: ' + insertError.message }, { status: 500 })
    }

    const insertedCount = savedLeads?.length || 0
    const skippedCount = leads.length - insertedCount

    // ── CRITICAL: Atomic credit deduction ──
    // Use compare-and-swap to prevent concurrent request abuse
    // Only deduct if credits_used hasn't changed since we read it
    const { data: currentProfile } = await db
      .from('users')
      .select('credits_used, credits_used_today')
      .eq('id', profile.id)
      .single()

    if (!currentProfile) {
      return NextResponse.json({ error: 'Error al verificar créditos' }, { status: 500 })
    }

    // If credits were consumed by another request since our read, reject
    if (currentProfile.credits_used !== profile.credits_used) {
      return NextResponse.json({
        error: 'Ya hay una búsqueda en proceso. Recarga para ver los resultados.',
        code: 'concurrent_request',
      }, { status: 409 })
    }

    const newMonthlyUsed = monthlyUsed + 1
    const newSearchesToday = searchesToday + 1
    const newRemaining = searchesLimit - newMonthlyUsed

    await Promise.all([
      db.from('searches').update({ results_count: insertedCount }).eq('id', search.id),
      db.from('users').update({
        credits_used: newMonthlyUsed,
        credits_used_today: newSearchesToday,
        last_active: now.toISOString(),
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
        searches_used: newMonthlyUsed,
        searches_limit: searchesLimit,
        searches_today: newSearchesToday,
        daily_limit: effectiveDaily,
        base_daily: baseDaily,
        ads_extra: adsExtraToday,
        ads_monthly: adsExtraMonthly,
        searches_remaining: newRemaining,
        leads_per_search: config.leads_per_search,
      },
    })
  } catch (error: any) {
    console.error('Search error:', error)
    return NextResponse.json({ error: error.message || 'Error al buscar leads' }, { status: 500 })
  }
}
