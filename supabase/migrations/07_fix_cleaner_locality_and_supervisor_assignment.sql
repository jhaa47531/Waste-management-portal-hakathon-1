-- ============================================================================
-- 07_fix_cleaner_locality_and_supervisor_assignment.sql
-- Waste Pickup Request Portal: Fix Cleaner Locality & Supervisor Assignment
-- Execution Order: 7
-- ============================================================================

-- 1. Ensure profiles.supervisor_id column and foreign key exist
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'supervisor_id'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN supervisor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_supervisor_id ON public.profiles(supervisor_id);

-- 2. Ensure cleaner_applications.assigned_supervisor_id column exists
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'cleaner_applications' AND column_name = 'assigned_supervisor_id'
    ) THEN
        ALTER TABLE public.cleaner_applications ADD COLUMN assigned_supervisor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cleaner_apps_supervisor ON public.cleaner_applications(assigned_supervisor_id);

-- 3. Ensure cleaner_service_areas table has correct schema, constraints & indices
CREATE TABLE IF NOT EXISTS public.cleaner_service_areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cleaner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    locality_id UUID NOT NULL REFERENCES public.localities(id) ON DELETE CASCADE,
    is_approved BOOLEAN NOT NULL DEFAULT FALSE,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT cleaner_service_areas_cleaner_locality_unique UNIQUE (cleaner_id, locality_id)
);

CREATE INDEX IF NOT EXISTS idx_cleaner_service_areas_cleaner ON public.cleaner_service_areas(cleaner_id);
CREATE INDEX IF NOT EXISTS idx_cleaner_service_areas_locality ON public.cleaner_service_areas(locality_id);
CREATE INDEX IF NOT EXISTS idx_cleaner_service_areas_approved ON public.cleaner_service_areas(is_approved);

-- 4. Safe helper function to fetch a cleaner's supervisor ID without RLS recursion
CREATE OR REPLACE FUNCTION public.get_user_supervisor_id(u_id UUID)
RETURNS UUID AS $$
    SELECT supervisor_id FROM public.profiles WHERE id = u_id LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 5. Hardened RLS policies for profiles:
-- Cleaners can read their assigned supervisor's profile without causing 42P17 recursion
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (
    id = auth.uid() OR
    public.is_admin() OR
    public.current_user_role() = 'supervisor' OR
    id = public.get_user_supervisor_id(auth.uid())
);

-- 6. Hardened RLS policies for cleaner_service_areas:
-- Enable RLS
ALTER TABLE public.cleaner_service_areas ENABLE ROW LEVEL SECURITY;

-- Cleaners can read their own service areas, staff can read all
DROP POLICY IF EXISTS "Read cleaner service areas" ON public.cleaner_service_areas;
CREATE POLICY "Read cleaner service areas"
ON public.cleaner_service_areas FOR SELECT
TO authenticated
USING (
    cleaner_id = auth.uid() OR
    public.is_admin() OR
    public.current_user_role() = 'supervisor'
);

-- Cleaners can propose service areas for themselves (must be is_approved = false)
DROP POLICY IF EXISTS "Cleaners propose service areas" ON public.cleaner_service_areas;
CREATE POLICY "Cleaners propose service areas"
ON public.cleaner_service_areas FOR INSERT
TO authenticated
WITH CHECK (
    cleaner_id = auth.uid() AND
    is_approved = FALSE
);

-- Staff (Administrators & Supervisors) can manage service areas
DROP POLICY IF EXISTS "Staff manage cleaner service areas" ON public.cleaner_service_areas;
CREATE POLICY "Staff manage cleaner service areas"
ON public.cleaner_service_areas FOR ALL
TO authenticated
USING (
    public.is_admin() OR
    public.current_user_role() = 'supervisor'
)
WITH CHECK (
    public.is_admin() OR
    public.current_user_role() = 'supervisor'
);

-- 7. Atomic cleaner application review RPC function
CREATE OR REPLACE FUNCTION public.review_cleaner_application_v2(
    p_application_id UUID,
    p_decision TEXT,
    p_approved_locality_ids UUID[] DEFAULT '{}',
    p_supervisor_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_applicant_id UUID;
    v_reviewer_id UUID := auth.uid();
    v_loc_id UUID;
    v_now TIMESTAMPTZ := now();
BEGIN
    -- Verify staff permissions
    IF NOT (public.is_admin() OR public.current_user_role() = 'supervisor') THEN
        RAISE EXCEPTION 'Access denied: Only authorized administrators or supervisors can review cleaner applications.';
    END IF;

    -- Fetch applicant ID
    SELECT cleaner_id INTO v_applicant_id
    FROM public.cleaner_applications
    WHERE id = p_application_id;

    IF v_applicant_id IS NULL THEN
        RAISE EXCEPTION 'Application not found with ID %', p_application_id;
    END IF;

    -- Update application status
    UPDATE public.cleaner_applications
    SET 
        status = p_decision,
        reviewed_by = v_reviewer_id,
        review_notes = p_notes,
        reviewed_at = v_now,
        assigned_supervisor_id = CASE WHEN p_decision = 'approved' THEN COALESCE(p_supervisor_id, v_reviewer_id) ELSE NULL END
    WHERE id = p_application_id;

    IF p_decision = 'approved' THEN
        -- Activate cleaner profile and assign supervisor
        UPDATE public.profiles
        SET 
            role = 'cleaner',
            account_status = 'active',
            supervisor_id = COALESCE(p_supervisor_id, v_reviewer_id),
            updated_at = v_now
        WHERE id = v_applicant_id;

        -- Remove existing unapproved/pending service areas for fresh atomic update
        DELETE FROM public.cleaner_service_areas
        WHERE cleaner_id = v_applicant_id;

        -- Insert approved service areas
        FOREACH v_loc_id IN ARRAY p_approved_locality_ids LOOP
            INSERT INTO public.cleaner_service_areas (
                cleaner_id,
                locality_id,
                is_approved,
                approved_by,
                approved_at,
                created_at
            )
            VALUES (
                v_applicant_id,
                v_loc_id,
                TRUE,
                v_reviewer_id,
                v_now,
                v_now
            )
            ON CONFLICT (cleaner_id, locality_id)
            DO UPDATE SET
                is_approved = TRUE,
                approved_by = v_reviewer_id,
                approved_at = v_now;
        END LOOP;
    ELSE
        -- Rejected application: suspend or keep pending
        UPDATE public.profiles
        SET 
            account_status = 'suspended',
            updated_at = v_now
        WHERE id = v_applicant_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'applicant_id', v_applicant_id,
        'decision', p_decision,
        'supervisor_id', p_supervisor_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute privileges
GRANT EXECUTE ON FUNCTION public.get_user_supervisor_id(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.review_cleaner_application_v2(UUID, TEXT, UUID[], UUID, TEXT) TO authenticated, service_role;
