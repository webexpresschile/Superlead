import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServerSupabase } from '@/lib/supabase'
import { checkRateLimit } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // Rate limit: max 10 profile reads per 30 seconds
    if (!checkRateLimit(`profile:${userId}`, 10, 30_000)) {
      return NextResponse.json(
        { error: '⏳ Demasiadas solicitudes. Espera unos segundos.' },
        { status: 429, headers: { 'Retry-After': '3' } }
      )
    }

    const db = getServerSupabase()

    const { data: user, error } = await db
      .from('users')
      .select('plan, credits_used, credits_used_today, ads_watched_today, ads_extra_daily, ads_extra_monthly, credits_limit, daily_limit')
      .eq('auth_id', userId)
      .single()

    if (error || !user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error: any) {
    console.error('Profile error:', error)
    return NextResponse.json({ error: error.message || 'Error al obtener perfil' }, { status: 500 })
  }
}
