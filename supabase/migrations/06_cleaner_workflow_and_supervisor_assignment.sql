-- ============================================================================
-- 06_cleaner_workflow_and_supervisor_assignment.sql
-- Waste Pickup Request Portal: Cleaner Management, Supervisor Assignment & Review
-- Execution Order: 6 of 6
-- ============================================================================

-- 1. Add supervisor_id to profiles (1-to-many: a cleaner is assigned to a supervisor)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_supervisor ON public.profiles(supervisor_id);

-- 2. Add assigned_supervisor_id to cleaner_applications
ALTER TABLE public.cleaner_applications
ADD COLUMN IF NOT EXISTS assigned_supervisor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3. Enhance cleaner application review to link supervisor and service areas
CREATE OR REPLACE FUNCTION public.review_cleaner_application_v2(
    p_application_id UUID,
    p_decision TEXT, -- 'approved' or 'rejected'
    p_approved_locality_ids UUID[] DEFAULT ARRAY[]::UUID[],
    p_supervisor_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_caller_role user_role;
    v_app public.cleaner_applications%ROWTYPE;
    v_loc_id UUID;
    v_sup public.profiles%ROWTYPE;
BEGIN
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    IF v_caller_role NOT IN ('admin', 'supervisor') THEN
        RAISE EXCEPTION 'Access denied: Only administrator or supervisor can review cleaner applications.';
    END IF;

    SELECT * INTO v_app FROM public.cleaner_applications WHERE id = p_application_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cleaner application not found.';
    END IF;

    IF v_app.status != 'pending' THEN
        RAISE EXCEPTION 'This application has already been processed (current status: %).', v_app.status;
    END IF;

    IF p_decision NOT IN ('approved', 'rejected') THEN
        RAISE EXCEPTION 'Invalid decision: must be approved or rejected.';
    END IF;

    -- Validate supervisor if provided for approval
    IF p_decision = 'approved' AND p_supervisor_id IS NOT NULL THEN
        SELECT * INTO v_sup FROM public.profiles WHERE id = p_supervisor_id;
        IF NOT FOUND OR v_sup.role != 'supervisor' OR v_sup.account_status != 'active' THEN
            RAISE EXCEPTION 'Selected supervisor is invalid or inactive.';
        END IF;
    END IF;

    UPDATE public.cleaner_applications
    SET 
        status = p_decision,
        reviewer_id = auth.uid(),
        assigned_supervisor_id = p_supervisor_id,
        review_notes = p_notes,
        reviewed_at = now()
    WHERE id = p_application_id;

    IF p_decision = 'approved' THEN
        UPDATE public.profiles
        SET 
            role = 'cleaner',
            account_status = 'active',
            supervisor_id = p_supervisor_id,
            updated_at = now()
        WHERE id = v_app.cleaner_id;

        -- Approve selected localities
        IF array_length(p_approved_locality_ids, 1) > 0 THEN
            FOREACH v_loc_id IN ARRAY p_approved_locality_ids LOOP
                INSERT INTO public.cleaner_service_areas (cleaner_id, locality_id, is_approved, approved_by, approved_at)
                VALUES (v_app.cleaner_id, v_loc_id, true, auth.uid(), now())
                ON CONFLICT (cleaner_id, locality_id)
                DO UPDATE SET 
                    is_approved = TRUE,
                    approved_by = auth.uid(),
                    approved_at = now();
            END LOOP;
        END IF;
    ELSIF p_decision = 'rejected' THEN
        UPDATE public.profiles
        SET 
            account_status = 'suspended',
            updated_at = now()
        WHERE id = v_app.cleaner_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'status', p_decision);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RLS: Permit cleaners to read their assigned supervisor's profile details
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (
    id = auth.uid() OR
    public.current_user_role() IN ('supervisor', 'admin') OR
    id = (SELECT p.supervisor_id FROM public.profiles p WHERE p.id = auth.uid())
);
