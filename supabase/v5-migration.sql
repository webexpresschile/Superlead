-- v5: Búsquedas mensuales + anuncios dan +2 búsquedas al mes

-- Columna para rastrear el mes del último reseteo
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS monthly_reset_at TIMESTAMPTZ;

-- Columna para búsquedas extra mensuales por anuncios (máx 2)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ads_extra_monthly INT DEFAULT 0;

-- Limpiar usuario de prueba
UPDATE public.users
SET
  credits_used = 0,
  credits_used_today = 0,
  credits_limit = CASE plan
    WHEN 'free' THEN 2 WHEN 'starter' THEN 10
    WHEN 'pro' THEN 20 WHEN 'agency' THEN 30 ELSE 2
  END,
  daily_limit = CASE plan
    WHEN 'free' THEN 1 WHEN 'starter' THEN 3
    WHEN 'pro' THEN 5 WHEN 'agency' THEN 10 ELSE 1
  END,
  ads_extra_daily = 0,
  ads_extra_monthly = 0,
  ads_watched_today = 0,
  monthly_reset_at = NOW(),
  last_active = NULL
WHERE auth_id = 'user_3DTNMRtB3feBSGCT4pYJoDQZ3iT';
