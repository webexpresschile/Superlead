import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', userId)
    .single()

  if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  const { search_id, format = 'json' } = await req.json()

  let query = supabase.from('leads').select('*').eq('user_id', user.id)
  if (search_id) query = query.eq('search_id', search_id)

  const { data: leads, error } = await query.order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (format === 'csv') {
    const headers = [
      'name', 'address', 'phone', 'website', 'rating',
      'reviews_count', 'types', 'competition_level',
      'enriched_category', 'enriched_description',
    ]
    const csvRows = [
      headers.join(','),
      ...leads.map(l =>
        headers
          .map(h => {
            const val = l[h] || ''
            return `"${String(val).replace(/"/g, '""')}"`
          })
          .join(',')
      ),
    ]
    return new NextResponse(csvRows.join('\n'), {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename=leads.csv',
      },
    })
  }

  return NextResponse.json({ leads })
}
