-- ============================================================================
-- 08_fix_supervisor_resolution_and_photos.sql
-- Waste Pickup Request Portal: Supervisor Resolution RPCs & Photo Types Fix
-- Target Functions:
--   1. public.return_to_progress(p_complaint_id UUID, p_notes TEXT)
--   2. public.approve_completion(p_complaint_id UUID, p_notes TEXT)
-- Target Schema:
--   public.complaints uses 'supervisor_note' (singular)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Ensure photo_type enum includes standard DB values ('resident_report',
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
-- 2. Ensure public.complaints has the verified column 'supervisor_note' (singular)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'complaints' AND column_name = 'supervisor_note'
    ) THEN
        ALTER TABLE public.complaints ADD COLUMN supervisor_note TEXT;
    END IF;

    -- Backfill from legacy supervisor_notes if it exists and supervisor_note is null
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'complaints' AND column_name = 'supervisor_notes'
    ) THEN
        UPDATE public.complaints 
        SET supervisor_note = supervisor_notes 
        WHERE supervisor_note IS NULL AND supervisor_notes IS NOT NULL;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. Update Audit Trigger function to support 'supervisor_note' without schema errors
-- Preserves existing trg_audit_complaint_status trigger; does NOT duplicate audit records.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_complaint_status_change()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_id UUID;
    v_note TEXT;
BEGIN
    v_actor_id := coalesce(auth.uid(), NEW.resident_id);

    -- Safely resolve note using jsonb conversion to accommodate either supervisor_note or supervisor_notes
    v_note := coalesce(
        to_jsonb(NEW)->>'supervisor_note',
        to_jsonb(NEW)->>'supervisor_notes',
        NEW.rejection_reason,
        'Status updated'
    );

    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.complaint_status_history (
            complaint_id,
            previous_status,
            new_status,
            actor_id,
            note,
            created_at
        ) VALUES (
            NEW.id,
            NULL,
            NEW.status,
            v_actor_id,
            coalesce(to_jsonb(NEW)->>'remark', 'Initial complaint submission'),
            now()
        );
    ELSIF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO public.complaint_status_history (
            complaint_id,
            previous_status,
            new_status,
            actor_id,
            note,
            created_at
        ) VALUES (
            NEW.id,
            OLD.status,
            NEW.status,
            v_actor_id,
            v_note,
            now()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ----------------------------------------------------------------------------
-- 4. Implement public.return_to_progress
-- Allows an authorized supervisor/administrator to return a complaint from
-- 'awaiting_verification' back to 'in_progress' with an explanatory note.
-- Uses the verified schema column 'supervisor_note'.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.return_to_progress(
    p_complaint_id UUID,
    p_notes TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_caller_role TEXT;
    v_caller_status TEXT;
    v_complaint public.complaints%ROWTYPE;
BEGIN
    -- Authorization Check: Active supervisor, administrator, or admin
    SELECT role::text, account_status::text 
    INTO v_caller_role, v_caller_status 
    FROM public.profiles 
    WHERE id = auth.uid();

    IF v_caller_role IS NULL 
       OR v_caller_role NOT IN ('supervisor', 'admin', 'administrator') 
       OR v_caller_status != 'active' THEN
        RAISE EXCEPTION 'Access denied: Only an active supervisor or administrator can return a complaint to in-progress.';
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

    -- Update complaint status and supervisor rework instructions using verified column 'supervisor_note'
    UPDATE public.complaints
    SET 
        status = 'in_progress',
        supervisor_note = trim(p_notes),
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
-- 5. Implement public.approve_completion
-- Validates supervisor authorization, verifies that complaint is in
-- 'awaiting_verification', checks that completion photo proof exists
-- (supporting both 'cleaner_after' and 'cleaner_completion'), and transitions to 'completed'.
-- Uses the verified schema column 'supervisor_note'.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_completion(
    p_complaint_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_caller_role TEXT;
    v_caller_status TEXT;
    v_complaint public.complaints%ROWTYPE;
    v_has_after_photo BOOLEAN;
BEGIN
    -- Authorization Check: Active supervisor, administrator, or admin
    SELECT role::text, account_status::text 
    INTO v_caller_role, v_caller_status 
    FROM public.profiles 
    WHERE id = auth.uid();

    IF v_caller_role IS NULL 
       OR v_caller_role NOT IN ('supervisor', 'admin', 'administrator') 
       OR v_caller_status != 'active' THEN
        RAISE EXCEPTION 'Access denied: Only an active supervisor or administrator can approve complaint completion.';
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

    -- Update complaint status to completed using verified column 'supervisor_note'
    UPDATE public.complaints
    SET 
        status = 'completed',
        supervisor_note = coalesce(trim(p_notes), supervisor_note),
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
-- 6. Grant explicit EXECUTE permissions to authenticated and service_role
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.return_to_progress(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_completion(UUID, TEXT) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 7. Force PostgREST schema cache reload so RPC calls immediately discover the functions
-- ----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
