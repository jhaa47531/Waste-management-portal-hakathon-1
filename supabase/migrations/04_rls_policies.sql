-- ============================================================================
-- 04_rls_policies.sql
-- Waste Pickup Request Portal: Row Level Security (RLS) Policies
-- Execution Order: 4 of 5
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.localities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaner_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaner_service_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_status_history ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 1. Profiles Table Policies
-- ----------------------------------------------------------------------------
-- Users can view their own profile; supervisors & admins can view all profiles;
-- cleaners can be viewed by supervisors/admins for assignment purposes.
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (
    id = auth.uid() OR
    public.current_user_role() IN ('supervisor', 'admin')
);

-- Users can update basic details of their own profile (name, phone)
-- But CANNOT modify their own role or account_status
DROP POLICY IF EXISTS "Users can update basic profile" ON public.profiles;
CREATE POLICY "Users can update basic profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
    id = auth.uid()
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    AND account_status = (SELECT account_status FROM public.profiles WHERE id = auth.uid())
);

-- Admin can manage all profiles
DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;
CREATE POLICY "Admins can manage profiles"
ON public.profiles FOR ALL
TO authenticated
USING (public.current_user_role() = 'admin')
WITH CHECK (public.current_user_role() = 'admin');

-- ----------------------------------------------------------------------------
-- 2. Localities Table Policies
-- ----------------------------------------------------------------------------
-- Everyone authenticated can read active localities for the dropdown
DROP POLICY IF EXISTS "Read active localities" ON public.localities;
CREATE POLICY "Read active localities"
ON public.localities FOR SELECT
TO authenticated
USING (active = TRUE OR public.current_user_role() IN ('supervisor', 'admin'));

-- Only Admin can modify localities
DROP POLICY IF EXISTS "Admin modify localities" ON public.localities;
CREATE POLICY "Admin modify localities"
ON public.localities FOR ALL
TO authenticated
USING (public.current_user_role() = 'admin')
WITH CHECK (public.current_user_role() = 'admin');

-- ----------------------------------------------------------------------------
-- 3. Cleaner Applications Policies
-- ----------------------------------------------------------------------------
-- Cleaner applicant can read their own application
DROP POLICY IF EXISTS "Cleaners read own application" ON public.cleaner_applications;
CREATE POLICY "Cleaners read own application"
ON public.cleaner_applications FOR SELECT
TO authenticated
USING (cleaner_id = auth.uid() OR public.current_user_role() IN ('supervisor', 'admin'));

-- Authenticated user can submit cleaner application for themselves
DROP POLICY IF EXISTS "Users create own cleaner application" ON public.cleaner_applications;
CREATE POLICY "Users create own cleaner application"
ON public.cleaner_applications FOR INSERT
TO authenticated
WITH CHECK (cleaner_id = auth.uid() AND status = 'pending');

-- ----------------------------------------------------------------------------
-- 4. Cleaner Service Areas Policies
-- ----------------------------------------------------------------------------
-- Cleaners can see their own service areas; supervisors/admins see all
DROP POLICY IF EXISTS "Read cleaner service areas" ON public.cleaner_service_areas;
CREATE POLICY "Read cleaner service areas"
ON public.cleaner_service_areas FOR SELECT
TO authenticated
USING (cleaner_id = auth.uid() OR public.current_user_role() IN ('supervisor', 'admin'));

-- Cleaners can propose new service areas (is_approved must be FALSE on insert)
DROP POLICY IF EXISTS "Cleaners propose service areas" ON public.cleaner_service_areas;
CREATE POLICY "Cleaners propose service areas"
ON public.cleaner_service_areas FOR INSERT
TO authenticated
WITH CHECK (cleaner_id = auth.uid() AND is_approved = FALSE);

-- Only supervisor or admin can approve service areas
DROP POLICY IF EXISTS "Staff approve service areas" ON public.cleaner_service_areas;
CREATE POLICY "Staff approve service areas"
ON public.cleaner_service_areas FOR UPDATE
TO authenticated
USING (public.current_user_role() IN ('supervisor', 'admin'))
WITH CHECK (public.current_user_role() IN ('supervisor', 'admin'));

-- ----------------------------------------------------------------------------
-- 5. Complaints Table Policies
-- ----------------------------------------------------------------------------
-- SELECT:
-- Resident can view ONLY their own complaints
-- Cleaner can view ONLY complaints assigned to them
-- Supervisor & Admin can view ALL complaints
DROP POLICY IF EXISTS "Complaints select policy" ON public.complaints;
CREATE POLICY "Complaints select policy"
ON public.complaints FOR SELECT
TO authenticated
USING (
    (resident_id = auth.uid()) OR
    (assigned_cleaner_id = auth.uid()) OR
    (public.current_user_role() IN ('supervisor', 'admin'))
);

-- INSERT:
-- Residents can create complaints for themselves in 'submitted' status
DROP POLICY IF EXISTS "Residents insert complaints" ON public.complaints;
CREATE POLICY "Residents insert complaints"
ON public.complaints FOR INSERT
TO authenticated
WITH CHECK (
    resident_id = auth.uid()
    AND status = 'submitted'
    AND assigned_cleaner_id IS NULL
    AND supervisor_id IS NULL
    AND rejection_reason IS NULL
);

-- Direct UPDATE on complaints:
-- Prevent residents and cleaners from updating complaints directly!
-- All status transitions must go through secure RPC functions (verify, reject, assign, etc.)
DROP POLICY IF EXISTS "Admin and Supervisor update complaints" ON public.complaints;
CREATE POLICY "Admin and Supervisor update complaints"
ON public.complaints FOR UPDATE
TO authenticated
USING (public.current_user_role() IN ('supervisor', 'admin'))
WITH CHECK (public.current_user_role() IN ('supervisor', 'admin'));

-- ----------------------------------------------------------------------------
-- 6. Complaint Photos Policies
-- ----------------------------------------------------------------------------
-- SELECT:
-- Viewable if user has access to the underlying complaint
DROP POLICY IF EXISTS "Complaint photos select policy" ON public.complaint_photos;
CREATE POLICY "Complaint photos select policy"
ON public.complaint_photos FOR SELECT
TO authenticated
USING (
    public.current_user_role() IN ('supervisor', 'admin')
    OR EXISTS (
        SELECT 1 FROM public.complaints c
        WHERE c.id = complaint_photos.complaint_id
        AND (c.resident_id = auth.uid() OR c.assigned_cleaner_id = auth.uid())
    )
);

-- INSERT:
-- Initial photo upload by resident during complaint creation
-- Cleaner completion photo upload via RPC / assigned cleaner check
DROP POLICY IF EXISTS "Complaint photos insert policy" ON public.complaint_photos;
CREATE POLICY "Complaint photos insert policy"
ON public.complaint_photos FOR INSERT
TO authenticated
WITH CHECK (
    uploader_id = auth.uid()
    AND (
        (photo_type = 'resident_initial' AND EXISTS (
            SELECT 1 FROM public.complaints c
            WHERE c.id = complaint_photos.complaint_id AND c.resident_id = auth.uid()
        ))
        OR (photo_type = 'cleaner_completion' AND EXISTS (
            SELECT 1 FROM public.complaints c
            WHERE c.id = complaint_photos.complaint_id AND c.assigned_cleaner_id = auth.uid()
        ))
    )
);

-- ----------------------------------------------------------------------------
-- 7. Complaint Status History (Audit Log) Policies
-- Strictly append-only, immutable! No UPDATE or DELETE allowed by anyone.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Status history select policy" ON public.complaint_status_history;
CREATE POLICY "Status history select policy"
ON public.complaint_status_history FOR SELECT
TO authenticated
USING (
    public.current_user_role() IN ('supervisor', 'admin')
    OR EXISTS (
        SELECT 1 FROM public.complaints c
        WHERE c.id = complaint_status_history.complaint_id
        AND (c.resident_id = auth.uid() OR c.assigned_cleaner_id = auth.uid())
    )
);

-- History inserts occur via triggers or security definer RPCs.
-- Block direct client inserts/updates/deletes on status history:
-- No INSERT policy for regular authenticated users (trigger uses SECURITY DEFINER).
-- No UPDATE or DELETE policy exists at all!
