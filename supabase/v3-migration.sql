-- Superlead v3: Emails, RRSS, Reference Point, Distancia

-- Nuevas columnas en leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS facebook_url TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS instagram_url TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS has_facebook BOOLEAN DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS has_instagram BOOLEAN DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS reference_point TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ref_latitude FLOAT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ref_longitude FLOAT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS distance_km FLOAT;

-- Índices
CREATE INDEX IF NOT EXISTS idx_distance ON leads(distance_km);
CREATE INDEX IF NOT EXISTS idx_has_facebook ON leads(has_facebook);
CREATE INDEX IF NOT EXISTS idx_has_instagram ON leads(has_instagram);

-- También agregar reference_point a searches
ALTER TABLE searches ADD COLUMN IF NOT EXISTS reference_point TEXT;
ALTER TABLE searches ADD COLUMN IF NOT EXISTS limit_leads INT DEFAULT 20;
