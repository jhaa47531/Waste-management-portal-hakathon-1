-- ============================================================================
-- 02_storage_setup.sql
-- Waste Pickup Request Portal: Supabase Storage Configuration
-- Execution Order: 2 of 5
-- Target Private Bucket: waste-complaint-photos
-- ============================================================================

-- 1. Ensure private bucket 'waste-complaint-photos' exists with strict constraints
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'waste-complaint-photos',
    'waste-complaint-photos',
    FALSE,
    3145728, -- 3 MB limit (3 * 1024 * 1024 bytes)
    ARRAY['image/jpeg', 'image/png', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET
    public = FALSE,
    file_size_limit = 3145728,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/jpg'];

-- ----------------------------------------------------------------------------
-- 2. Role Helper Function (Preserves user_role type and secures search_path)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- ----------------------------------------------------------------------------
-- 3. Replace only existing policies for the 'waste-complaint-photos' bucket
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow authenticated users upload to their folder" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users update their folder" ON storage.objects;
DROP POLICY IF EXISTS "Storage read access policy" ON storage.objects;
DROP POLICY IF EXISTS "Storage delete policy" ON storage.objects;

-- ----------------------------------------------------------------------------
-- 4. INSERT Policy: Scoped by bucket and role-specific UUID folder
-- ----------------------------------------------------------------------------
CREATE POLICY "Allow authenticated users upload to their folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'waste-complaint-photos' AND (
        -- Resident initial complaint evidence: strictly residents/{auth.uid()}/<filename>
        (
            split_part(name, '/', 1) = 'residents'
            AND split_part(name, '/', 2) = auth.uid()::text
            AND split_part(name, '/', 3) != ''
        )
        -- Cleaner completion evidence: strictly cleaners/{auth.uid()}/<filename>
        OR (
            split_part(name, '/', 1) = 'cleaners'
            AND split_part(name, '/', 2) = auth.uid()::text
            AND split_part(name, '/', 3) != ''
        )
        -- Staff oversight: supervisors and administrators
        OR public.current_user_role() IN ('supervisor', 'admin')
    )
);

-- ----------------------------------------------------------------------------
-- 5. UPDATE Policy: Scoped by bucket and role-specific UUID folder
-- (Guarantees upsert operations or metadata updates never fail with RLS errors)
-- ----------------------------------------------------------------------------
CREATE POLICY "Allow authenticated users update their folder"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'waste-complaint-photos' AND (
        (
            split_part(name, '/', 1) IN ('residents', 'cleaners')
            AND split_part(name, '/', 2) = auth.uid()::text
        )
        OR public.current_user_role() IN ('supervisor', 'admin')
    )
)
WITH CHECK (
    bucket_id = 'waste-complaint-photos' AND (
        (
            split_part(name, '/', 1) IN ('residents', 'cleaners')
            AND split_part(name, '/', 2) = auth.uid()::text
        )
        OR public.current_user_role() IN ('supervisor', 'admin')
    )
);

-- ----------------------------------------------------------------------------
-- 6. SELECT Policy: Scoped by complaint ownership, assignment, or staff role
-- ----------------------------------------------------------------------------
CREATE POLICY "Storage read access policy"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'waste-complaint-photos' AND (
        -- Supervisors and Administrators can audit all evidence
        public.current_user_role() IN ('supervisor', 'admin')
        -- Uploader viewing their own folder contents
        OR (
            split_part(name, '/', 1) IN ('residents', 'cleaners')
            AND split_part(name, '/', 2) = auth.uid()::text
        )
        OR owner = auth.uid()
        -- Resident viewing photos linked to their complaints
        OR EXISTS (
            SELECT 1 FROM public.complaint_photos cp
            JOIN public.complaints c ON c.id = cp.complaint_id
            WHERE cp.storage_path = storage.objects.name
            AND c.resident_id = auth.uid()
        )
        -- Cleaner viewing photos for assigned complaints
        OR EXISTS (
            SELECT 1 FROM public.complaint_photos cp
            JOIN public.complaints c ON c.id = cp.complaint_id
            WHERE cp.storage_path = storage.objects.name
            AND c.assigned_cleaner_id = auth.uid()
        )
    )
);

-- ----------------------------------------------------------------------------
-- 7. DELETE Policy: Scoped by staff oversight and uploader rollback
-- ----------------------------------------------------------------------------
CREATE POLICY "Storage delete policy"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'waste-complaint-photos' AND (
        public.current_user_role() IN ('supervisor', 'admin')
        -- Uploaders can clean up their own files if database transaction fails
        OR (
            split_part(name, '/', 1) IN ('residents', 'cleaners')
            AND split_part(name, '/', 2) = auth.uid()::text
        )
        OR owner = auth.uid()
    )
);
