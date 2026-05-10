-- Superlead v4: Cambio a sistema por búsquedas (no por lead)
-- Los créditos ahora = número de búsquedas, no leads individuales

-- 1. Resetear usuarios existentes a valores por defecto según su plan
UPDATE public.users
SET
  credits_limit = CASE plan
    WHEN 'free' THEN 2
    WHEN 'starter' THEN 10
    WHEN 'pro' THEN 20
    WHEN 'agency' THEN 30
    ELSE 2
  END,
  daily_limit = CASE plan
    WHEN 'free' THEN 1
    WHEN 'starter' THEN 3
    WHEN 'pro' THEN 5
    WHEN 'agency' THEN 10
    ELSE 1
  END,
  credits_used = LEAST(credits_used, CASE plan
    WHEN 'free' THEN 2
    WHEN 'starter' THEN 10
    WHEN 'pro' THEN 20
    WHEN 'agency' THEN 30
    ELSE 2
  END),
  credits_used_today = 0,
  ads_extra_daily = 0,
  ads_watched_today = 0
WHERE true;

-- 2. Asegurar columna ads_extra_daily (por si no existe)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ads_extra_daily INT DEFAULT 0;
