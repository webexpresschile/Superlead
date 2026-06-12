-- ============================================
-- SUPERLEAD - Schema Completo
-- ============================================

-- 1. USERS
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'agency', 'unlimited')),
  credits_used INT DEFAULT 0,
  credits_limit INT DEFAULT 50,
  lemon_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. SEARCHES
CREATE TABLE IF NOT EXISTS public.searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  location TEXT NOT NULL,
  radius INT DEFAULT 5,
  results_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. LEADS
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id UUID NOT NULL REFERENCES public.searches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  website TEXT,
  rating FLOAT,
  reviews_count INT,
  types TEXT[],
  latitude FLOAT,
  longitude FLOAT,
  place_id TEXT UNIQUE,
  enriched_description TEXT,
  enriched_category TEXT,
  competition_level TEXT DEFAULT 'Medio',
  exported BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. INDEXES
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON public.leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_search_id ON public.leads(search_id);
CREATE INDEX IF NOT EXISTS idx_searches_user_id ON public.searches(user_id);
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);

-- 5. RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own" ON public.users
  FOR SELECT USING (auth.uid() = auth_id);

CREATE POLICY "searches_view_own" ON public.searches
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "searches_insert_own" ON public.searches
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "leads_view_own" ON public.leads
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "leads_insert_own" ON public.leads
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6. AUTO-CREATE USER PROFILE ON SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (auth_id, email, name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
