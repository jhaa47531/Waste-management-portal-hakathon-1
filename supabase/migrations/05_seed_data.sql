-- ============================================================================
-- 05_seed_data.sql
-- Waste Pickup Request Portal: Initial Seed Localities & Reference Data
-- Execution Order: 5 of 5
-- ============================================================================

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
