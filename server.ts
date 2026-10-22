/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from 'express';
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
