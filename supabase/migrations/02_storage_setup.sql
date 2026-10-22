-- ============================================================================
-- 02_storage_setup.sql
-- Waste Pickup Request Portal: Supabase Storage Configuration
-- Execution Order: 2 of 5
-- Target Private Bucket: waste-complaint-photos
-- ============================================================================

-- Create private bucket 'waste-complaint-photos'
-- Public access is FALSE (private bucket, accessible only via RLS/signed URLs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'waste-complaint-photos',
    'waste-complaint-photos',
    FALSE,
    3145728, -- 3MB limit
    ARRAY['image/jpeg', 'image/png', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET
    public = FALSE,
    file_size_limit = 3145728,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/jpg'];

-- ----------------------------------------------------------------------------
-- Storage RLS Policies
-- ----------------------------------------------------------------------------

-- Helper function to check user role from auth.uid()
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 1. Storage Upload Policy:
-- Residents can upload to /residents/{auth.uid()}/*
-- Cleaners can upload to /cleaners/{auth.uid()}/*
DROP POLICY IF EXISTS "Allow authenticated users upload to their folder" ON storage.objects;
CREATE POLICY "Allow authenticated users upload to their folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id IN ('waste-complaint-photos', 'complaint-photos') AND (
        (auth.uid()::text = (storage.foldername(name))[2] AND (storage.foldername(name))[1] IN ('residents', 'cleaners'))
        OR public.current_user_role() IN ('supervisor', 'admin')
    )
);

-- 2. Storage Read Policy:
-- Residents can view photos of complaints they own
-- Cleaners can view photos of complaints assigned to them
-- Supervisors and Admins can view all complaint photos
DROP POLICY IF EXISTS "Storage read access policy" ON storage.objects;
CREATE POLICY "Storage read access policy"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id IN ('waste-complaint-photos', 'complaint-photos') AND (
        public.current_user_role() IN ('supervisor', 'admin')
        OR (
            -- Resident viewing their own complaint photos
            EXISTS (
                SELECT 1 FROM public.complaint_photos cp
                JOIN public.complaints c ON c.id = cp.complaint_id
                WHERE cp.storage_path = storage.objects.name
                AND c.resident_id = auth.uid()
            )
        )
        OR (
            -- Cleaner viewing complaint photos for assigned complaints
            EXISTS (
                SELECT 1 FROM public.complaint_photos cp
                JOIN public.complaints c ON c.id = cp.complaint_id
                WHERE cp.storage_path = storage.objects.name
                AND c.assigned_cleaner_id = auth.uid()
            )
        )
    )
);

-- 3. Delete policy: Only supervisor / admin can delete or cleanup orphaned objects
DROP POLICY IF EXISTS "Storage delete policy" ON storage.objects;
CREATE POLICY "Storage delete policy"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id IN ('waste-complaint-photos', 'complaint-photos') AND
    public.current_user_role() IN ('supervisor', 'admin')
);
