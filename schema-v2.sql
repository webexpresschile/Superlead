-- Superlead v2: Daily limits + Trial support
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS credits_used_today INT DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS daily_limit INT DEFAULT 7;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS trial_start TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS trial_ends TIMESTAMPTZ;

-- Update plan configs (defaults for new users)
CREATE OR REPLACE FUNCTION public.get_plan_config(p_plan TEXT)
RETURNS TABLE(credits_limit INT, daily_limit INT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE p_plan
      WHEN 'free' THEN 50
      WHEN 'starter' THEN 200
      WHEN 'pro' THEN 1000
      WHEN 'agency' THEN 5000
      ELSE 50
    END,
    CASE p_plan
      WHEN 'free' THEN 7
      WHEN 'starter' THEN 7
      WHEN 'pro' THEN 30
      WHEN 'agency' THEN 150
      ELSE 7
    END;
END;
$$ LANGUAGE plpgsql;

-- Auto-reset daily credits (runs on each API call via the app)
-- No need for cron, we check/reset on every request
