import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServerSupabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const db = getServerSupabase()

    const { data: user, error } = await db
      .from('users')
      .select('*')
      .eq('auth_id', userId)
      .single()

    if (error || !user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    return NextResponse.json({
      plan: user.plan,
      credits_used: user.credits_used,
      credits_used_today: user.credits_used_today,
      ads_watched_today: user.ads_watched_today,
      ads_extra_daily: user.ads_extra_daily,
      ads_extra_monthly: user.ads_extra_monthly,
      credits_limit: user.credits_limit,
      daily_limit: user.daily_limit,
    })
  } catch (error: any) {
    console.error('Profile error:', error)
    return NextResponse.json({ error: error.message || 'Error al obtener perfil' }, { status: 500 })
  }
}
