# Supabase Database & Security Guide: Waste Pickup Request Portal

This document outlines the database architecture, schema migrations, Row Level Security (RLS) policies, Administrator provisioning, and manual testing checklist for the **Waste Pickup Request Portal**.

---

## 1. Execution Order of SQL Migrations

Run the SQL migration files in this exact sequential order in the **Supabase Dashboard SQL Editor** (or via `supabase db push` / `supabase migration up`):

| Order | Migration File | Description |
| :--- | :--- | :--- |
| **1** | `supabase/migrations/01_initial_schema.sql` | Enums, core tables (`profiles`, `localities`, `cleaner_applications`, `cleaner_service_areas`, `complaints`, `complaint_photos`, `complaint_status_history`), foreign keys, CHECK constraints, and performance indexes. |
| **2** | `supabase/migrations/02_storage_setup.sql` | Creates the private `waste-complaint-photos` bucket (max 3 MB, JPG/PNG), sets `public = FALSE`, and defines storage RLS policies for uploads/downloads. |
| **3** | `supabase/migrations/03_functions_and_triggers.sql` | Secure tracking code generator (`WPR-YYMMDD-XXXX`), `handle_new_user()` auth hook, automatic immutable status audit trigger, and atomic RPC transition functions (`verify_complaint`, `reject_complaint`, `assign_cleaner`, `start_complaint_progress`, `submit_cleaner_completion`, `approve_completion`, `return_to_progress`, `provision_supervisor`). |
| **4** | `supabase/migrations/04_rls_policies.sql` | Strict PostgreSQL Row Level Security (RLS) policies for all application tables preventing privilege escalation, unauthorized reads, and forged statuses. |
| **5** | `supabase/migrations/05_seed_data.sql` | Pre-populates municipal localities. |

---

## 2. Administrator Provisioning (`jhaa47531@gmail.com`)

In accordance with strict security standards, public user sign-ups are always assigned the `resident` role to prevent unauthorized privilege escalation. 

To configure the designated Administrator account:

1. **Sign up via the Portal UI:**
   - Click **Sign In** or **Register** on the portal.
   - Register an account with email: `jhaa47531@gmail.com` and your secure password.
2. **Promote to Administrator via SQL:**
   - In your **Supabase Dashboard SQL Editor**, execute:
   ```sql
   UPDATE public.profiles
   SET role = 'admin',
       account_status = 'active',
       full_name = COALESCE(full_name, 'Municipal Administrator')
   WHERE id = (
     SELECT id FROM auth.users WHERE email = 'jhaa47531@gmail.com'
   );
   ```
3. **Verify Privileges:**
   - Sign out and sign back in with `jhaa47531@gmail.com`.
   - The user will immediately be granted access to the **Administrator Console**, allowing them to provision municipal supervisors, review cleaner applications, authorize service localities, and inspect the system audit trail.

---

## 3. Storage Bucket Configuration

- **Bucket name:** `waste-complaint-photos`
- **Access:** **Private** (`public = false`)
- **File size limit:** `3,145,728` bytes (3 MB)
- **Allowed MIME types:** `image/jpeg`, `image/jpg`, `image/png`
- **Folder structure:**
  - Initial complaint: `residents/{resident_id}/{complaint_id}-initial.jpg`
  - Completion proof: `cleaners/{cleaner_id}/{complaint_id}-completion.jpg`

---

## 4. Environment Variables Setup

When connecting to your live Supabase instance:

1. In `.env.local` (or Vite runtime environment), configure:
   ```env
   VITE_SUPABASE_URL="https://<YOUR-PROJECT-REF>.supabase.co"
   VITE_SUPABASE_ANON_KEY="<YOUR-SUPABASE-ANON-KEY>"
   ```
2. **Security Rules:**
   - Never expose the `service_role` key in frontend code or environment variables.
   - Use the public anon key only. Row Level Security policies enforce all data isolation rules at the database engine level.

---

## 5. End-to-End Manual Testing Checklist (Fresh Empty State)

Follow this testing checklist to verify the full municipal workflow from an empty database state:

### Step 1: Resident Registration & Complaint Submission
1. Navigate to the portal as an unauthenticated guest. Verify that:
   - Dashboard shows clean zero-state (0 complaints).
   - No mock users or fake data are visible.
2. Click **Register Resident Account** and enter:
   - Full Name: `Test Resident`
   - Phone: `+1-555-0101`
   - Email: `resident.test@civicwaste.org`
   - Password: `Password123!`
3. In the Resident view:
   - Click **Capture GPS Location** (allow browser geolocation permission).
   - Fill in Street Address and select an active locality from the municipal ward list.
   - Select Waste Type (e.g., *Illegal Dumping*).
   - Upload a genuine photo (&le; 3 MB, JPG/PNG). Verify that photos > 3 MB are rejected.
   - Click **Submit Waste Pickup Complaint**.
4. Verify that:
   - A unique tracking ID (`WPR-YYMMDD-XXXX`) is issued.
   - The complaint appears in your "My Pickup Complaints" list with status `Submitted`.

### Step 2: Administrator & Supervisor Provisioning
1. Sign out of the resident account.
2. Log in as the Administrator (`jhaa47531@gmail.com`).
3. Under the **Provision Supervisors** tab:
   - Enter Supervisor Full Name (e.g., `Supervisor Davis`), Email (`davis@civicwaste.org`), and Phone (`+1-555-0122`).
   - Click **Provision Supervisor**.
   - Verify that the supervisor appears in the Authorized Municipal Supervisors list.

### Step 3: Cleaner Registration & Locality Authorization
1. Sign out and click **Register** to register a new cleaner:
   - Register email `cleaner.test@civicwaste.org`.
2. As Admin, switch to **Cleaner Approvals & Localities** tab:
   - Approve the cleaner application and select their authorized service localities.

### Step 4: Supervisor Review & Phone Verification
1. Sign out and log in with the provisioned supervisor account (`davis@civicwaste.org`).
2. Verify that the complaint filed in Step 1 appears in the Operational Queue under **1. New Submissions**.
3. Click on the complaint card:
   - Check the resident's contact telephone and location coordinates.
   - Check the checkbox **Confirm Resident Telephone Contact Completed**.
   - Set Urgency Level (e.g., *High*).
   - Click **Verify Complaint for Cleaner Dispatch**.
4. The complaint advances to status `Verified`.

### Step 5: Cleaner Assignment
1. In the supervisor view, select the verified complaint and choose **Assign Cleaner**:
   - Verify that only approved cleaners with matching locality coverage appear in the dropdown.
   - Select the approved cleaner and submit assignment.
2. The complaint moves to status `Assigned`.

### Step 6: Cleaner Execution & Completion Evidence
1. Sign out and log in as the assigned cleaner (`cleaner.test@civicwaste.org`).
2. Verify the task appears under **My Assigned Pickup Tasks**:
   - Non-assigned complaints are not visible.
   - Click **Navigate to Location** to test the Google Maps GPS navigation link.
   - Click **Start Pickup Work** (status transitions to `In Progress`).
   - In the completion form, upload the mandatory after-cleaning photo (&le; 3 MB).
   - Enter optional completion notes.
   - Click **Submit Completion for Supervisor Approval**.
3. Status moves to `Awaiting Verification`.

### Step 7: Supervisor Final Review & Resolution
1. Log in as Supervisor.
2. In the queue, select the complaint under **4. Completion Review**:
   - Inspect the side-by-side comparison of the initial photo and the after-cleaning photo.
   - If inadequate: Click **Return to In Progress** with explanatory notes.
   - If resolved: Click **Approve Resolution & Sign Off**.
3. Status moves to `Completed`.
4. Check the **System Audit Trail** in the Admin Console to confirm every transition, actor, and timestamp was immutably recorded.
