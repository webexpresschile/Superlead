import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const searchId = searchParams.get('search_id')

  let query = supabase
    .from('leads')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (searchId) query = query.eq('search_id', searchId)

  const { data: leads, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ leads })
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { search_id, search_ids, format = 'json' } = await req.json()

  let query = supabase
    .from('leads')
    .select('*')
    .eq('user_id', user.id)

  if (search_id) query = query.eq('search_id', search_id)
  if (search_ids) query = query.in('search_id', search_ids)

  const { data: leads, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (format === 'csv') {
    const headers = ['name', 'address', 'phone', 'website', 'rating', 'reviews_count', 'types', 'competition_level', 'enriched_category', 'enriched_description']
    const csvRows = [
      headers.join(','),
      ...leads.map(l => headers.map(h => {
        const val = l[h] || ''
        return `"${String(val).replace(/"/g, '""')}"`
      }).join(','))
    ]
    return new NextResponse(csvRows.join('\n'), {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename=leads.csv' }
    })
  }

  return NextResponse.json({ leads })
}
