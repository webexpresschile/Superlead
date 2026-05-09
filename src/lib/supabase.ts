import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Lead = {
  id: string
  search_id: string
  user_id: string
  name: string
  address: string | null
  phone: string | null
  website: string | null
  rating: number | null
  reviews_count: number | null
  types: string[] | null
  latitude: number | null
  longitude: number | null
  place_id: string
  enriched_description: string | null
  enriched_category: string | null
  competition_level: string | null
  exported: boolean
  created_at: string
}

export type Search = {
  id: string
  user_id: string
  query: string
  location: string
  radius: number
  results_count: number
  created_at: string
}
