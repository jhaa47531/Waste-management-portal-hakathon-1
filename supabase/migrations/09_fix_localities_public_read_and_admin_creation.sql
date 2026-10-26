-- ============================================================================
-- 09_fix_localities_public_read_and_admin_creation.sql
-- Waste Pickup Request Portal: Allow Public Read of Active Localities & Admin Creation
-- Target Tables:
--   public.localities
-- Accommodates both 'is_active' and 'active' column conventions.
-- ============================================================================

-- 1. Ensure public.localities table exists
CREATE TABLE IF NOT EXISTS public.localities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE CHECK (char_length(trim(name)) >= 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Ensure both active and is_active columns exist and are synchronized
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'localities' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE public.localities ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'localities' AND column_name = 'active'
    ) THEN
        ALTER TABLE public.localities ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE;
    END IF;

    -- Sync columns if one was null
    UPDATE public.localities SET active = is_active WHERE active IS NULL AND is_active IS NOT NULL;
    UPDATE public.localities SET is_active = active WHERE is_active IS NULL AND active IS NOT NULL;
END $$;

ALTER TABLE public.localities ENABLE ROW LEVEL SECURITY;

-- 2. Allow both anonymous visitors and authenticated users to read active localities
-- Critical for unauthenticated cleaners registering their preferred service areas
DROP POLICY IF EXISTS "Read active localities" ON public.localities;
DROP POLICY IF EXISTS "Allow public read of active localities" ON public.localities;
CREATE POLICY "Allow public read of active localities"
ON public.localities FOR SELECT
TO anon, authenticated
USING (
    coalesce(to_jsonb(public.localities)->>'is_active', to_jsonb(public.localities)->>'active', 'true')::boolean = TRUE 
    OR public.current_user_role() IN ('supervisor', 'admin', 'administrator')
);

-- 3. Allow authorized administrators to insert and manage municipal localities
DROP POLICY IF EXISTS "Admins can manage localities" ON public.localities;
CREATE POLICY "Admins can manage localities"
ON public.localities FOR ALL
TO authenticated
USING (public.current_user_role() IN ('admin', 'administrator'))
WITH CHECK (public.current_user_role() IN ('admin', 'administrator'));

-- 4. Grant table privileges to anon, authenticated, and service_role
GRANT SELECT ON TABLE public.localities TO anon, authenticated;
GRANT ALL ON TABLE public.localities TO authenticated, service_role;

-- 5. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
