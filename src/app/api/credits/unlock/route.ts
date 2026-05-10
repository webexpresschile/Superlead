import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServerSupabase } from '@/lib/supabase'
import { checkRateLimit } from '@/lib/rate-limit'

const MAX_ADS_PER_MONTH = 2
const EXTRA_SEARCHES_PER_AD = 1

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // Rate limit: max 1 ad unlock per 15 seconds
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown'
    if (!checkRateLimit(`unlock:${ip}`, 1, 15_000)) {
      return NextResponse.json(
        { error: '⏳ Espera 15 segundos entre anuncios.' },
        { status: 429, headers: { 'Retry-After': '15' } }
      )
    }

    const db = getServerSupabase()

    const { data: profile } = await db
      .from('users')
      .select('*')
      .eq('auth_id', userId)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    // ── Monthly reset ──
    const now = new Date()
    const thisMonth = `${now.getFullYear()}-${now.getMonth()}`
    const lastMonthlyReset = profile.monthly_reset_at
      ? `${new Date(profile.monthly_reset_at).getFullYear()}-${new Date(profile.monthly_reset_at).getMonth()}`
      : null

    let adsExtraMonthly = profile.ads_extra_monthly || 0
    let creditsUsed = profile.credits_used || 0

    if (lastMonthlyReset !== thisMonth) {
      adsExtraMonthly = 0
      creditsUsed = 0
      await db.from('users').update({
        credits_used: 0,
        ads_extra_monthly: 0,
        monthly_reset_at: now.toISOString(),
      }).eq('id', profile.id)
    }

    if (adsExtraMonthly >= MAX_ADS_PER_MONTH) {
      return NextResponse.json({
        error: `Ya viste los ${MAX_ADS_PER_MONTH} anuncios del mes. Vuelve el próximo mes.`,
        code: 'max_ads_reached',
      }, { status: 429 })
    }

    // ── Atomic increment ──
    const { data: currentProfile } = await db
      .from('users')
      .select('ads_extra_monthly, credits_used')
      .eq('id', profile.id)
      .single()

    if (!currentProfile) {
      return NextResponse.json({ error: 'Error al verificar créditos' }, { status: 500 })
    }

    // Guard against concurrent requests
    if (currentProfile.ads_extra_monthly !== profile.ads_extra_monthly) {
      return NextResponse.json({
        error: 'Ya procesaste este anuncio. Recarga para ver los cambios.',
        code: 'concurrent_request',
      }, { status: 409 })
    }

    const newAdsMonthly = adsExtraMonthly + EXTRA_SEARCHES_PER_AD
    const planSearches = profile.plan === 'free' ? 2
      : profile.plan === 'starter' ? 10
      : profile.plan === 'pro' ? 20
      : 30
    const effectiveMonthly = planSearches + newAdsMonthly

    await db
      .from('users')
      .update({
        ads_extra_monthly: newAdsMonthly,
        ads_watched_today: (profile.ads_watched_today || 0) + 1,
        last_active: now.toISOString(),
      })
      .eq('id', profile.id)

    return NextResponse.json({
      success: true,
      extra_searches: EXTRA_SEARCHES_PER_AD,
      ads_extra_monthly: newAdsMonthly,
      effective_monthly_limit: effectiveMonthly,
      ads_remaining: MAX_ADS_PER_MONTH - newAdsMonthly,
      message: `✅ +${EXTRA_SEARCHES_PER_AD} búsqueda extra al mes. Total mes: ${effectiveMonthly}`,
    })
  } catch (error: any) {
    console.error('Unlock error:', error)
    return NextResponse.json({ error: error.message || 'Error al desbloquear' }, { status: 500 })
  }
}
