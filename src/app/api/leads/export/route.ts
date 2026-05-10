import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServerSupabase } from '@/lib/supabase'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // Rate limit: max 1 export per 5 seconds per user
    if (!checkRateLimit(`export:${userId}`, 1, 5_000)) {
      return NextResponse.json(
        { error: '⏳ Espera un momento entre exportaciones.' },
        { status: 429, headers: { 'Retry-After': '5' } }
      )
    }

    const db = getServerSupabase()

    const { data: user, error: userError } = await db
      .from('users')
      .select('id')
      .eq('auth_id', userId)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const { search_id, format = 'json', category, competition, q } = await req.json()

    let query = db.from('leads').select('*').eq('user_id', user.id)
    if (search_id) query = query.eq('search_id', search_id)
    if (category) query = query.eq('enriched_category', category)
    if (competition) query = query.eq('competition_level', competition)
    if (q) query = query.ilike('name', `%${q}%`)

    const { data: leads, error } = await query.order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (format === 'csv') {
      const headers = [
        'Nombre',
        'Teléfono',
        'Email',
        'Dirección',
        'Rating',
        'Reseñas',
        'Categoría',
        'Competencia',
        'Descripción',
        'Facebook URL',
        'Instagram URL',
        'Sitio Web',
        'Distancia (km)',
        'Punto de Referencia',
      ]

      const safeCsv = (val: any): string => {
        if (val === null || val === undefined) return ''
        const str = String(val)
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str
      }

      const csvRows = [
        headers.join(','),
        ...leads.map((l: any) =>
          headers
            .map((_, i) => {
              const key = [
                'name', 'phone', 'email', 'address', 'rating', 'reviews_count',
                'enriched_category', 'competition_level', 'enriched_description',
                'facebook_url', 'instagram_url', 'website', 'distance_km', 'reference_point',
              ][i]
              return safeCsv(l[key])
            })
            .join(',')
        ),
      ].join('\n')

      const filename = `superlead-leads${category ? '-' + category : ''}${competition ? '-' + competition : ''}.csv`
      return new NextResponse(csvRows, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename.replace(/[^a-zA-Z0-9\-_.]/g, '_')}"`,
        },
      })
    }

    return NextResponse.json({ leads })
  } catch (error: any) {
    console.error('Export error:', error)
    return NextResponse.json({ error: error.message || 'Error al exportar' }, { status: 500 })
  }
}
