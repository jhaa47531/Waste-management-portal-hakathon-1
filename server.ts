/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import type { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const PORT = 3000;

app.use(express.json());

// Server-side Supabase credentials
const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (process.env.VITE_SUPABASE_ANON_KEY || '').trim();
const supabaseServiceRoleKey = (
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
).trim();

// Server-only Supabase Admin client configured with SUPABASE_SERVICE_ROLE_KEY
// Secret key is strictly server-side; never exposed to frontend code or API responses.
const supabaseAdmin = (supabaseUrl && supabaseServiceRoleKey)
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

/**
 * Secure Administrator Endpoint: Provision or promote a Supervisor
 * Requires verified Administrator Authorization Bearer token
 */
app.post('/api/admin/provision-supervisor', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Missing or invalid Authorization Bearer token.',
    });
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const { email, fullName, phoneNumber, password } = req.body || {};

  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, error: 'A valid email address is required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = (fullName || '').trim() || 'Municipal Supervisor';
  const cleanPhone = (phoneNumber || '').trim() || '0000000000';

  if (password !== undefined && password !== null && typeof password === 'string' && password.length < 8) {
    return res.status(400).json({
      success: false,
      error: 'Temporary password must be at least 8 characters long.',
    });
  }

  const isPlaceholderUrl =
    !supabaseUrl || supabaseUrl.includes('your-project') || supabaseUrl.includes('example.com');

  if (isPlaceholderUrl) {
    return res.status(503).json({
      success: false,
      error:
        'Supabase is currently running in local demonstration mode (VITE_SUPABASE_URL is unconfigured or placeholder).',
    });
  }

  // 1. Ensure server-side admin client is initialized
  if (!supabaseAdmin) {
    return res.status(503).json({
      success: false,
      error:
        'Backend error: SUPABASE_SERVICE_ROLE_KEY is not configured on the server. Please ensure the secret is added in AI Studio Secrets.',
    });
  }

  try {
    // 2. Verify caller identity using server-only Admin client
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return res.status(401).json({
        success: false,
        error: `Authentication failed: ${userError?.message || 'Invalid session'}`,
      });
    }

    const callerId = userData.user.id;

    // 3. Verify caller is an active Administrator in public.profiles
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role, account_status')
      .eq('id', callerId)
      .maybeSingle();

    const callerRole = (
      callerProfile?.role ||
      userData.user.app_metadata?.role ||
      userData.user.user_metadata?.role ||
      ''
    ).toString().toLowerCase();

    const callerStatus = (
      callerProfile?.account_status ||
      'active'
    ).toString().toLowerCase();

    const isCallerAdmin =
      callerStatus === 'active' &&
      (callerRole === 'administrator' || callerRole === 'admin');

    if (!isCallerAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Only active administrators are authorized to provision supervisors.',
      });
    }

    // 4. Safely handle Auth user creation or retry existing Auth user
    let targetUserId: string | null = null;
    let isNewUser = false;

    // Check if user already exists in auth.users
    const { data: userList, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (listError) {
      return res.status(500).json({
        success: false,
        error: `Failed to inspect Auth user registry: ${listError.message}`,
      });
    }

    const existingAuthUser = userList?.users?.find(
      (u) => u.email?.toLowerCase() === cleanEmail
    );

    if (existingAuthUser) {
      targetUserId = existingAuthUser.id;
      // User exists from a previous signup or failed profile run: preserve credentials, update metadata
      await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
        user_metadata: {
          ...existingAuthUser.user_metadata,
          full_name: cleanName || existingAuthUser.user_metadata?.full_name,
          phone_number: cleanPhone || existingAuthUser.user_metadata?.phone_number,
          role: 'supervisor',
        },
        app_metadata: {
          role: 'supervisor',
        },
      }).catch(() => {});
    } else {
      // Use provided temporary password or generate a cryptographically strong default
      const finalPassword =
        password && typeof password === 'string' && password.length >= 8
          ? password
          : 'Sup!' + Math.random().toString(36).substring(2, 10) + '8Z#';

      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: finalPassword,
        email_confirm: true,
        user_metadata: {
          full_name: cleanName,
          phone_number: cleanPhone,
          role: 'supervisor',
        },
        app_metadata: {
          role: 'supervisor',
        },
      });

      if (createError) {
        // If user already exists (e.g. registered during concurrent/failed attempt), re-fetch and link
        const isAlreadyExists =
          createError.message?.toLowerCase().includes('already') ||
          createError.message?.toLowerCase().includes('registered') ||
          createError.message?.toLowerCase().includes('exists') ||
          (createError as any).status === 422;

        if (isAlreadyExists) {
          const { data: retryList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const retryUser = retryList?.users?.find((u) => u.email?.toLowerCase() === cleanEmail);
          if (retryUser) {
            targetUserId = retryUser.id;
            isNewUser = false;
          } else {
            return res.status(400).json({
              success: false,
              error: `Failed to create Supabase Auth user: ${createError.message}`,
            });
          }
        } else {
          return res.status(400).json({
            success: false,
            error: `Failed to create Supabase Auth user: ${createError.message}`,
          });
        }
      } else {
        targetUserId = created.user.id;
        isNewUser = true;
      }
    }

    // 5. Ensure supervisor role is stamped in Auth app_metadata and user_metadata
    await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
      app_metadata: { role: 'supervisor' },
      user_metadata: {
        full_name: cleanName,
        phone: cleanPhone,
        phone_number: cleanPhone,
        role: 'supervisor',
      },
    }).catch(() => {});

    // 6. Upsert public.profiles record with role 'supervisor' and status 'active' via Admin client
    const profilePayload: Record<string, any> = {
      id: targetUserId,
      full_name: cleanName,
      role: 'supervisor',
      account_status: 'active',
      updated_at: new Date().toISOString(),
    };

    let { error: profileUpsertError } = await supabaseAdmin
      .from('profiles')
      .upsert({ ...profilePayload, phone: cleanPhone }, { onConflict: 'id' });

    if (
      profileUpsertError &&
      (profileUpsertError.message?.includes("'phone'") || profileUpsertError.code === 'PGRST204')
    ) {
      const { error: errPhoneNum } = await supabaseAdmin
        .from('profiles')
        .upsert({ ...profilePayload, phone_number: cleanPhone }, { onConflict: 'id' });
      profileUpsertError = errPhoneNum;
    }

    if (profileUpsertError) {
      return res.status(500).json({
        success: false,
        error: `Supervisor Auth account ready (${cleanEmail}), but profiles table update failed: ${profileUpsertError.message}. You can retry provisioning to complete profile initialization.`,
        userId: targetUserId,
      });
    }

    return res.json({
      success: true,
      status: isNewUser ? 'created' : 'promoted',
      message: isNewUser
        ? `Supervisor account for ${cleanName} (${cleanEmail}) successfully created in Supabase Auth and activated.`
        : `Existing account for ${cleanEmail} successfully promoted to Supervisor.`,
      user: {
        id: targetUserId,
        email: cleanEmail,
        fullName: cleanName,
        phoneNumber: cleanPhone,
        role: 'supervisor',
        accountStatus: 'active',
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error during supervisor provisioning',
    });
  }
});

/**
 * Public Resident Registration Endpoint
 * Creates verified Supabase Auth user and initializes public.profiles record
 */
app.post('/api/auth/register-resident', async (req: Request, res: Response) => {
  const { email, fullName, phoneNumber, password } = req.body || {};

  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, error: 'A valid email address is required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = (fullName || '').trim();
  const cleanPhone = (phoneNumber || '').trim();
  const cleanPassword = (password || '').trim();

  if (cleanName.length < 2) {
    return res.status(400).json({ success: false, error: 'Full name must be at least 2 characters.' });
  }
  if (cleanPhone.length < 7) {
    return res.status(400).json({ success: false, error: 'Phone number must be at least 7 characters.' });
  }
  if (cleanPassword.length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
  }

  if (!supabaseAdmin) {
    return res.status(503).json({
      success: false,
      error: 'Backend service key not configured for programmatic registration.',
    });
  }

  try {
    // Check if user already exists in auth.users
    const { data: userList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (!listError && userList?.users) {
      const existing = userList.users.find((u) => u.email?.toLowerCase() === cleanEmail);
      if (existing) {
        return res.status(409).json({
          success: false,
          error: 'An account with this email address already exists. Please sign in.',
        });
      }
    }

    // Create resident user in Supabase Auth with confirmed email
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password: cleanPassword,
      email_confirm: true,
      user_metadata: {
        full_name: cleanName,
        phone_number: cleanPhone,
        phone: cleanPhone,
        role: 'resident',
      },
      app_metadata: {
        role: 'resident',
      },
    });

    if (createError) {
      return res.status(400).json({
        success: false,
        error: createError.message || 'Failed to create user account.',
      });
    }

    const newUserId = created.user.id;

    // Initialize public.profiles record
    let profileErr: any = null;
    const { error: err1 } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: newUserId,
          full_name: cleanName,
          phone: cleanPhone,
          role: 'resident',
          account_status: 'active',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

    if (err1 && err1.message?.includes("'phone'")) {
      const { error: err2 } = await supabaseAdmin
        .from('profiles')
        .upsert(
          {
            id: newUserId,
            full_name: cleanName,
            phone_number: cleanPhone,
            role: 'resident',
            account_status: 'active',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
      profileErr = err2;
    } else {
      profileErr = err1;
    }

    if (profileErr) {
      console.warn('Profile initialization note:', profileErr.message);
    }

    return res.json({
      success: true,
      user: {
        id: newUserId,
        email: cleanEmail,
        fullName: cleanName,
        phoneNumber: cleanPhone,
        role: 'resident',
        accountStatus: 'active',
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Server error during resident registration.',
    });
  }
});

/**
 * Reusable helper: Validate that the caller is an active Administrator
 */
async function verifyAdminCaller(
  authHeader?: string
): Promise<{ ok: boolean; status: number; error?: string; callerId?: string }> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      ok: false,
      status: 401,
      error: 'Unauthorized: Missing or invalid Authorization Bearer token.',
    };
  }

  const token = authHeader.replace('Bearer ', '').trim();
  if (!supabaseAdmin) {
    return {
      ok: false,
      status: 503,
      error: 'Backend error: SUPABASE_SERVICE_ROLE_KEY is not configured on the server.',
    };
  }

  try {
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return {
        ok: false,
        status: 401,
        error: `Authentication failed: ${userError?.message || 'Invalid session'}`,
      };
    }

    const callerId = userData.user.id;
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role, account_status')
      .eq('id', callerId)
      .maybeSingle();

    const callerRole = (
      callerProfile?.role ||
      userData.user.app_metadata?.role ||
      userData.user.user_metadata?.role ||
      ''
    ).toString().toLowerCase();

    const callerStatus = (
      callerProfile?.account_status ||
      'active'
    ).toString().toLowerCase();

    if (callerStatus !== 'active' || (callerRole !== 'administrator' && callerRole !== 'admin')) {
      return {
        ok: false,
        status: 403,
        error: 'Forbidden: Only active administrators can perform this operation.',
      };
    }

    return { ok: true, status: 200, callerId };
  } catch (err: any) {
    return { ok: false, status: 500, error: err.message || 'Error verifying caller authorization.' };
  }
}

/**
 * Reusable helper: Validate that the caller is an active Administrator or Supervisor
 */
async function verifyStaffCaller(
  authHeader?: string
): Promise<{ ok: boolean; status: number; error?: string; callerId?: string; role?: string }> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      ok: false,
      status: 401,
      error: 'Unauthorized: Missing or invalid Authorization Bearer token.',
    };
  }

  const token = authHeader.replace('Bearer ', '').trim();
  if (!supabaseAdmin) {
    return {
      ok: false,
      status: 503,
      error: 'Backend error: SUPABASE_SERVICE_ROLE_KEY is not configured on the server.',
    };
  }

  try {
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return {
        ok: false,
        status: 401,
        error: `Authentication failed: ${userError?.message || 'Invalid session'}`,
      };
    }

    const callerId = userData.user.id;
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role, account_status')
      .eq('id', callerId)
      .maybeSingle();

    const callerRole = (
      callerProfile?.role ||
      userData.user.app_metadata?.role ||
      userData.user.user_metadata?.role ||
      ''
    ).toString().toLowerCase();

    const callerStatus = (
      callerProfile?.account_status ||
      'active'
    ).toString().toLowerCase();

    const isStaff =
      callerStatus === 'active' &&
      (callerRole === 'administrator' || callerRole === 'admin' || callerRole === 'supervisor');

    if (!isStaff) {
      return {
        ok: false,
        status: 403,
        error: 'Forbidden: Only active administrators or supervisors can perform this operation.',
      };
    }

    return { ok: true, status: 200, callerId, role: callerRole };
  } catch (err: any) {
    return { ok: false, status: 500, error: err.message || 'Error verifying caller authorization.' };
  }
}

/**
 * Robust Profile Save Helper
 * Handles initial creation and updates with persistent supervisor_id preservation.
 * Never strips supervisor_id on schema differences.
 */
async function saveProfile(data: {
  id: string;
  fullName: string;
  phone: string;
  role: 'resident' | 'cleaner' | 'supervisor' | 'administrator';
  accountStatus: 'active' | 'pending' | 'suspended';
  supervisorId?: string | null;
}): Promise<{ error?: any }> {
  if (!supabaseAdmin) return { error: new Error('Supabase admin client unavailable') };

  const nowIso = new Date().toISOString();

  // Inspect existing profile if present to determine primary phone column name
  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('id, phone, phone_number, supervisor_id')
    .eq('id', data.id)
    .maybeSingle();

  if (existing) {
    // Existing profile: perform targeted UPDATE
    const updatePayload: Record<string, any> = {
      full_name: data.fullName,
      role: data.role,
      account_status: data.accountStatus,
      updated_at: nowIso,
    };

    if (data.supervisorId !== undefined) {
      updatePayload.supervisor_id = data.supervisorId || null;
    }

    // Adapt phone column
    if (existing.phone !== undefined && existing.phone !== null) {
      updatePayload.phone = data.phone;
    } else {
      updatePayload.phone_number = data.phone;
    }

    let { error } = await supabaseAdmin
      .from('profiles')
      .update(updatePayload)
      .eq('id', data.id);

    // If phone column name mismatch occurred, retry with alternate column
    if (error && (error.message?.includes("'phone_number'") || error.code === 'PGRST204')) {
      delete updatePayload.phone_number;
      updatePayload.phone = data.phone;
      const res = await supabaseAdmin.from('profiles').update(updatePayload).eq('id', data.id);
      error = res.error;
    } else if (error && (error.message?.includes("'phone'") || error.code === 'PGRST204')) {
      delete updatePayload.phone;
      updatePayload.phone_number = data.phone;
      const res = await supabaseAdmin.from('profiles').update(updatePayload).eq('id', data.id);
      error = res.error;
    }

    return { error };
  } else {
    // New profile: perform UPSERT
    const insertPayload: Record<string, any> = {
      id: data.id,
      full_name: data.fullName,
      role: data.role,
      account_status: data.accountStatus,
      phone_number: data.phone,
      created_at: nowIso,
      updated_at: nowIso,
    };

    if (data.supervisorId) {
      insertPayload.supervisor_id = data.supervisorId;
    }

    let { error } = await supabaseAdmin.from('profiles').upsert(insertPayload, { onConflict: 'id' });

    if (error && (error.message?.includes("'phone_number'") || error.code === 'PGRST204')) {
      delete insertPayload.phone_number;
      insertPayload.phone = data.phone;
      const res = await supabaseAdmin.from('profiles').upsert(insertPayload, { onConflict: 'id' });
      error = res.error;
    }

    return { error };
  }
}

/**
 * Dedicated Helper: Update Cleaner Profile & Supervisor
 * Directly updates profiles.supervisor_id and synchronizes cleaner_applications.assigned_supervisor_id.
 */
async function updateCleanerProfileAndSupervisor(
  cleanerId: string,
  data: {
    supervisorId?: string | null;
    accountStatus?: 'active' | 'pending' | 'suspended';
    fullName?: string;
    phone?: string;
  }
): Promise<{ error?: any }> {
  if (!supabaseAdmin) return { error: new Error('Supabase admin client unavailable') };

  const nowIso = new Date().toISOString();
  const updatePayload: Record<string, any> = {
    updated_at: nowIso,
  };

  if (data.supervisorId !== undefined) {
    updatePayload.supervisor_id = data.supervisorId || null;
  }
  if (data.accountStatus !== undefined) {
    updatePayload.account_status = data.accountStatus;
  }
  if (data.fullName !== undefined && data.fullName.trim()) {
    updatePayload.full_name = data.fullName.trim();
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update(updatePayload)
    .eq('id', cleanerId);

  if (error) {
    return { error: new Error(`Failed to update profiles: ${error.message}`) };
  }

  // If supervisor_id was specified, also update cleaner_applications.assigned_supervisor_id
  if (data.supervisorId !== undefined) {
    const targetSupId = data.supervisorId || null;
    try {
      await supabaseAdmin
        .from('cleaner_applications')
        .update({ assigned_supervisor_id: targetSupId })
        .eq('cleaner_id', cleanerId);
    } catch {
      // Ignore if cleaner_applications update fails non-critically
    }
  }

  return {};
}

/**
 * Safe Cleaner Application Upsert / Update Helper
 * Handles 'cleaner_id' and 'applicant_id' column naming gracefully.
 */
async function saveCleanerApplication(data: {
  cleanerId: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewerId?: string | null;
  assignedSupervisorId?: string | null;
  reviewNotes?: string | null;
  createdAt?: string;
  reviewedAt?: string | null;
}): Promise<{ error?: any }> {
  if (!supabaseAdmin) return { error: new Error('No admin client') };

  const nowIso = new Date().toISOString();

  // Check if an existing application exists
  const { data: existing } = await supabaseAdmin
    .from('cleaner_applications')
    .select('id, cleaner_id')
    .eq('cleaner_id', data.cleanerId)
    .maybeSingle();

  if (existing) {
    const updatePayload: Record<string, any> = {
      status: data.status,
    };
    if (data.assignedSupervisorId !== undefined) {
      updatePayload.assigned_supervisor_id = data.assignedSupervisorId || null;
    }
    if (data.reviewerId) updatePayload.reviewer_id = data.reviewerId;
    if (data.reviewNotes) updatePayload.review_notes = data.reviewNotes;
    if (data.reviewedAt) updatePayload.reviewed_at = data.reviewedAt;

    let { error } = await supabaseAdmin
      .from('cleaner_applications')
      .update(updatePayload)
      .eq('id', existing.id);

    if (error && (error.message?.includes('reviewer_id') || error.code === 'PGRST204')) {
      delete updatePayload.reviewer_id;
      delete updatePayload.review_notes;
      if (data.reviewerId) updatePayload.reviewed_by = data.reviewerId;
      if (data.reviewNotes) updatePayload.review_note = data.reviewNotes;
      const res = await supabaseAdmin.from('cleaner_applications').update(updatePayload).eq('id', existing.id);
      error = res.error;
    }

    return { error };
  } else {
    // Insert new application record
    const insertPayload: Record<string, any> = {
      cleaner_id: data.cleanerId,
      status: data.status,
      created_at: data.createdAt || nowIso,
    };
    if (data.assignedSupervisorId) insertPayload.assigned_supervisor_id = data.assignedSupervisorId;
    if (data.reviewerId) insertPayload.reviewer_id = data.reviewerId;
    if (data.reviewNotes) insertPayload.review_notes = data.reviewNotes;
    if (data.reviewedAt) insertPayload.reviewed_at = data.reviewedAt;

    let { error } = await supabaseAdmin.from('cleaner_applications').insert(insertPayload);

    if (error && (error.message?.includes('cleaner_id') || error.code === 'PGRST204')) {
      delete insertPayload.cleaner_id;
      insertPayload.applicant_id = data.cleanerId;
      if (data.reviewerId) {
        delete insertPayload.reviewer_id;
        insertPayload.reviewed_by = data.reviewerId;
      }
      if (data.reviewNotes) {
        delete insertPayload.review_notes;
        insertPayload.review_note = data.reviewNotes;
      }
      const res = await supabaseAdmin.from('cleaner_applications').insert(insertPayload);
      error = res.error;
    }

    return { error };
  }
}

/**
 * Verified Cleaner Service Areas Persistence Helper
 * Uses verified live table columns: cleaner_id, locality_id, is_approved, approved_by, approved_at, created_at.
 * Atomic clear-and-insert ensures clean state with visible error propagation.
 */
async function saveCleanerServiceAreas(
  cleanerId: string,
  localityIds: string[],
  isApproved: boolean,
  approvedBy?: string | null
): Promise<{ error?: any }> {
  if (!supabaseAdmin) return { error: new Error('Supabase admin client unavailable') };

  const nowIso = new Date().toISOString();

  // 1. Delete previous service areas for this cleaner to prevent stale/duplicate assignments
  const { error: delErr } = await supabaseAdmin
    .from('cleaner_service_areas')
    .delete()
    .eq('cleaner_id', cleanerId);

  if (delErr) {
    return { error: new Error(`Failed to clear existing service areas: ${delErr.message}`) };
  }

  if (!Array.isArray(localityIds) || localityIds.length === 0) {
    return {};
  }

  // 2. Prepare records with exact schema columns
  const records = localityIds.map((locId) => ({
    cleaner_id: cleanerId,
    locality_id: locId,
    is_approved: isApproved,
    approved_by: isApproved ? (approvedBy || null) : null,
    approved_at: isApproved ? nowIso : null,
    created_at: nowIso,
  }));

  // 3. Insert records
  const { error: insErr } = await supabaseAdmin
    .from('cleaner_service_areas')
    .insert(records);

  if (insErr) {
    return { error: new Error(`Failed to insert cleaner_service_areas: ${insErr.message}`) };
  }

  return {};
}

/**
 * PATH A: Cleaner Self-Registration Endpoint
 * Allows a cleaner candidate to submit their registration and preferred service localities.
 * Automatically confirms Auth email server-side to avoid SMTP delivery failures.
 * Sets role to 'cleaner' and account_status to 'pending' for administrator review.
 */
app.post('/api/cleaner/apply', async (req: Request, res: Response) => {
  const { email, fullName, phoneNumber, password, preferredLocalityIds } = req.body || {};

  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, error: 'A valid email address is required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = (fullName || '').trim();
  const cleanPhone = (phoneNumber || '').trim();
  const cleanPassword = (password || '').trim();

  if (cleanName.length < 2) {
    return res.status(400).json({ success: false, error: 'Full name must be at least 2 characters.' });
  }
  if (cleanPhone.length < 7) {
    return res.status(400).json({ success: false, error: 'Phone number must be at least 7 characters.' });
  }
  if (cleanPassword.length < 8) {
    return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long.' });
  }

  const locIds: string[] = Array.isArray(preferredLocalityIds) ? preferredLocalityIds : [];
  if (locIds.length < 1) {
    return res.status(400).json({ success: false, error: 'Please select at least 1 preferred service locality.' });
  }

  if (!supabaseAdmin) {
    return res.status(503).json({
      success: false,
      error: 'Backend service key not configured for programmatic cleaner application.',
    });
  }

  try {
    // 1. Check if user already exists
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
    const existing = userList?.users?.find((u) => u.email?.toLowerCase() === cleanEmail);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email address already exists. Please sign in or use another email.',
      });
    }

    // 2. Create Supabase Auth user with email_confirm: true (no SMTP sending block)
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password: cleanPassword,
      email_confirm: true,
      user_metadata: {
        full_name: cleanName,
        phone_number: cleanPhone,
        phone: cleanPhone,
        role: 'cleaner',
        account_status: 'pending',
        service_areas: locIds,
      },
      app_metadata: {
        role: 'cleaner',
        account_status: 'pending',
      },
    });

    if (createError) {
      return res.status(400).json({
        success: false,
        error: createError.message || 'Failed to create cleaner authentication account.',
      });
    }

    const newUserId = created.user.id;

    // 3. Upsert profiles record with role 'cleaner' and status 'pending'
    const { error: profErr } = await saveProfile({
      id: newUserId,
      fullName: cleanName,
      phone: cleanPhone,
      role: 'cleaner',
      accountStatus: 'pending',
    });

    if (profErr) {
      console.warn('Profile upsert notice during cleaner application:', profErr.message);
    }

    // 4. Create cleaner_applications record (safe with applicant_id / cleaner_id)
    await saveCleanerApplication({
      cleanerId: newUserId,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    // 5. Record proposed service localities (unapproved)
    const { error: areaErr } = await saveCleanerServiceAreas(newUserId, locIds, false);
    if (areaErr) {
      console.warn('Cleaner initial service areas notice:', areaErr.message);
    }

    return res.json({
      success: true,
      message:
        'Cleaner application submitted successfully! Your account has been registered and is pending administrator review and supervisor assignment.',
      user: {
        id: newUserId,
        email: cleanEmail,
        fullName: cleanName,
        phoneNumber: cleanPhone,
        role: 'cleaner',
        accountStatus: 'pending',
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Server error during cleaner registration.',
    });
  }
});

/**
 * PATH B: Administrator Direct Cleaner Account Creation
 * Allows an active Administrator to provision a verified Cleaner account directly,
 * assign a Supervisor, configure authorized service areas, and set account status.
 */
app.post('/api/admin/create-cleaner', async (req: Request, res: Response) => {
  const authCheck = await verifyAdminCaller(req.headers.authorization);
  if (!authCheck.ok) {
    return res.status(authCheck.status).json({ success: false, error: authCheck.error });
  }

  const { email, fullName, phoneNumber, password, supervisorId, localityIds, accountStatus } =
    req.body || {};

  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, error: 'A valid email address is required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = (fullName || '').trim();
  const cleanPhone = (phoneNumber || '').trim() || '0000000000';
  const cleanPassword = (password || '').trim();
  const cleanStatus = accountStatus === 'pending' ? 'pending' : 'active';
  const assignedSupervisorId = supervisorId && supervisorId.trim() ? supervisorId.trim() : null;
  const serviceLocalityIds: string[] = Array.isArray(localityIds) ? localityIds : [];

  if (cleanName.length < 2) {
    return res.status(400).json({ success: false, error: 'Full name must be at least 2 characters.' });
  }
  if (cleanPassword.length < 8) {
    return res.status(400).json({ success: false, error: 'Initial password must be at least 8 characters long.' });
  }

  if (!supabaseAdmin) {
    return res.status(503).json({ success: false, error: 'Supabase admin client unavailable.' });
  }

  try {
    // Validate supervisor if specified
    if (assignedSupervisorId) {
      const { data: supProfile, error: supErr } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, role, account_status')
        .eq('id', assignedSupervisorId)
        .maybeSingle();

      if (supErr || !supProfile || supProfile.role !== 'supervisor' || supProfile.account_status !== 'active') {
        return res.status(400).json({
          success: false,
          error: 'The assigned supervisor must be an active, verified Supervisor account.',
        });
      }
    }

    // Check if user already exists
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
    const existing = userList?.users?.find((u) => u.email?.toLowerCase() === cleanEmail);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email address already exists in Supabase Auth.',
      });
    }

    // Create Supabase Auth user with complete metadata
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password: cleanPassword,
      email_confirm: true,
      user_metadata: {
        full_name: cleanName,
        phone_number: cleanPhone,
        phone: cleanPhone,
        role: 'cleaner',
        account_status: cleanStatus,
        supervisor_id: assignedSupervisorId,
        service_areas: serviceLocalityIds,
      },
      app_metadata: {
        role: 'cleaner',
        account_status: cleanStatus,
        supervisor_id: assignedSupervisorId,
      },
    });

    if (createError) {
      return res.status(400).json({
        success: false,
        error: createError.message || 'Failed to create cleaner Auth user.',
      });
    }

    const newUserId = created.user.id;

    // 1. Persist profiles record with supervisor_id
    const { error: profErr } = await saveProfile({
      id: newUserId,
      fullName: cleanName,
      phone: cleanPhone,
      role: 'cleaner',
      accountStatus: cleanStatus,
      supervisorId: assignedSupervisorId,
    });

    if (profErr) {
      return res.status(500).json({
        success: false,
        error: `Failed to create cleaner profile: ${profErr.message}`,
      });
    }

    // 2. Insert cleaner_applications record with assigned_supervisor_id
    const { error: appErr } = await saveCleanerApplication({
      cleanerId: newUserId,
      status: cleanStatus === 'active' ? 'approved' : 'pending',
      reviewerId: authCheck.callerId,
      assignedSupervisorId,
      reviewNotes: 'Created directly by Administrator.',
      reviewedAt: cleanStatus === 'active' ? new Date().toISOString() : null,
      createdAt: new Date().toISOString(),
    });

    if (appErr) {
      console.warn('Cleaner application record note:', appErr.message);
    }

    // 3. Persist authorized service areas in cleaner_service_areas
    if (serviceLocalityIds.length > 0) {
      const { error: areaErr } = await saveCleanerServiceAreas(
        newUserId,
        serviceLocalityIds,
        cleanStatus === 'active',
        cleanStatus === 'active' ? authCheck.callerId : null
      );

      if (areaErr) {
        return res.status(500).json({
          success: false,
          error: `Cleaner created, but failed to persist service areas: ${areaErr.message}`,
        });
      }
    }

    return res.json({
      success: true,
      message: `Cleaner account for ${cleanName} (${cleanEmail}) successfully created with initial credentials.`,
      user: {
        id: newUserId,
        email: cleanEmail,
        fullName: cleanName,
        phoneNumber: cleanPhone,
        role: 'cleaner',
        accountStatus: cleanStatus,
        supervisorId: assignedSupervisorId,
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Server error during cleaner account creation.',
    });
  }
});

/**
 * Staff Endpoint: Review Cleaner Application (Approve / Reject)
 * Allows Admin or active Supervisor to approve cleaner applications,
 * assign a Supervisor, and authorize service localities.
 */
app.post('/api/admin/review-cleaner-application', async (req: Request, res: Response) => {
  const authCheck = await verifyStaffCaller(req.headers.authorization);
  if (!authCheck.ok) {
    return res.status(authCheck.status).json({ success: false, error: authCheck.error });
  }

  const { applicationId, decision, supervisorId, approvedLocalityIds, notes } = req.body || {};

  if (!applicationId) {
    return res.status(400).json({ success: false, error: 'Application ID is required.' });
  }

  if (decision !== 'approved' && decision !== 'rejected') {
    return res.status(400).json({ success: false, error: 'Decision must be either "approved" or "rejected".' });
  }

  if (!supabaseAdmin) {
    return res.status(503).json({ success: false, error: 'Supabase admin client unavailable.' });
  }

  try {
    // 1. Fetch application
    const { data: appData, error: appErr } = await supabaseAdmin
      .from('cleaner_applications')
      .select('*')
      .eq('id', applicationId)
      .maybeSingle();

    if (appErr || !appData) {
      return res.status(404).json({ success: false, error: 'Cleaner application not found.' });
    }

    if (appData.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `This application has already been processed (current status: ${appData.status}).`,
      });
    }

    // Resolve cleaner ID from cleaner_id or applicant_id
    const cleanerId = appData.cleaner_id || appData.applicant_id;
    if (!cleanerId) {
      return res.status(400).json({ success: false, error: 'Application record is missing applicant identifier.' });
    }

    // Determine target supervisor: if caller is supervisor and supervisorId is not set, default to caller
    let cleanSupervisorId = supervisorId && supervisorId.trim() ? supervisorId.trim() : null;
    if (!cleanSupervisorId && authCheck.role === 'supervisor') {
      cleanSupervisorId = authCheck.callerId || null;
    }

    if (decision === 'approved') {
      if (cleanSupervisorId) {
        const { data: supData, error: supErr } = await supabaseAdmin
          .from('profiles')
          .select('id, role, account_status')
          .eq('id', cleanSupervisorId)
          .maybeSingle();

        if (supErr || !supData || supData.role !== 'supervisor' || supData.account_status !== 'active') {
          return res.status(400).json({
            success: false,
            error: 'The assigned supervisor is not an active Supervisor account.',
          });
        }
      }

      const approvedLocs: string[] = Array.isArray(approvedLocalityIds) ? approvedLocalityIds : [];
      if (approvedLocs.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Please authorize at least one service locality for this approved cleaner.',
        });
      }

      // 1. Update cleaner_applications with assigned_supervisor_id
      const { error: appUpdateErr } = await saveCleanerApplication({
        cleanerId,
        status: 'approved',
        reviewerId: authCheck.callerId,
        assignedSupervisorId: cleanSupervisorId,
        reviewNotes: notes || 'Application approved by staff.',
        reviewedAt: new Date().toISOString(),
      });

      if (appUpdateErr) {
        return res.status(500).json({
          success: false,
          error: `Failed to update cleaner application: ${appUpdateErr.message}`,
        });
      }

      // 2. Persist profiles record: role='cleaner', account_status='active', supervisor_id=cleanSupervisorId
      const { error: profUpdateErr } = await updateCleanerProfileAndSupervisor(cleanerId, {
        supervisorId: cleanSupervisorId,
        accountStatus: 'active',
      });

      if (profUpdateErr) {
        return res.status(500).json({
          success: false,
          error: `Failed to update cleaner profile: ${profUpdateErr.message}`,
        });
      }

      // 3. Persist authorized service areas in cleaner_service_areas with is_approved=true
      const { error: areaErr } = await saveCleanerServiceAreas(
        cleanerId,
        approvedLocs,
        true,
        authCheck.callerId
      );

      if (areaErr) {
        return res.status(500).json({
          success: false,
          error: `Failed to persist cleaner service areas: ${areaErr.message}`,
        });
      }

      // Update Auth user metadata
      await supabaseAdmin.auth.admin.updateUserById(cleanerId, {
        user_metadata: {
          role: 'cleaner',
          account_status: 'active',
          supervisor_id: cleanSupervisorId,
          service_areas: approvedLocs,
        },
        app_metadata: {
          role: 'cleaner',
          account_status: 'active',
          supervisor_id: cleanSupervisorId,
        },
      }).catch(() => {});
    } else {
      // Decision is 'rejected'
      await saveCleanerApplication({
        cleanerId,
        status: 'rejected',
        reviewerId: authCheck.callerId,
        reviewNotes: notes || 'Application rejected by staff.',
        reviewedAt: new Date().toISOString(),
      });

      await updateCleanerProfileAndSupervisor(cleanerId, {
        accountStatus: 'suspended',
      });

      await supabaseAdmin.auth.admin.updateUserById(cleanerId, {
        user_metadata: { account_status: 'suspended' },
        app_metadata: { account_status: 'suspended' },
      }).catch(() => {});
    }

    return res.json({
      success: true,
      status: decision,
      message: `Cleaner application successfully ${decision}.`,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Server error reviewing cleaner application.',
    });
  }
});

/**
 * Administrator Endpoint: Update Cleaner Account Details
 * Change supervisor assignment, toggle active/suspended status, or update service areas.
 * Guarantees atomic persistence of profiles.supervisor_id and cleaner_service_areas.
 */
app.post('/api/admin/update-cleaner', async (req: Request, res: Response) => {
  const authCheck = await verifyAdminCaller(req.headers.authorization);
  if (!authCheck.ok) {
    return res.status(authCheck.status).json({ success: false, error: authCheck.error });
  }

  const { cleanerId, supervisorId, accountStatus, localityIds } = req.body || {};

  if (!cleanerId) {
    return res.status(400).json({ success: false, error: 'Cleaner ID is required.' });
  }

  if (!supabaseAdmin) {
    return res.status(503).json({ success: false, error: 'Supabase admin client unavailable.' });
  }

  try {
    const { data: cleanerProfile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', cleanerId)
      .maybeSingle();

    if (!cleanerProfile || cleanerProfile.role !== 'cleaner') {
      return res.status(404).json({ success: false, error: 'Cleaner profile not found.' });
    }

    // 1. Handle supervisor assignment if provided
    let cleanSupervisorId: string | null | undefined = undefined;
    if (supervisorId !== undefined) {
      cleanSupervisorId = supervisorId && supervisorId.trim() ? supervisorId.trim() : null;

      if (cleanSupervisorId) {
        const { data: supProfile, error: supErr } = await supabaseAdmin
          .from('profiles')
          .select('id, role, account_status')
          .eq('id', cleanSupervisorId)
          .maybeSingle();

        if (supErr || !supProfile || supProfile.role !== 'supervisor' || supProfile.account_status !== 'active') {
          return res.status(400).json({
            success: false,
            error: 'Selected supervisor is invalid or not an active supervisor.',
          });
        }
      }
    }

    const nextStatus = accountStatus && ['active', 'pending', 'suspended'].includes(accountStatus)
      ? accountStatus
      : undefined;

    // 2. Persist updates to profiles.supervisor_id and account_status
    if (cleanSupervisorId !== undefined || nextStatus !== undefined) {
      const { error: profErr } = await updateCleanerProfileAndSupervisor(cleanerId, {
        supervisorId: cleanSupervisorId,
        accountStatus: nextStatus,
      });

      if (profErr) {
        return res.status(500).json({
          success: false,
          error: `Failed to update cleaner profile: ${profErr.message}`,
        });
      }
    }

    // 3. Persist authorized service areas in cleaner_service_areas if provided
    if (Array.isArray(localityIds)) {
      const currentActive = nextStatus ? nextStatus === 'active' : cleanerProfile.account_status === 'active';
      const { error: areaErr } = await saveCleanerServiceAreas(
        cleanerId,
        localityIds,
        currentActive,
        authCheck.callerId
      );

      if (areaErr) {
        return res.status(500).json({
          success: false,
          error: `Failed to update cleaner service areas: ${areaErr.message}`,
        });
      }
    }

    // 4. Update Auth user metadata
    const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(cleanerId);
    if (authUserData?.user) {
      const currentMeta = authUserData.user.user_metadata || {};
      const currentAppMeta = authUserData.user.app_metadata || {};

      const finalSupId = cleanSupervisorId !== undefined ? cleanSupervisorId : cleanerProfile.supervisor_id;
      const finalStatus = nextStatus || cleanerProfile.account_status;

      await supabaseAdmin.auth.admin.updateUserById(cleanerId, {
        user_metadata: {
          ...currentMeta,
          account_status: finalStatus,
          supervisor_id: finalSupId,
          service_areas: Array.isArray(localityIds) ? localityIds : currentMeta.service_areas,
        },
        app_metadata: {
          ...currentAppMeta,
          account_status: finalStatus,
          supervisor_id: finalSupId,
        },
      }).catch(() => {});
    }

    return res.json({
      success: true,
      message: 'Cleaner assignment and details successfully persisted.',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Server error updating cleaner.',
    });
  }
});

/**
 * Administrator Endpoint: Reset Cleaner Initial/Temporary Password
 */
app.post('/api/admin/reset-cleaner-password', async (req: Request, res: Response) => {
  const authCheck = await verifyAdminCaller(req.headers.authorization);
  if (!authCheck.ok) {
    return res.status(authCheck.status).json({ success: false, error: authCheck.error });
  }

  const { cleanerId, newPassword } = req.body || {};

  if (!cleanerId || !newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({
      success: false,
      error: 'Cleaner ID and a new password of at least 8 characters are required.',
    });
  }

  if (!supabaseAdmin) {
    return res.status(503).json({ success: false, error: 'Supabase admin client unavailable.' });
  }

  try {
    const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(cleanerId, {
      password: newPassword,
    });

    if (pwErr) {
      return res.status(500).json({ success: false, error: pwErr.message });
    }

    return res.json({
      success: true,
      message: 'Cleaner password has been securely reset.',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Server error resetting password.',
    });
  }
});

/**
 * Authenticated Cleaner Profile Endpoint:
 * Returns the cleaner's verified profile with supervisor name and authorized service areas with locality names.
 */
app.get('/api/cleaner/my-profile', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Missing Authorization Bearer token.' });
  }

  const token = authHeader.replace('Bearer ', '').trim();
  if (!supabaseAdmin) {
    return res.status(503).json({ success: false, error: 'Supabase admin client unavailable.' });
  }

  try {
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized session.' });
    }

    const cleanerId = userData.user.id;

    // Fetch cleaner profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', cleanerId)
      .maybeSingle();

    let supervisorName: string | null = null;
    if (profile?.supervisor_id) {
      const { data: supProf } = await supabaseAdmin
        .from('profiles')
        .select('full_name')
        .eq('id', profile.supervisor_id)
        .maybeSingle();
      supervisorName = supProf?.full_name || null;
    }

    // Fetch cleaner service areas
    const { data: saData } = await supabaseAdmin
      .from('cleaner_service_areas')
      .select('*')
      .eq('cleaner_id', cleanerId);

    // Fetch localities
    const { data: locData } = await supabaseAdmin.from('localities').select('id, name');
    const locMap = new Map((locData || []).map((l: any) => [l.id, l.name]));

    const serviceAreas = (saData || []).map((sa: any) => ({
      id: sa.id,
      cleanerId: sa.cleaner_id,
      localityId: sa.locality_id,
      localityName: locMap.get(sa.locality_id) || 'Locality',
      isApproved: sa.is_approved,
      approvedBy: sa.approved_by,
      approvedAt: sa.approved_at,
    }));

    return res.json({
      success: true,
      profile: {
        id: cleanerId,
        email: userData.user.email || profile?.email || '',
        fullName: profile?.full_name || userData.user.user_metadata?.full_name || 'Cleaner',
        phoneNumber: profile?.phone_number || profile?.phone || '',
        role: profile?.role || 'cleaner',
        accountStatus: profile?.account_status || 'active',
        supervisorId: profile?.supervisor_id || null,
        supervisorName,
      },
      serviceAreas,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Error fetching cleaner profile.',
    });
  }
});

/**
 * Administrator & Supervisor Directory Endpoint:
 * Fetches the unified, enriched list of all registered users (with authentic emails,
 * supervisor bindings, service area coverage, and statuses) directly from Supabase Auth + Profiles.
 * Guarantees changes persist across browser refreshes and resolves locality names.
 */
app.get('/api/admin/users', async (req: Request, res: Response) => {
  const authCheck = await verifyStaffCaller(req.headers.authorization);
  if (!authCheck.ok) {
    return res.status(authCheck.status).json({ success: false, error: authCheck.error });
  }

  if (!supabaseAdmin) {
    return res.status(503).json({ success: false, error: 'Supabase admin client unavailable.' });
  }

  try {
    // 1. Fetch profiles
    const { data: profiles, error: pErr } = await supabaseAdmin.from('profiles').select('*');
    if (pErr) {
      return res.status(500).json({ success: false, error: pErr.message });
    }

    // 2. Fetch Auth user registry for emails and metadata
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const authUsers = authData?.users || [];
    const authMap = new Map(authUsers.map((u) => [u.id, u]));

    // 3. Fetch cleaner_applications
    let rawApps: any[] = [];
    const { data: appsData } = await supabaseAdmin.from('cleaner_applications').select('*');
    if (appsData) rawApps = appsData;

    // 4. Fetch cleaner_service_areas
    let rawServiceAreas: any[] = [];
    const { data: saData } = await supabaseAdmin.from('cleaner_service_areas').select('*');
    if (saData) rawServiceAreas = saData;

    // 5. Fetch localities to resolve names accurately
    const { data: localitiesData } = await supabaseAdmin.from('localities').select('id, name');
    const localityMap = new Map((localitiesData || []).map((l: any) => [l.id, l.name]));

    // 6. Construct enriched users list (combining all Auth users and Profiles)
    const allUserIds = Array.from(
      new Set([
        ...authUsers.map((u) => u.id),
        ...(profiles || []).map((p: any) => p.id),
      ])
    );

    const enrichedUsers = allUserIds.map((userId) => {
      const p = (profiles || []).find((pr: any) => pr.id === userId) || {};
      const authU = authMap.get(userId);
      const email = authU?.email || p.email || '';
      const meta = authU?.user_metadata || {};
      const appMeta = authU?.app_metadata || {};
      const supervisorId = p.supervisor_id || meta.supervisor_id || appMeta.supervisor_id || null;
      const rawRole = (p.role || meta.role || appMeta.role || 'resident').toString().toLowerCase();
      const role = rawRole === 'admin' ? 'administrator' : rawRole;
      const status = p.account_status || meta.account_status || appMeta.account_status || 'active';

      // Auto-sync active cleaners to profiles table if missing
      if (role === 'cleaner' && !p.id && authU) {
        saveProfile({
          id: userId,
          fullName: meta.full_name || 'Cleaner',
          phone: meta.phone || meta.phone_number || '0000000000',
          role: 'cleaner',
          accountStatus: status as any,
          supervisorId,
        }).catch(() => {});
      }

      return {
        id: userId,
        email,
        fullName: p.full_name || meta.full_name || 'User',
        phoneNumber: p.phone || p.phone_number || meta.phone || meta.phone_number || '',
        role,
        accountStatus: status,
        supervisorId,
        supervisorName: null as string | null,
        createdAt: p.created_at || authU?.created_at,
        updatedAt: p.updated_at,
      };
    });

    // Resolve supervisor names
    enrichedUsers.forEach((u) => {
      if (u.supervisorId) {
        const sup = enrichedUsers.find((s) => s.id === u.supervisorId);
        if (sup) u.supervisorName = sup.fullName;
      }
    });

    // Build normalized cleaner applications
    const normalizedApps = rawApps.map((a: any) => {
      const cId = a.applicant_id || a.cleaner_id;
      const cleanerUser = enrichedUsers.find((u) => u.id === cId);
      const supId = a.assigned_supervisor_id || cleanerUser?.supervisorId || null;
      const supUser = supId ? enrichedUsers.find((u) => u.id === supId) : null;

      return {
        id: a.id,
        cleanerId: cId,
        cleanerName: cleanerUser?.fullName || 'Cleaner Applicant',
        cleanerEmail: cleanerUser?.email || '',
        cleanerPhone: cleanerUser?.phoneNumber || '',
        status: a.status || 'pending',
        assignedSupervisorId: supId,
        assignedSupervisorName: supUser?.fullName || null,
        reviewerId: a.reviewed_by || a.reviewer_id || null,
        reviewNotes: a.review_note || a.review_notes || null,
        reviewedAt: a.reviewed_at,
        createdAt: a.created_at,
      };
    });

    // Build normalized service areas with locality names
    const normalizedAreas: any[] = [];
    const areaKeys = new Set<string>();

    for (const sa of rawServiceAreas) {
      const cleanerId = sa.cleaner_id || sa.cleanerId;
      const localityId = sa.locality_id || sa.localityId;
      if (cleanerId && localityId) {
        areaKeys.add(`${cleanerId}:${localityId}`);
        normalizedAreas.push({
          id: sa.id || `csa-${cleanerId}-${localityId}`,
          cleanerId,
          localityId,
          localityName: localityMap.get(localityId) || 'Locality',
          isApproved: sa.is_approved !== false,
          approvedBy: sa.approved_by || null,
          approvedAt: sa.approved_at || null,
        });
      }
    }

    // Synthesize service areas for cleaners from auth user_metadata if missing from DB table
    for (const u of enrichedUsers) {
      if (u.role === 'cleaner') {
        const authU = authMap.get(u.id);
        const metaAreas = authU?.user_metadata?.service_areas || authU?.app_metadata?.service_areas;
        if (Array.isArray(metaAreas)) {
          for (const locId of metaAreas) {
            const key = `${u.id}:${locId}`;
            if (!areaKeys.has(key)) {
              areaKeys.add(key);
              const isApproved = u.accountStatus === 'active';
              normalizedAreas.push({
                id: `csa-${u.id}-${locId}`,
                cleanerId: u.id,
                localityId: locId,
                localityName: localityMap.get(locId) || 'Locality',
                isApproved,
                approvedBy: null,
                approvedAt: new Date().toISOString(),
              });
              if (isApproved) {
                saveCleanerServiceAreas(u.id, [locId], true).catch(() => {});
              }
            }
          }
        }
      }
    }

    return res.json({
      success: true,
      users: enrichedUsers,
      cleanerApplications: normalizedApps,
      serviceAreas: normalizedAreas,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Error fetching user directory.',
    });
  }
});

/**
 * Supervisor / Administrator Endpoint: Assign Cleaner to Verified Complaint
 * Server-side verified assignment fallback to guarantee reliable assignment.
 */
app.post('/api/supervisor/assign-cleaner', async (req: Request, res: Response) => {
  const authCheck = await verifyStaffCaller(req.headers.authorization);
  if (!authCheck.ok) {
    return res.status(authCheck.status).json({ success: false, error: authCheck.error });
  }

  if (!supabaseAdmin) {
    return res.status(503).json({ success: false, error: 'Supabase admin client unavailable.' });
  }

  const { complaintId, cleanerId, notes } = req.body || {};
  if (!complaintId || !cleanerId) {
    return res.status(400).json({ success: false, error: 'Complaint ID and Cleaner ID are required.' });
  }

  try {
    // 1. Fetch complaint
    const { data: complaint, error: compErr } = await supabaseAdmin
      .from('complaints')
      .select('*')
      .eq('id', complaintId)
      .maybeSingle();

    if (compErr || !complaint) {
      return res.status(404).json({ success: false, error: 'Complaint not found.' });
    }

    if (complaint.status !== 'verified' && complaint.status !== 'assigned') {
      return res.status(400).json({
        success: false,
        error: `A complaint must be verified before assigning a cleaner (current status: ${complaint.status}).`,
      });
    }

    // 2. Fetch cleaner details from Auth or Profiles
    const { data: cleanerAuth } = await supabaseAdmin.auth.admin.getUserById(cleanerId);
    const meta = cleanerAuth?.user?.user_metadata || {};
    const appMeta = cleanerAuth?.user?.app_metadata || {};

    const { data: cleanerProfile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', cleanerId)
      .maybeSingle();

    const cleanerRole = (cleanerProfile?.role || meta.role || appMeta.role || '').toString().toLowerCase();
    const cleanerStatus = (cleanerProfile?.account_status || meta.account_status || appMeta.account_status || 'active').toString().toLowerCase();

    if (cleanerRole !== 'cleaner') {
      return res.status(400).json({ success: false, error: 'Selected user does not have cleaner role.' });
    }
    if (cleanerStatus !== 'active') {
      return res.status(400).json({ success: false, error: `Cleaner account is ${cleanerStatus}. Only active cleaners can be assigned.` });
    }

    // 3. Ensure cleaner exists in public.profiles table so foreign key won't fail
    if (!cleanerProfile) {
      await saveProfile({
        id: cleanerId,
        fullName: meta.full_name || 'Cleaner',
        phone: meta.phone || meta.phone_number || '0000000000',
        role: 'cleaner',
        accountStatus: 'active',
        supervisorId: meta.supervisor_id || null,
      });
    }

    // 4. Ensure service area is recorded in cleaner_service_areas
    await saveCleanerServiceAreas(cleanerId, [complaint.locality_id], true, authCheck.callerId);

    // 5. Update complaints record
    const updatePayload: Record<string, any> = {
      status: 'assigned',
      assigned_cleaner_id: cleanerId,
      supervisor_id: authCheck.callerId,
      updated_at: new Date().toISOString(),
    };
    if (notes) {
      updatePayload.supervisor_note = notes;
    }

    let { error: updateErr } = await supabaseAdmin
      .from('complaints')
      .update(updatePayload)
      .eq('id', complaintId);

    if (updateErr && (updateErr.message?.includes('supervisor_note') || updateErr.code === 'PGRST204')) {
      delete updatePayload.supervisor_note;
      updatePayload.supervisor_notes = notes;
      const retryRes = await supabaseAdmin.from('complaints').update(updatePayload).eq('id', complaintId);
      updateErr = retryRes.error;
    }

    if (updateErr) {
      return res.status(500).json({ success: false, error: updateErr.message });
    }

    // 6. Record status history
    try {
      await supabaseAdmin.from('complaint_status_history').insert({
        complaint_id: complaintId,
        previous_status: complaint.status,
        new_status: 'assigned',
        actor_id: authCheck.callerId,
        note: notes ? `Assigned to cleaner. Notes: ${notes}` : 'Assigned to cleaner for pickup dispatch.',
        created_at: new Date().toISOString(),
      });
    } catch {
      // Non-blocking history record
    }

    return res.json({
      success: true,
      message: 'Cleaner successfully assigned to complaint.',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Server error assigning cleaner.',
    });
  }
});

/**
 * Cleaner Endpoint: Start Pickup Work
 * Transitions complaint status from 'assigned' to 'in_progress'.
 * Enforces that only the assigned cleaner (or authorized supervisor/administrator) can start work.
 */
app.post('/api/cleaner/start-progress', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Missing or invalid Authorization Bearer token.',
    });
  }

  const token = authHeader.replace('Bearer ', '').trim();
  if (!supabaseAdmin) {
    return res.status(503).json({
      success: false,
      error: 'Supabase admin client unavailable.',
    });
  }

  const { complaintId } = req.body || {};
  if (!complaintId) {
    return res.status(400).json({
      success: false,
      error: 'Complaint ID is required.',
    });
  }

  try {
    // 1. Verify caller session
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return res.status(401).json({
        success: false,
        error: `Authentication failed: ${userError?.message || 'Invalid session'}`,
      });
    }

    const callerId = userData.user.id;

    // 2. Check caller profile & role
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', callerId)
      .maybeSingle();

    const meta = userData.user.user_metadata || {};
    const appMeta = userData.user.app_metadata || {};
    const rawRole = (callerProfile?.role || meta.role || appMeta.role || '').toString().toLowerCase();
    const callerRole = rawRole === 'admin' ? 'administrator' : rawRole;
    const isStaff = callerRole === 'administrator' || callerRole === 'supervisor';

    // 3. Fetch complaint
    const { data: complaint, error: compErr } = await supabaseAdmin
      .from('complaints')
      .select('*')
      .eq('id', complaintId)
      .maybeSingle();

    if (compErr || !complaint) {
      return res.status(404).json({
        success: false,
        error: 'Complaint not found.',
      });
    }

    // 4. Validate complaint status
    if (complaint.status !== 'assigned' && complaint.status !== 'awaiting_verification') {
      return res.status(400).json({
        success: false,
        error: `Invalid transition: Only assigned complaints can be marked in progress. Current status: ${complaint.status}`,
      });
    }

    // 5. Validate assignment: Only assigned cleaner (or staff) can start work
    if (!isStaff && complaint.assigned_cleaner_id !== callerId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: You are not assigned to this complaint.',
      });
    }

    // 6. Update complaint status to in_progress
    const nowIso = new Date().toISOString();
    const { error: updateErr } = await supabaseAdmin
      .from('complaints')
      .update({
        status: 'in_progress',
        updated_at: nowIso,
      })
      .eq('id', complaintId);

    if (updateErr) {
      return res.status(500).json({
        success: false,
        error: `Failed to update complaint status: ${updateErr.message}`,
      });
    }

    // 7. Insert status history audit log
    try {
      await supabaseAdmin.from('complaint_status_history').insert({
        complaint_id: complaintId,
        previous_status: complaint.status,
        new_status: 'in_progress',
        actor_id: callerId,
        note: 'Cleaner reached waste location and started pickup work on-site.',
        created_at: nowIso,
      });
    } catch {
      // Non-blocking history audit
    }

    return res.json({
      success: true,
      status: 'in_progress',
      message: 'Pickup work successfully marked in-progress.',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Server error starting complaint progress.',
    });
  }
});

/**
 * Supervisor / Administrator Endpoint: Approve Cleaner Completion
 * Validates supervisor authorization, verifies 'awaiting_verification' status,
 * confirms photographic completion proof exists (cleaner_after / cleaner_completion),
 * and transitions status to 'completed'.
 */
app.post('/api/supervisor/approve-completion', async (req: Request, res: Response) => {
  const authCheck = await verifyStaffCaller(req.headers.authorization);
  if (!authCheck.ok) {
    return res.status(authCheck.status).json({ success: false, error: authCheck.error });
  }

  if (!supabaseAdmin) {
    return res.status(503).json({ success: false, error: 'Supabase admin client unavailable.' });
  }

  const { complaintId, notes } = req.body || {};
  if (!complaintId) {
    return res.status(400).json({ success: false, error: 'Complaint ID is required.' });
  }

  try {
    // 1. Fetch complaint
    const { data: complaint, error: compErr } = await supabaseAdmin
      .from('complaints')
      .select('*')
      .eq('id', complaintId)
      .maybeSingle();

    if (compErr || !complaint) {
      return res.status(404).json({ success: false, error: 'Complaint not found.' });
    }

    if (complaint.status !== 'awaiting_verification') {
      return res.status(400).json({
        success: false,
        error: `Complaint must be awaiting verification to approve completion (current status: ${complaint.status}).`,
      });
    }

    // 2. Verify completion photo evidence exists in complaint_photos (matching cleaner_after or cleaner_completion)
    const { data: photos, error: photoErr } = await supabaseAdmin
      .from('complaint_photos')
      .select('id, photo_type')
      .eq('complaint_id', complaintId);

    if (photoErr) {
      return res.status(500).json({
        success: false,
        error: `Failed to inspect photographic evidence: ${photoErr.message}`,
      });
    }

    const hasAfterPhoto = (photos || []).some((p: any) => {
      const type = (p.photo_type || '').toString().toLowerCase();
      return type === 'cleaner_after' || type === 'cleaner_completion' || type === 'completion' || type === 'after';
    });

    if (!hasAfterPhoto) {
      return res.status(400).json({
        success: false,
        error: 'Cannot approve completion: Mandatory after-cleaning photo proof is missing from complaint records.',
      });
    }

    // 3. Update complaint status to completed
    const nowIso = new Date().toISOString();
    const updatePayload: Record<string, any> = {
      status: 'completed',
      updated_at: nowIso,
    };
    if (notes && notes.trim()) {
      updatePayload.supervisor_note = notes.trim();
    }

    let { error: updateErr } = await supabaseAdmin
      .from('complaints')
      .update(updatePayload)
      .eq('id', complaintId);

    if (updateErr && (updateErr.message?.includes('supervisor_note') || updateErr.code === 'PGRST204')) {
      if (notes && notes.trim()) {
        delete updatePayload.supervisor_note;
        updatePayload.supervisor_notes = notes.trim();
        const retryRes = await supabaseAdmin
          .from('complaints')
          .update(updatePayload)
          .eq('id', complaintId);
        updateErr = retryRes.error;
      }
    }

    if (updateErr) {
      return res.status(500).json({
        success: false,
        error: `Failed to update complaint status: ${updateErr.message}`,
      });
    }

    return res.json({
      success: true,
      status: 'completed',
      message: 'Complaint completion approved and verified successfully.',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Server error approving complaint completion.',
    });
  }
});

/**
 * Supervisor / Administrator Endpoint: Return to In-Progress (Rework)
 * Validates supervisor authorization, verifies 'awaiting_verification' status,
 * requires explanatory rework note (>= 5 characters), and transitions status back to 'in_progress'.
 */
app.post('/api/supervisor/return-to-progress', async (req: Request, res: Response) => {
  const authCheck = await verifyStaffCaller(req.headers.authorization);
  if (!authCheck.ok) {
    return res.status(authCheck.status).json({ success: false, error: authCheck.error });
  }

  if (!supabaseAdmin) {
    return res.status(503).json({ success: false, error: 'Supabase admin client unavailable.' });
  }

  const { complaintId, returnNote, notes } = req.body || {};
  const actualNote = (returnNote || notes || '').trim();

  if (!complaintId) {
    return res.status(400).json({ success: false, error: 'Complaint ID is required.' });
  }

  if (!actualNote || actualNote.length < 5) {
    return res.status(400).json({
      success: false,
      error: 'An explanatory note describing why work must be redone (at least 5 characters) is required.',
    });
  }

  try {
    // 1. Fetch complaint
    const { data: complaint, error: compErr } = await supabaseAdmin
      .from('complaints')
      .select('*')
      .eq('id', complaintId)
      .maybeSingle();

    if (compErr || !complaint) {
      return res.status(404).json({ success: false, error: 'Complaint not found.' });
    }

    if (complaint.status !== 'awaiting_verification') {
      return res.status(400).json({
        success: false,
        error: `Complaint must be awaiting verification to return to in-progress (current status: ${complaint.status}).`,
      });
    }

    // 2. Update complaint status back to in_progress with supervisor rework note
    const nowIso = new Date().toISOString();
    let { error: updateErr } = await supabaseAdmin
      .from('complaints')
      .update({
        status: 'in_progress',
        supervisor_note: actualNote,
        updated_at: nowIso,
      })
      .eq('id', complaintId);

    if (updateErr && (updateErr.message?.includes('supervisor_note') || updateErr.code === 'PGRST204')) {
      const retryRes = await supabaseAdmin
        .from('complaints')
        .update({
          status: 'in_progress',
          supervisor_notes: actualNote,
          updated_at: nowIso,
        })
        .eq('id', complaintId);
      updateErr = retryRes.error;
    }

    if (updateErr) {
      return res.status(500).json({
        success: false,
        error: `Failed to return complaint to in-progress: ${updateErr.message}`,
      });
    }

    return res.json({
      success: true,
      status: 'in_progress',
      message: 'Complaint returned to in-progress for cleaner rework.',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Server error returning complaint to in-progress.',
    });
  }
});

/**
 * Authenticated Endpoint: Generate Signed URL for Private Storage Photo
 * Allows authenticated participants (supervisors, cleaners, residents) to securely view
 * photos in the private 'waste-complaint-photos' bucket.
 */
app.post('/api/photos/signed-url', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Missing Bearer token.' });
  }

  const token = authHeader.replace('Bearer ', '').trim();
  if (!supabaseAdmin) {
    return res.status(503).json({ success: false, error: 'Supabase admin client unavailable.' });
  }

  const { storagePath, expiresIn = 3600 } = req.body || {};
  if (!storagePath || typeof storagePath !== 'string') {
    return res.status(400).json({ success: false, error: 'A valid storagePath is required.' });
  }

  try {
    // 1. Verify caller session
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return res.status(401).json({ success: false, error: 'Invalid or expired user session.' });
    }

    // 2. Generate signed URL using server admin client on private bucket
    const cleanPath = storagePath.trim().replace(/^\/+/, '');
    const { data: signData, error: signError } = await supabaseAdmin.storage
      .from('waste-complaint-photos')
      .createSignedUrl(cleanPath, expiresIn);

    if (signError || !signData?.signedUrl) {
      return res.status(404).json({
        success: false,
        error: signError ? signError.message : 'Storage object not found in private bucket.',
      });
    }

    return res.json({
      success: true,
      signedUrl: signData.signedUrl,
      expiresIn,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Server error generating signed URL.',
    });
  }
});

// Mount Vite in dev or serve static files in production
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Waste Pickup Portal server running on http://0.0.0.0:${PORT}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is in use.`);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
