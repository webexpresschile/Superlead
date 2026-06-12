import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServerSupabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const db = getServerSupabase()

    // Try to update the plan to 'unlimited'
    const { data, error } = await db
      .from('users')
      .update({
        plan: 'unlimited',
        credits_used: 0,
        credits_used_today: 0,
      })
      .eq('auth_id', userId)
      .select()

    if (error) {
      // If it's a CHECK constraint error, guide the user
      if (error.message?.includes('violates check constraint') || error.message?.includes('new row for relation')) {
        return NextResponse.json({
          success: false,
          error: 'La base de datos no acepta el plan "unlimited".',
          sql_fix: `ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_plan_check;
ALTER TABLE public.users ADD CONSTRAINT users_plan_check CHECK (plan IN ('free', 'starter', 'pro', 'agency', 'unlimited'));`,
          message: 'Ejecuta este SQL en Supabase SQL Editor → https://supabase.com/dashboard/project/_/sql/new',
        }, { status: 400 })
      }
      return NextResponse.json({ error: 'Error al actualizar: ' + error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      plan: 'unlimited',
      message: '✅ Cuenta activada como Ilimitada. Ya puedes buscar leads sin restricciones.',
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error' }, { status: 500 })
  }
}
