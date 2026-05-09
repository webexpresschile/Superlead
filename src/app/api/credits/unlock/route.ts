import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServerSupabase } from '@/lib/supabase'

const MAX_ADS_PER_DAY = 2
const EXTRA_CREDITS_PER_AD = 7

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

    // Check/reset daily ad counters
    const today = new Date().toDateString()
    const lastActive = profile.last_active
      ? new Date(profile.last_active).toDateString()
      : null

    let adsWatchedToday = profile.ads_watched_today || 0
    let adsExtra = profile.ads_extra_daily || 0

    // Reset if new day
    if (!lastActive || lastActive !== today) {
      adsWatchedToday = 0
      adsExtra = 0
    }

    if (adsWatchedToday >= MAX_ADS_PER_DAY) {
      return NextResponse.json({
        error: `Ya viste los ${MAX_ADS_PER_DAY} anuncios disponibles hoy. Vuelve mañana.`,
        code: 'max_ads_reached',
      }, { status: 429 })
    }

    // Add extra daily credits
    const newAdsExtra = adsExtra + EXTRA_CREDITS_PER_AD
    const newAdsWatched = adsWatchedToday + 1
    const effectiveDailyLimit = (profile.daily_limit || 7) + newAdsExtra

    await db
      .from('users')
      .update({
        ads_extra_daily: newAdsExtra,
        ads_watched_today: newAdsWatched,
        last_active: new Date().toISOString(),
      })
      .eq('id', profile.id)

    return NextResponse.json({
      success: true,
      extra_credits: EXTRA_CREDITS_PER_AD,
      ads_extra_daily: newAdsExtra,
      effective_daily_limit: effectiveDailyLimit,
      ads_watched_today: newAdsWatched,
      ads_remaining: MAX_ADS_PER_DAY - newAdsWatched,
      message: `¡+${EXTRA_CREDITS_PER_AD} créditos diarios extra! Límite hoy: ${effectiveDailyLimit}`,
    })
  } catch (error: any) {
    console.error('Unlock error:', error)
    return NextResponse.json({ error: error.message || 'Error al desbloquear créditos' }, { status: 500 })
  }
}
