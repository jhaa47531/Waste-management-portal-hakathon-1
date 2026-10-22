-- ============================================================================
-- 03_functions_and_triggers.sql
-- Waste Pickup Request Portal: Triggers, Constraints & Secure RPC Functions
-- Execution Order: 3 of 5
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Unique Human-Readable Tracking Code Generator
-- Format: WPR-YYMMDD-XXXX (e.g., WPR-261022-A7K9)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_tracking_code()
RETURNS TEXT AS $$
DECLARE
    date_part TEXT;
    random_part TEXT;
    candidate_code TEXT;
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Excludes ambiguous characters (0, O, 1, I)
    collision_count INTEGER := 0;
BEGIN
    date_part := to_char(timezone('utc'::text, now()), 'YYMMDD');
    LOOP
        random_part := '';
        FOR i IN 1..4 LOOP
            random_part := random_part || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
        END LOOP;
        candidate_code := 'WPR-' || date_part || '-' || random_part;

        -- Verify candidate does not already exist
        IF NOT EXISTS (SELECT 1 FROM public.complaints WHERE tracking_code = candidate_code) THEN
            RETURN candidate_code;
        END IF;

        collision_count := collision_count + 1;
        IF collision_count > 100 THEN
            RAISE EXCEPTION 'Failed to generate unique tracking code after 100 attempts.';
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- ----------------------------------------------------------------------------
-- 2. Safe Auth Profile Creation Trigger
-- Public signups MUST always have role 'resident' and status 'active'.
-- Raw metadata is NEVER trusted for role assignment.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_full_name TEXT;
    v_phone TEXT;
BEGIN
    -- Extract clean full name and phone from metadata or use safe defaults
    v_full_name := coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'Resident ' || substr(new.id::text, 1, 6));
    v_phone := coalesce(nullif(trim(new.raw_user_meta_data->>'phone_number'), ''), '0000000000');

    INSERT INTO public.profiles (
        id,
        full_name,
        phone_number,
        role,
        account_status,
        created_at,
        updated_at
    )
    VALUES (
        new.id,
        v_full_name,
        v_phone,
        'resident', -- ALWAYS resident for public signup; elevated roles require explicit admin action
        'active',
        now(),
        now()
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 3. Automatic Status History Trigger
-- Creates an immutable audit entry whenever status changes or a complaint is created
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_complaint_status_change()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_id UUID;
BEGIN
    v_actor_id := coalesce(auth.uid(), NEW.resident_id);

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
            'Initial complaint submission',
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
            coalesce(NEW.supervisor_notes, NEW.rejection_reason, 'Status updated'),
            now()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_complaint_status ON public.complaints;
CREATE TRIGGER trg_audit_complaint_status
    AFTER INSERT OR UPDATE OF status ON public.complaints
    FOR EACH ROW EXECUTE FUNCTION public.audit_complaint_status_change();

-- ----------------------------------------------------------------------------
-- 4. Secure RPC Functions for Complaint Lifecycle Transitions
-- ----------------------------------------------------------------------------

-- A. Supervisor records phone confirmation & verifies complaint
CREATE OR REPLACE FUNCTION public.verify_complaint(
    p_complaint_id UUID,
    p_urgency urgency_level DEFAULT 'normal',
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_caller_role user_role;
    v_complaint public.complaints%ROWTYPE;
BEGIN
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    IF v_caller_role NOT IN ('supervisor', 'admin') THEN
        RAISE EXCEPTION 'Access denied: Only a supervisor or admin can verify complaints.';
    END IF;

    SELECT * INTO v_complaint FROM public.complaints WHERE id = p_complaint_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Complaint not found.';
    END IF;

    IF v_complaint.status != 'submitted' THEN
        RAISE EXCEPTION 'Invalid transition: Only complaints in "submitted" status can be verified. Current status: %', v_complaint.status;
    END IF;

    UPDATE public.complaints
    SET 
        status = 'verified',
        urgency = p_urgency,
        supervisor_id = auth.uid(),
        supervisor_notes = p_notes,
        resident_confirmed_at = now(),
        updated_at = now()
    WHERE id = p_complaint_id;

    RETURN jsonb_build_object('success', true, 'status', 'verified');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B. Supervisor rejects complaint with required reason
CREATE OR REPLACE FUNCTION public.reject_complaint(
    p_complaint_id UUID,
    p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_caller_role user_role;
    v_complaint public.complaints%ROWTYPE;
BEGIN
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    IF v_caller_role NOT IN ('supervisor', 'admin') THEN
        RAISE EXCEPTION 'Access denied: Only a supervisor or admin can reject complaints.';
    END IF;

    IF p_reason IS NULL OR char_length(trim(p_reason)) < 5 THEN
        RAISE EXCEPTION 'A clear rejection reason (at least 5 characters) is required.';
    END IF;

    SELECT * INTO v_complaint FROM public.complaints WHERE id = p_complaint_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Complaint not found.';
    END IF;

    IF v_complaint.status NOT IN ('submitted', 'verified') THEN
        RAISE EXCEPTION 'Invalid transition: Cannot reject complaint in current status: %', v_complaint.status;
    END IF;

    UPDATE public.complaints
    SET 
        status = 'rejected',
        supervisor_id = auth.uid(),
        rejection_reason = trim(p_reason),
        updated_at = now()
    WHERE id = p_complaint_id;

    RETURN jsonb_build_object('success', true, 'status', 'rejected');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- C. Supervisor assigns complaint to an approved cleaner with matching approved service area
CREATE OR REPLACE FUNCTION public.assign_cleaner(
    p_complaint_id UUID,
    p_cleaner_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_caller_role user_role;
    v_complaint public.complaints%ROWTYPE;
    v_cleaner public.profiles%ROWTYPE;
    v_area_approved BOOLEAN;
BEGIN
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    IF v_caller_role NOT IN ('supervisor', 'admin') THEN
        RAISE EXCEPTION 'Access denied: Only a supervisor or admin can assign cleaners.';
    END IF;

    SELECT * INTO v_complaint FROM public.complaints WHERE id = p_complaint_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Complaint not found.';
    END IF;

    IF v_complaint.status NOT IN ('verified', 'assigned') THEN
        RAISE EXCEPTION 'A complaint must be verified before assigning a cleaner. Current status: %', v_complaint.status;
    END IF;

    -- Validate cleaner existence and role
    SELECT * INTO v_cleaner FROM public.profiles WHERE id = p_cleaner_id;
    IF NOT FOUND OR v_cleaner.role != 'cleaner' OR v_cleaner.account_status != 'active' THEN
        RAISE EXCEPTION 'Selected user is not an active, approved cleaner.';
    END IF;

    -- Verify that the cleaner has an approved service area matching this complaint locality
    SELECT is_approved INTO v_area_approved
    FROM public.cleaner_service_areas
    WHERE cleaner_id = p_cleaner_id AND locality_id = v_complaint.locality_id;

    IF v_area_approved IS NOT TRUE THEN
        RAISE EXCEPTION 'Cleaner does not have an approved service area for this complaint locality.';
    END IF;

    UPDATE public.complaints
    SET 
        status = 'assigned',
        assigned_cleaner_id = p_cleaner_id,
        supervisor_id = auth.uid(),
        supervisor_notes = coalesce(p_notes, supervisor_notes),
        updated_at = now()
    WHERE id = p_complaint_id;

    RETURN jsonb_build_object('success', true, 'status', 'assigned', 'cleaner_id', p_cleaner_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- D. Cleaner marks work as in progress
CREATE OR REPLACE FUNCTION public.start_complaint_progress(
    p_complaint_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_complaint public.complaints%ROWTYPE;
BEGIN
    SELECT * INTO v_complaint FROM public.complaints WHERE id = p_complaint_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Complaint not found.';
    END IF;

    -- Enforce that ONLY the assigned cleaner can start work
    IF v_complaint.assigned_cleaner_id != auth.uid() THEN
        RAISE EXCEPTION 'Access denied: Only the assigned cleaner can mark this complaint in progress.';
    END IF;

    IF v_complaint.status != 'assigned' AND v_complaint.status != 'awaiting_verification' THEN
        RAISE EXCEPTION 'Complaint cannot transition to in_progress from status: %', v_complaint.status;
    END IF;

    UPDATE public.complaints
    SET 
        status = 'in_progress',
        updated_at = now()
    WHERE id = p_complaint_id;

    RETURN jsonb_build_object('success', true, 'status', 'in_progress');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- E. Cleaner submits completion evidence (requires after-photo)
CREATE OR REPLACE FUNCTION public.submit_cleaner_completion(
    p_complaint_id UUID,
    p_photo_path TEXT,
    p_mime_type TEXT,
    p_file_size INTEGER,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_complaint public.complaints%ROWTYPE;
BEGIN
    SELECT * INTO v_complaint FROM public.complaints WHERE id = p_complaint_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Complaint not found.';
    END IF;

    IF v_complaint.assigned_cleaner_id != auth.uid() THEN
        RAISE EXCEPTION 'Access denied: Only the assigned cleaner can submit completion evidence.';
    END IF;

    IF v_complaint.status != 'in_progress' THEN
        RAISE EXCEPTION 'Complaint must be in_progress before submitting completion evidence. Current status: %', v_complaint.status;
    END IF;

    IF p_photo_path IS NULL OR trim(p_photo_path) = '' THEN
        RAISE EXCEPTION 'An after-cleaning photo is mandatory to submit completion.';
    END IF;

    -- Record after-cleaning photo
    INSERT INTO public.complaint_photos (
        complaint_id,
        uploader_id,
        photo_type,
        storage_path,
        mime_type,
        file_size_bytes
    ) VALUES (
        p_complaint_id,
        auth.uid(),
        'cleaner_completion',
        p_photo_path,
        p_mime_type,
        p_file_size
    );

    UPDATE public.complaints
    SET 
        status = 'awaiting_verification',
        updated_at = now()
    WHERE id = p_complaint_id;

    RETURN jsonb_build_object('success', true, 'status', 'awaiting_verification');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- F. Supervisor reviews completion and approves completion
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
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    IF v_caller_role NOT IN ('supervisor', 'admin') THEN
        RAISE EXCEPTION 'Access denied: Only a supervisor or admin can approve completion.';
    END IF;

    SELECT * INTO v_complaint FROM public.complaints WHERE id = p_complaint_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Complaint not found.';
    END IF;

    IF v_complaint.status != 'awaiting_verification' THEN
        RAISE EXCEPTION 'Complaint must be awaiting verification. Current status: %', v_complaint.status;
    END IF;

    -- Verify after photo exists
    SELECT EXISTS (
        SELECT 1 FROM public.complaint_photos
        WHERE complaint_id = p_complaint_id AND photo_type = 'cleaner_completion'
    ) INTO v_has_after_photo;

    IF NOT v_has_after_photo THEN
        RAISE EXCEPTION 'Cannot approve completion: Mandatory after-cleaning photo is missing.';
    END IF;

    UPDATE public.complaints
    SET 
        status = 'completed',
        supervisor_notes = coalesce(p_notes, supervisor_notes),
        updated_at = now()
    WHERE id = p_complaint_id;

    RETURN jsonb_build_object('success', true, 'status', 'completed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- G. Supervisor returns inadequate completion evidence to in_progress with explanatory note
CREATE OR REPLACE FUNCTION public.return_to_progress(
    p_complaint_id UUID,
    p_notes TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_caller_role user_role;
    v_complaint public.complaints%ROWTYPE;
BEGIN
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    IF v_caller_role NOT IN ('supervisor', 'admin') THEN
        RAISE EXCEPTION 'Access denied: Only a supervisor or admin can return completion to in progress.';
    END IF;

    IF p_notes IS NULL OR char_length(trim(p_notes)) < 5 THEN
        RAISE EXCEPTION 'An explanatory note is required when returning work to in progress.';
    END IF;

    SELECT * INTO v_complaint FROM public.complaints WHERE id = p_complaint_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Complaint not found.';
    END IF;

    IF v_complaint.status != 'awaiting_verification' THEN
        RAISE EXCEPTION 'Complaint must be awaiting verification to return to in progress. Current status: %', v_complaint.status;
    END IF;

    UPDATE public.complaints
    SET 
        status = 'in_progress',
        supervisor_notes = trim(p_notes),
        updated_at = now()
    WHERE id = p_complaint_id;

    RETURN jsonb_build_object('success', true, 'status', 'in_progress');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- H. Administrator provisions or promotes a user to Supervisor
CREATE OR REPLACE FUNCTION public.provision_supervisor(
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_caller_role user_role;
BEGIN
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    IF v_caller_role != 'admin' THEN
        RAISE EXCEPTION 'Access denied: Only administrators can provision supervisor accounts.';
    END IF;

    UPDATE public.profiles
    SET 
        role = 'supervisor',
        account_status = 'active',
        updated_at = now()
    WHERE id = p_user_id;

    RETURN jsonb_build_object('success', true, 'user_id', p_user_id, 'role', 'supervisor');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- I. Administrator or Supervisor approves a cleaner application and service areas
CREATE OR REPLACE FUNCTION public.review_cleaner_application(
    p_application_id UUID,
    p_decision TEXT, -- 'approved' or 'rejected'
    p_approved_locality_ids UUID[] DEFAULT ARRAY[]::UUID[],
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_caller_role user_role;
    v_app public.cleaner_applications%ROWTYPE;
    v_loc_id UUID;
BEGIN
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    IF v_caller_role NOT IN ('admin', 'supervisor') THEN
        RAISE EXCEPTION 'Access denied: Only staff can review cleaner applications.';
    END IF;

    SELECT * INTO v_app FROM public.cleaner_applications WHERE id = p_application_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cleaner application not found.';
    END IF;

    IF p_decision NOT IN ('approved', 'rejected') THEN
        RAISE EXCEPTION 'Invalid decision: must be approved or rejected.';
    END IF;

    UPDATE public.cleaner_applications
    SET 
        status = p_decision,
        reviewer_id = auth.uid(),
        review_notes = p_notes,
        reviewed_at = now()
    WHERE id = p_application_id;

    IF p_decision = 'approved' THEN
        UPDATE public.profiles
        SET 
            role = 'cleaner',
            account_status = 'active',
            updated_at = now()
        WHERE id = v_app.cleaner_id;

        -- Approve selected localities
        FOREACH v_loc_id IN ARRAY p_approved_locality_ids LOOP
            UPDATE public.cleaner_service_areas
            SET 
                is_approved = TRUE,
                approved_by = auth.uid(),
                approved_at = now()
            WHERE cleaner_id = v_app.cleaner_id AND locality_id = v_loc_id;
        END LOOP;
    END IF;

    RETURN jsonb_build_object('success', true, 'status', p_decision);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
