import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServerSupabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const db = getServerSupabase()

    const { data: user, error: userError } = await db
      .from('users')
      .select('id')
      .eq('auth_id', userId)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const { search_id, format = 'json' } = await req.json()

    let query = db.from('leads').select('*').eq('user_id', user.id)
    if (search_id) query = query.eq('search_id', search_id)

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
              const val = l[key]
              if (val === null || val === undefined) return ''
              const str = String(val)
              return str.includes(',') || str.includes('"') || str.includes('\n')
                ? `"${str.replace(/"/g, '""')}"`
                : str
            })
            .join(',')
        ),
      ].join('\n')

      return new NextResponse(csvRows, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="superlead-leads.csv"',
        },
      })
    }

    return NextResponse.json({ leads })
  } catch (error: any) {
    console.error('Export error:', error)
    return NextResponse.json({ error: error.message || 'Error al exportar' }, { status: 500 })
  }
}
