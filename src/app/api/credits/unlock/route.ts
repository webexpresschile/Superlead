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

    // Check daily ad limit
    const today = new Date().toDateString()
    const lastActive = profile.last_active
      ? new Date(profile.last_active).toDateString()
      : null

    let adsWatchedToday = profile.ads_watched_today || 0

    // Reset if new day
    if (!lastActive || lastActive !== today) {
      adsWatchedToday = 0
    }

    if (adsWatchedToday >= MAX_ADS_PER_DAY) {
      return NextResponse.json({
        error: `Ya viste los ${MAX_ADS_PER_DAY} anuncios disponibles hoy. Vuelve mañana.`,
        code: 'max_ads_reached',
      }, { status: 429 })
    }

    // Add extra credits
    const newCreditsAvailable = (profile.credits_limit || 50) + EXTRA_CREDITS_PER_AD
    const newAdsWatched = adsWatchedToday + 1

    await db
      .from('users')
      .update({
        credits_limit: newCreditsAvailable,
        ads_watched_today: newAdsWatched,
        last_active: new Date().toISOString(),
      })
      .eq('id', profile.id)

    return NextResponse.json({
      success: true,
      extra_credits: EXTRA_CREDITS_PER_AD,
      credits_limit: newCreditsAvailable,
      ads_watched_today: newAdsWatched,
      ads_remaining: MAX_ADS_PER_DAY - newAdsWatched,
      message: `¡${EXTRA_CREDITS_PER_AD} créditos desbloqueados!`,
    })
  } catch (error: any) {
    console.error('Unlock error:', error)
    return NextResponse.json({ error: error.message || 'Error al desbloquear créditos' }, { status: 500 })
  }
}
