import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServerSupabase } from '@/lib/supabase'

const MAX_ADS_PER_MONTH = 2
const EXTRA_SEARCHES_PER_AD = 1

const PLAN_NAMES: Record<string, string> = {
  free: 'Gratis', starter: 'Starter', pro: 'Pro', agency: 'Agency',
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const db = getServerSupabase()

    const { data: profile } = await db
      .from('users')
      .select('*')
      .eq('auth_id', userId)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    // Check/reset MONTHLY ad counters
    const now = new Date()
    const thisMonth = `${now.getFullYear()}-${now.getMonth()}`
    const lastMonthlyReset = profile.monthly_reset_at
      ? `${new Date(profile.monthly_reset_at).getFullYear()}-${new Date(profile.monthly_reset_at).getMonth()}`
      : null

    let adsExtraMonthly = profile.ads_extra_monthly || 0
    let creditsUsed = profile.credits_used || 0

    // Reset if new month
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

    // Add 1 extra MONTHLY search
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
