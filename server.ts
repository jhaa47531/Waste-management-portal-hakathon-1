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
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

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
  const { email, fullName, phoneNumber } = req.body || {};

  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, error: 'A valid email address is required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = (fullName || '').trim() || 'Municipal Supervisor';
  const cleanPhone = (phoneNumber || '').trim() || '0000000000';

  const isPlaceholderUrl =
    !supabaseUrl || supabaseUrl.includes('your-project') || supabaseUrl.includes('example.com');

  if (isPlaceholderUrl) {
    return res.status(503).json({
      success: false,
      error:
        'Supabase is currently running in local demonstration mode (VITE_SUPABASE_URL is unconfigured or placeholder).',
    });
  }

  try {
    // 1. Verify caller identity using the public Supabase client
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return res.status(401).json({
        success: false,
        error: `Authentication failed: ${userError?.message || 'Invalid session'}`,
      });
    }

    const callerId = userData.user.id;

    // 2. Verify caller has Administrator role in public.profiles
    const { data: callerProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', callerId)
      .maybeSingle();

    if (profileError || !callerProfile || (callerProfile.role !== 'admin' && callerProfile.role !== 'administrator')) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Only designated Administrators are authorized to provision supervisors.',
      });
    }

    // 3. If service role key is NOT available on the server
    if (!supabaseServiceRoleKey) {
      // Check if target user already exists in public.profiles
      const { data: existingProfile } = await supabaseClient
        .from('profiles')
        .select('id, email, full_name, phone_number, role')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (existingProfile) {
        // Promote existing profile using the secure RPC
        const { error: rpcError } = await supabaseClient.rpc('provision_supervisor', {
          p_user_id: existingProfile.id,
        });

        if (rpcError) {
          return res.status(500).json({
            success: false,
            error: `Failed to promote existing user: ${rpcError.message}`,
          });
        }

        return res.json({
          success: true,
          status: 'promoted',
          message: `User ${cleanEmail} was found in profiles and has been promoted to Supervisor.`,
          user: {
            id: existingProfile.id,
            email: cleanEmail,
            fullName: cleanName || existingProfile.full_name,
            phoneNumber: cleanPhone || existingProfile.phone_number,
            role: 'supervisor',
            accountStatus: 'active',
          },
        });
      }

      // Neither service role key nor existing profile found
      return res.status(501).json({
        success: false,
        backendConfigured: false,
        error: `User ${cleanEmail} has not yet registered in Supabase Auth. Automated Auth user creation requires SUPABASE_SERVICE_ROLE_KEY in AI Studio Secrets (or deploying the provision-supervisor Edge Function). Alternatively, invite ${cleanEmail} via the Supabase Dashboard Auth tab.`,
      });
    }

    // 4. Service role key IS configured: provision Auth user securely via Admin API
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let targetUserId: string | null = null;
    let isNewUser = false;

    // Check if user already exists in auth.users
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
    const existingAuthUser = userList?.users?.find(
      (u) => u.email?.toLowerCase() === cleanEmail
    );

    if (existingAuthUser) {
      targetUserId = existingAuthUser.id;
    } else {
      // Generate a secure initial temporary password
      const tempPassword = 'Sup!' + Math.random().toString(36).substring(2, 12) + '9A#';
      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: cleanName,
          phone_number: cleanPhone,
        },
      });

      if (createError) {
        return res.status(400).json({
          success: false,
          error: `Failed to create Supabase Auth user: ${createError.message}`,
        });
      }

      targetUserId = created.user.id;
      isNewUser = true;
    }

    // Upsert public.profiles record with role 'supervisor' and status 'active'
    const { error: profileUpsertError } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: targetUserId,
          email: cleanEmail,
          full_name: cleanName,
          phone_number: cleanPhone,
          role: 'supervisor',
          account_status: 'active',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

    if (profileUpsertError) {
      return res.status(500).json({
        success: false,
        error: `User created in Auth (${targetUserId}), but profile update failed: ${profileUpsertError.message}`,
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
