-- ============================================================================
-- 06_cleaner_workflow_and_supervisor_assignment.sql
-- Waste Pickup Request Portal: Cleaner Workflows, Supervisor Assignment & Permission Hardening
-- Execution Order: 6 of 6
-- ============================================================================

-- 1. Ensure user_role ENUM supports both 'admin' and 'administrator' for compatibility
DO $$ BEGIN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'administrator';
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN undefined_object THEN null;
END $$;

-- 2. Add supervisor_id to profiles (1-to-many cleaner-to-supervisor assignment)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_supervisor ON public.profiles(supervisor_id);

-- Ensure both 'phone' and 'phone_number' columns can coexist if needed
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'phone') THEN
        ALTER TABLE public.profiles ADD COLUMN phone TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'phone_number') THEN
        ALTER TABLE public.profiles ADD COLUMN phone_number TEXT;
    END IF;
END $$;

-- 3. Add assigned_supervisor_id to cleaner_applications
ALTER TABLE public.cleaner_applications
ADD COLUMN IF NOT EXISTS assigned_supervisor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cleaner_applications_assigned_supervisor
ON public.cleaner_applications(assigned_supervisor_id);

-- 4. Grant table & sequence privileges to service_role, authenticated, and anon roles
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, anon, authenticated, service_role;

-- 5. Safe Seed Localities (Handles both is_active and active column names)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'localities' AND column_name = 'is_active'
    ) THEN
        INSERT INTO public.localities (id, name, is_active)
        VALUES
            ('a0000000-0000-0000-0000-000000000001', 'North Ward - Sector 1', true),
            ('a0000000-0000-0000-0000-000000000002', 'North Ward - Sector 2', true),
            ('a0000000-0000-0000-0000-000000000003', 'South Ward - Sector 4', true),
            ('a0000000-0000-0000-0000-000000000004', 'East Commercial District', true),
            ('a0000000-0000-0000-0000-000000000005', 'West Residential Zone', true),
            ('a0000000-0000-0000-0000-000000000006', 'Central Market Square', true),
            ('a0000000-0000-0000-0000-000000000007', 'Campus & University Enclave', true),
            ('a0000000-0000-0000-0000-000000000008', 'Industrial Estate Area', true)
        ON CONFLICT (name) DO NOTHING;
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'localities' AND column_name = 'active'
    ) THEN
        INSERT INTO public.localities (id, name, active)
        VALUES
            ('a0000000-0000-0000-0000-000000000001', 'North Ward - Sector 1', true),
            ('a0000000-0000-0000-0000-000000000002', 'North Ward - Sector 2', true),
            ('a0000000-0000-0000-0000-000000000003', 'South Ward - Sector 4', true),
            ('a0000000-0000-0000-0000-000000000004', 'East Commercial District', true),
            ('a0000000-0000-0000-0000-000000000005', 'West Residential Zone', true),
            ('a0000000-0000-0000-0000-000000000006', 'Central Market Square', true),
            ('a0000000-0000-0000-0000-000000000007', 'Campus & University Enclave', true),
            ('a0000000-0000-0000-0000-000000000008', 'Industrial Estate Area', true)
        ON CONFLICT (name) DO NOTHING;
    END IF;
END $$;

-- 6. Helper function to check admin role (supports both 'administrator' and 'admin')
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
    SELECT role::text FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role::text IN ('administrator', 'admin')
        AND account_status::text = 'active'
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 7. RLS Policy Updates: Ensure 'administrator' has full administrative rights
DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;
CREATE POLICY "Admins can manage profiles"
ON public.profiles FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (
    id = auth.uid() OR
    public.is_admin() OR
    public.current_user_role() = 'supervisor' OR
    id = (SELECT p.supervisor_id FROM public.profiles p WHERE p.id = auth.uid())
);

DROP POLICY IF EXISTS "Admin modify localities" ON public.localities;
CREATE POLICY "Admin modify localities"
ON public.localities FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Read active localities" ON public.localities;
CREATE POLICY "Read active localities"
ON public.localities FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Staff manage cleaner applications" ON public.cleaner_applications;
CREATE POLICY "Staff manage cleaner applications"
ON public.cleaner_applications FOR ALL
TO authenticated
USING (public.is_admin() OR public.current_user_role() = 'supervisor')
WITH CHECK (public.is_admin() OR public.current_user_role() = 'supervisor');

DROP POLICY IF EXISTS "Staff manage cleaner service areas" ON public.cleaner_service_areas;
CREATE POLICY "Staff manage cleaner service areas"
ON public.cleaner_service_areas FOR ALL
TO authenticated
USING (public.is_admin() OR public.current_user_role() = 'supervisor')
WITH CHECK (public.is_admin() OR public.current_user_role() = 'supervisor');
