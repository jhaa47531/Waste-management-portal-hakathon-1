-- ============================================================================
-- 01_initial_schema.sql
-- Waste Pickup Request Portal: Initial Database Schema
-- Execution Order: 1 of 5
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- User Roles & Account Status ENUM Types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('resident', 'cleaner', 'supervisor', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE account_status AS ENUM ('active', 'pending', 'suspended');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE complaint_status AS ENUM (
        'submitted',
        'verified',
        'assigned',
        'in_progress',
        'awaiting_verification',
        'completed',
        'rejected'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE urgency_level AS ENUM ('low', 'normal', 'high', 'critical');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE photo_type AS ENUM ('resident_initial', 'cleaner_completion');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ----------------------------------------------------------------------------
-- 1. Profiles Table (Linked to auth.users)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL CHECK (char_length(trim(full_name)) >= 2),
    phone_number TEXT NOT NULL CHECK (char_length(trim(phone_number)) >= 7),
    role user_role NOT NULL DEFAULT 'resident',
    account_status account_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for fast lookup by role
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(account_status);

-- ----------------------------------------------------------------------------
-- 2. Localities Table (Controlled list)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.localities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE CHECK (char_length(trim(name)) >= 2),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_localities_active ON public.localities(active);

-- ----------------------------------------------------------------------------
-- 3. Cleaner Applications Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cleaner_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cleaner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    review_notes TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(cleaner_id)
);

CREATE INDEX IF NOT EXISTS idx_cleaner_applications_status ON public.cleaner_applications(status);

-- ----------------------------------------------------------------------------
-- 4. Cleaner Service Areas Table
-- Self-selected localities must NOT automatically become approved
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cleaner_service_areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cleaner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    locality_id UUID NOT NULL REFERENCES public.localities(id) ON DELETE CASCADE,
    is_approved BOOLEAN NOT NULL DEFAULT FALSE,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(cleaner_id, locality_id)
);

CREATE INDEX IF NOT EXISTS idx_cleaner_service_areas_lookup 
    ON public.cleaner_service_areas(cleaner_id, locality_id, is_approved);

-- ----------------------------------------------------------------------------
-- 5. Complaints Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracking_code TEXT NOT NULL UNIQUE CHECK (tracking_code ~ '^WPR-[0-9]{6}-[A-Z0-9]{4}$'),
    resident_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    resident_name TEXT NOT NULL,
    resident_phone TEXT NOT NULL,
    address TEXT NOT NULL CHECK (char_length(trim(address)) >= 5),
    locality_id UUID NOT NULL REFERENCES public.localities(id) ON DELETE RESTRICT,
    latitude DOUBLE PRECISION NOT NULL CHECK (latitude >= -90.0 AND latitude <= 90.0),
    longitude DOUBLE PRECISION NOT NULL CHECK (longitude >= -180.0 AND longitude <= 180.0),
    waste_type TEXT NOT NULL CHECK (waste_type IN ('household', 'plastic', 'e_waste', 'hazardous', 'construction', 'organic', 'other')),
    remark TEXT,
    status complaint_status NOT NULL DEFAULT 'submitted',
    urgency urgency_level NOT NULL DEFAULT 'normal',
    assigned_cleaner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    supervisor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    rejection_reason TEXT,
    supervisor_notes TEXT,
    resident_confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_resident ON public.complaints(resident_id);
CREATE INDEX IF NOT EXISTS idx_complaints_cleaner ON public.complaints(assigned_cleaner_id);
CREATE INDEX IF NOT EXISTS idx_complaints_locality ON public.complaints(locality_id);
CREATE INDEX IF NOT EXISTS idx_complaints_tracking ON public.complaints(tracking_code);
CREATE INDEX IF NOT EXISTS idx_complaints_created ON public.complaints(created_at DESC);

-- ----------------------------------------------------------------------------
-- 6. Complaint Photos Table
-- Private storage references; binaries are NOT stored in PostgreSQL
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.complaint_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    uploader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    photo_type photo_type NOT NULL,
    storage_path TEXT NOT NULL UNIQUE,
    mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/jpg', 'image/png')),
    file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 3145728), -- 3 MB limit
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_complaint_photos_complaint ON public.complaint_photos(complaint_id);
CREATE INDEX IF NOT EXISTS idx_complaint_photos_type ON public.complaint_photos(complaint_id, photo_type);

-- ----------------------------------------------------------------------------
-- 7. Complaint Status History (Audit Log)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.complaint_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    previous_status complaint_status,
    new_status complaint_status NOT NULL,
    actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_complaint_history_complaint ON public.complaint_status_history(complaint_id);
CREATE INDEX IF NOT EXISTS idx_complaint_history_created ON public.complaint_status_history(created_at DESC);
