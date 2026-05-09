import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Client-side: anon key + RLS
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server-side: service_role key (bypasses RLS)
export function getServerSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

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
