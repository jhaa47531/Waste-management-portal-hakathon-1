-- ============================================================================
-- 08_fix_supervisor_resolution_and_photos.sql
-- Waste Pickup Request Portal: Supervisor Resolution RPCs & Photo Types Fix
-- Target Functions:
--   1. public.return_to_progress(p_complaint_id UUID, p_notes TEXT)
--   2. public.approve_completion(p_complaint_id UUID, p_notes TEXT)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Ensure photo_type enum includes both standard DB values ('resident_report',
--    'cleaner_after') and legacy values ('resident_initial', 'cleaner_completion')
-- ----------------------------------------------------------------------------
DO $$ BEGIN
    ALTER TYPE photo_type ADD VALUE IF NOT EXISTS 'resident_report';
EXCEPTION WHEN others THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE photo_type ADD VALUE IF NOT EXISTS 'cleaner_after';
EXCEPTION WHEN others THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE photo_type ADD VALUE IF NOT EXISTS 'resident_initial';
EXCEPTION WHEN others THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE photo_type ADD VALUE IF NOT EXISTS 'cleaner_completion';
EXCEPTION WHEN others THEN null;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Implement public.return_to_progress
-- Allows an authorized supervisor/administrator to return a complaint from
-- 'awaiting_verification' back to 'in_progress' with an explanatory note.
-- Preserves existing trg_audit_complaint_status trigger; does NOT duplicate audit records.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.return_to_progress(
    p_complaint_id UUID,
    p_notes TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_caller_role user_role;
    v_complaint public.complaints%ROWTYPE;
BEGIN
    -- Authorization Check: Only active supervisors or administrators
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    IF v_caller_role IS NULL OR v_caller_role NOT IN ('supervisor', 'admin') THEN
        RAISE EXCEPTION 'Access denied: Only a supervisor or administrator can return a complaint to in-progress.';
    END IF;

    -- Note Validation: Mandatory explanatory note of at least 5 characters
    IF p_notes IS NULL OR char_length(trim(p_notes)) < 5 THEN
        RAISE EXCEPTION 'An explanatory note describing why the work must be redone (at least 5 characters) is required.';
    END IF;

    -- Target Complaint Validation
    SELECT * INTO v_complaint FROM public.complaints WHERE id = p_complaint_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Complaint with ID % not found.', p_complaint_id;
    END IF;

    -- Status Invariant Validation: Must currently be awaiting_verification
    IF v_complaint.status != 'awaiting_verification' THEN
        RAISE EXCEPTION 'Invalid transition: Complaint must be in "awaiting_verification" status to return to in-progress. Current status: %', v_complaint.status;
    END IF;

    -- Update complaint status and supervisor rework instructions
    UPDATE public.complaints
    SET 
        status = 'in_progress',
        supervisor_notes = trim(p_notes),
        updated_at = timezone('utc'::text, now())
    WHERE id = p_complaint_id;

    RETURN jsonb_build_object(
        'success', true,
        'status', 'in_progress',
        'complaint_id', p_complaint_id,
        'message', 'Complaint successfully returned to in-progress for cleaner rework.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ----------------------------------------------------------------------------
-- 3. Implement public.approve_completion
-- Validates supervisor authorization, verifies that complaint is in
-- 'awaiting_verification', checks that completion photo proof exists
-- (supporting both 'cleaner_after' and 'cleaner_completion'), and transitions to 'completed'.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_completion(
    p_complaint_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_caller_role user_role;
    v_complaint public.complaints%ROWTYPE;
    v_has_after_photo BOOLEAN;
BEGIN
    -- Authorization Check: Only active supervisors or administrators
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    IF v_caller_role IS NULL OR v_caller_role NOT IN ('supervisor', 'admin') THEN
        RAISE EXCEPTION 'Access denied: Only a supervisor or administrator can approve complaint completion.';
    END IF;

    -- Target Complaint Validation
    SELECT * INTO v_complaint FROM public.complaints WHERE id = p_complaint_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Complaint with ID % not found.', p_complaint_id;
    END IF;

    -- Status Invariant Validation: Must be awaiting_verification
    IF v_complaint.status != 'awaiting_verification' THEN
        RAISE EXCEPTION 'Invalid transition: Complaint must be awaiting verification to approve completion. Current status: %', v_complaint.status;
    END IF;

    -- Evidence Verification: Verify completion photo proof exists in complaint_photos
    -- Matches both 'cleaner_after' and 'cleaner_completion'
    SELECT EXISTS (
        SELECT 1 FROM public.complaint_photos
        WHERE complaint_id = p_complaint_id
          AND photo_type::text IN ('cleaner_after', 'cleaner_completion', 'completion', 'after')
    ) INTO v_has_after_photo;

    IF NOT v_has_after_photo THEN
        RAISE EXCEPTION 'Cannot approve completion: Mandatory after-cleaning photo proof is missing from complaint records.';
    END IF;

    -- Update complaint status to completed
    UPDATE public.complaints
    SET 
        status = 'completed',
        supervisor_notes = coalesce(trim(p_notes), supervisor_notes),
        updated_at = timezone('utc'::text, now())
    WHERE id = p_complaint_id;

    RETURN jsonb_build_object(
        'success', true,
        'status', 'completed',
        'complaint_id', p_complaint_id,
        'message', 'Completion approved and complaint marked completed.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ----------------------------------------------------------------------------
-- 4. Grant explicit EXECUTE permissions to authenticated and service_role
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.return_to_progress(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_completion(UUID, TEXT) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. Force PostgREST schema cache reload so RPC calls immediately discover the functions
-- ----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
