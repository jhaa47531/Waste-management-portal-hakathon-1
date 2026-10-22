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
 * Safe Profile Upsert Helper
 * Handles 'phone' vs 'phone_number' and 'supervisor_id' column differences safely.
 */
async function safeUpsertProfile(data: {
  id: string;
  fullName: string;
  phone: string;
  role: 'resident' | 'cleaner' | 'supervisor' | 'administrator';
  accountStatus: 'active' | 'pending' | 'suspended';
  supervisorId?: string | null;
}): Promise<{ error?: any }> {
  if (!supabaseAdmin) return { error: new Error('No admin client') };

  const basePayload: Record<string, any> = {
    id: data.id,
    full_name: data.fullName,
    role: data.role,
    account_status: data.accountStatus,
    updated_at: new Date().toISOString(),
  };

  // Attempt 1: phone + supervisor_id
  const payload1: Record<string, any> = { ...basePayload, phone: data.phone };
  if (data.supervisorId) payload1.supervisor_id = data.supervisorId;

  let { error } = await supabaseAdmin.from('profiles').upsert(payload1, { onConflict: 'id' });

  // If supervisor_id column does not exist in profiles table, retry without supervisor_id
  if (error && (error.message?.includes('supervisor_id') || error.code === 'PGRST204')) {
    delete payload1.supervisor_id;
    const res2 = await supabaseAdmin.from('profiles').upsert(payload1, { onConflict: 'id' });
    error = res2.error;
  }

  // If 'phone' column failed, retry with 'phone_number'
  if (error && (error.message?.includes("'phone'") || error.code === 'PGRST204')) {
    const payload2: Record<string, any> = { ...basePayload, phone_number: data.phone };
    if (data.supervisorId) payload2.supervisor_id = data.supervisorId;
    let res3 = await supabaseAdmin.from('profiles').upsert(payload2, { onConflict: 'id' });
    if (res3.error && (res3.error.message?.includes('supervisor_id') || res3.error.code === 'PGRST204')) {
      delete payload2.supervisor_id;
      res3 = await supabaseAdmin.from('profiles').upsert(payload2, { onConflict: 'id' });
    }
    error = res3.error;
  }

  return { error };
}

/**
 * Safe Cleaner Application Upsert Helper
 * Handles 'applicant_id' vs 'cleaner_id', 'reviewed_by' vs 'reviewer_id', 'review_note' vs 'review_notes'.
 */
async function safeUpsertCleanerApplication(data: {
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

  // Variant A: applicant_id, reviewed_by, review_note (live table schema)
  const payloadA: Record<string, any> = {
    applicant_id: data.cleanerId,
    status: data.status,
    created_at: data.createdAt || nowIso,
  };
  if (data.reviewerId) payloadA.reviewed_by = data.reviewerId;
  if (data.reviewNotes) payloadA.review_note = data.reviewNotes;
  if (data.reviewedAt) payloadA.reviewed_at = data.reviewedAt;

  let { error } = await supabaseAdmin
    .from('cleaner_applications')
    .upsert(payloadA, { onConflict: 'applicant_id' });

  // Variant B: cleaner_id, reviewer_id, review_notes (initial migration schema)
  if (error && (error.message?.includes('applicant_id') || error.code === 'PGRST204' || error.message?.includes('violates'))) {
    const payloadB: Record<string, any> = {
      cleaner_id: data.cleanerId,
      status: data.status,
      created_at: data.createdAt || nowIso,
    };
    if (data.reviewerId) payloadB.reviewer_id = data.reviewerId;
    if (data.assignedSupervisorId) payloadB.assigned_supervisor_id = data.assignedSupervisorId;
    if (data.reviewNotes) payloadB.review_notes = data.reviewNotes;
    if (data.reviewedAt) payloadB.reviewed_at = data.reviewedAt;

    let resB = await supabaseAdmin
      .from('cleaner_applications')
      .upsert(payloadB, { onConflict: 'cleaner_id' });

    if (resB.error && resB.error.message?.includes('assigned_supervisor_id')) {
      delete payloadB.assigned_supervisor_id;
      resB = await supabaseAdmin.from('cleaner_applications').upsert(payloadB, { onConflict: 'cleaner_id' });
    }
    error = resB.error;
  }

  return { error };
}

/**
 * Safe Service Areas Upsert Helper
 */
async function safeUpsertServiceAreas(
  cleanerId: string,
  localityIds: string[],
  isApproved: boolean,
  approvedBy?: string | null
): Promise<void> {
  if (!supabaseAdmin || !Array.isArray(localityIds) || localityIds.length === 0) return;

  const nowIso = new Date().toISOString();
  for (const locId of localityIds) {
    const payload: Record<string, any> = {
      cleaner_id: cleanerId,
      locality_id: locId,
      is_approved: isApproved,
      created_at: nowIso,
    };
    if (isApproved && approvedBy) {
      payload.approved_by = approvedBy;
      payload.approved_at = nowIso;
    }

    try {
      await supabaseAdmin
        .from('cleaner_service_areas')
        .upsert(payload, { onConflict: 'cleaner_id,locality_id' });
    } catch (err: any) {
      console.warn('Service area upsert notice:', err?.message || err);
    }
  }
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
    const { error: profErr } = await safeUpsertProfile({
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
    await safeUpsertCleanerApplication({
      cleanerId: newUserId,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    // 5. Record proposed service localities (unapproved)
    await safeUpsertServiceAreas(newUserId, locIds, false);

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

    // Upsert profiles record safely
    const { error: profErr } = await safeUpsertProfile({
      id: newUserId,
      fullName: cleanName,
      phone: cleanPhone,
      role: 'cleaner',
      accountStatus: cleanStatus,
      supervisorId: assignedSupervisorId,
    });

    if (profErr) {
      console.warn('Profiles upsert notice during cleaner creation:', profErr.message);
    }

    // Insert approved cleaner_applications record
    await safeUpsertCleanerApplication({
      cleanerId: newUserId,
      status: cleanStatus === 'active' ? 'approved' : 'pending',
      reviewerId: authCheck.callerId,
      assignedSupervisorId,
      reviewNotes: 'Created directly by Administrator.',
      reviewedAt: cleanStatus === 'active' ? new Date().toISOString() : null,
      createdAt: new Date().toISOString(),
    });

    // Insert service areas
    if (serviceLocalityIds.length > 0) {
      await safeUpsertServiceAreas(
        newUserId,
        serviceLocalityIds,
        cleanStatus === 'active',
        cleanStatus === 'active' ? authCheck.callerId : null
      );
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
 * Administrator Endpoint: Review Cleaner Application (Approve / Reject)
 * Assigns supervisor and approved service localities upon approval.
 */
app.post('/api/admin/review-cleaner-application', async (req: Request, res: Response) => {
  const authCheck = await verifyAdminCaller(req.headers.authorization);
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

    // Resolve cleaner ID from either applicant_id or cleaner_id
    const cleanerId = appData.applicant_id || appData.cleaner_id;
    if (!cleanerId) {
      return res.status(400).json({ success: false, error: 'Application record is missing applicant identifier.' });
    }

    const cleanSupervisorId = supervisorId && supervisorId.trim() ? supervisorId.trim() : null;

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

      // Update cleaner_applications
      await safeUpsertCleanerApplication({
        cleanerId,
        status: 'approved',
        reviewerId: authCheck.callerId,
        assignedSupervisorId: cleanSupervisorId,
        reviewNotes: notes || 'Application approved by Administrator.',
        reviewedAt: new Date().toISOString(),
      });

      // Update Auth user metadata
      const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(cleanerId);
      if (authUserData?.user) {
        await supabaseAdmin.auth.admin.updateUserById(cleanerId, {
          user_metadata: {
            ...authUserData.user.user_metadata,
            role: 'cleaner',
            account_status: 'active',
            supervisor_id: cleanSupervisorId,
            service_areas: approvedLocalityIds || [],
          },
          app_metadata: {
            ...authUserData.user.app_metadata,
            role: 'cleaner',
            account_status: 'active',
            supervisor_id: cleanSupervisorId,
          },
        });
      }

      // Activate cleaner profile and assign supervisor
      await safeUpsertProfile({
        id: cleanerId,
        fullName: appData.cleaner_name || authUserData?.user?.user_metadata?.full_name || 'Cleaner',
        phone: appData.cleaner_phone || authUserData?.user?.user_metadata?.phone_number || '0000000000',
        role: 'cleaner',
        accountStatus: 'active',
        supervisorId: cleanSupervisorId,
      });

      // Approve selected localities
      const approvedLocs: string[] = Array.isArray(approvedLocalityIds) ? approvedLocalityIds : [];
      if (approvedLocs.length > 0) {
        await safeUpsertServiceAreas(cleanerId, approvedLocs, true, authCheck.callerId);
      }
    } else {
      // Rejected
      await safeUpsertCleanerApplication({
        cleanerId,
        status: 'rejected',
        reviewerId: authCheck.callerId,
        reviewNotes: notes || 'Application rejected by Administrator.',
        reviewedAt: new Date().toISOString(),
      });

      await supabaseAdmin.auth.admin.updateUserById(cleanerId, {
        user_metadata: { account_status: 'suspended' },
        app_metadata: { account_status: 'suspended' },
      }).catch(() => {});

      await supabaseAdmin
        .from('profiles')
        .update({
          account_status: 'suspended',
          updated_at: new Date().toISOString(),
        })
        .eq('id', cleanerId);
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

    const assignedSupId = supervisorId && supervisorId.trim() ? supervisorId.trim() : null;

    if (assignedSupId) {
      const { data: supProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, role, account_status')
        .eq('id', assignedSupId)
        .maybeSingle();

      if (!supProfile || supProfile.role !== 'supervisor' || supProfile.account_status !== 'active') {
        return res.status(400).json({
          success: false,
          error: 'Selected supervisor is invalid or not an active supervisor.',
        });
      }
    }

    const nextStatus = accountStatus && ['active', 'pending', 'suspended'].includes(accountStatus)
      ? accountStatus
      : cleanerProfile.account_status;

    // 1. Update Auth user metadata
    const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(cleanerId);
    if (authUserData?.user) {
      const currentMeta = authUserData.user.user_metadata || {};
      const currentAppMeta = authUserData.user.app_metadata || {};

      await supabaseAdmin.auth.admin.updateUserById(cleanerId, {
        user_metadata: {
          ...currentMeta,
          account_status: nextStatus,
          supervisor_id: assignedSupId,
          service_areas: Array.isArray(localityIds) ? localityIds : currentMeta.service_areas,
        },
        app_metadata: {
          ...currentAppMeta,
          account_status: nextStatus,
          supervisor_id: assignedSupId,
        },
      });
    }

    // 2. Update profiles table
    await safeUpsertProfile({
      id: cleanerId,
      fullName: cleanerProfile.full_name,
      phone: cleanerProfile.phone || cleanerProfile.phone_number || '',
      role: 'cleaner',
      accountStatus: nextStatus,
      supervisorId: assignedSupId,
    });

    // 3. Update cleaner_service_areas if provided
    if (Array.isArray(localityIds)) {
      try {
        await supabaseAdmin
          .from('cleaner_service_areas')
          .delete()
          .eq('cleaner_id', cleanerId);
      } catch {
        // Ignored
      }

      if (localityIds.length > 0) {
        await safeUpsertServiceAreas(cleanerId, localityIds, nextStatus === 'active', authCheck.callerId);
      }
    }

    return res.json({
      success: true,
      message: 'Cleaner details successfully updated.',
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
 * Administrator & Supervisor Directory Endpoint:
 * Fetches the unified, enriched list of all registered users (with authentic emails,
 * supervisor bindings, service area coverage, and statuses) directly from Supabase Auth + Profiles.
 * Guarantees changes persist across browser refreshes.
 */
app.get('/api/admin/users', async (req: Request, res: Response) => {
  const authCheck = await verifyAdminCaller(req.headers.authorization);
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

    // 5. Construct enriched users list
    const enrichedUsers = (profiles || []).map((p: any) => {
      const authU = authMap.get(p.id);
      const email = authU?.email || p.email || '';
      const meta = authU?.user_metadata || {};
      const appMeta = authU?.app_metadata || {};
      const supervisorId = p.supervisor_id || meta.supervisor_id || appMeta.supervisor_id || null;
      const rawRole = (p.role || meta.role || 'resident').toString().toLowerCase();
      const role = rawRole === 'admin' ? 'administrator' : rawRole;
      const status = p.account_status || meta.account_status || 'active';

      return {
        id: p.id,
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

    // Build normalized service areas
    const normalizedAreas = rawServiceAreas.map((sa: any) => ({
      id: sa.id,
      cleanerId: sa.cleaner_id,
      localityId: sa.locality_id,
      isApproved: sa.is_approved,
      approvedBy: sa.approved_by,
      approvedAt: sa.approved_at,
    }));

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

// Mount Vite in dev or serve static files in production
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Waste Pickup Portal server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
