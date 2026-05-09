-- Migration v2 completa para Superlead

-- 1. Daily limits
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS credits_used_today INT DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS daily_limit INT DEFAULT 7;

-- 2. Trial support
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS trial_start TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS trial_ends TIMESTAMPTZ;

-- 3. Last active (for daily counter reset)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ;
