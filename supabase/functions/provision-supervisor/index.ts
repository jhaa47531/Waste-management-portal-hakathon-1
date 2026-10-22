// Supabase Edge Function: provision-supervisor
// Follows Supabase Edge Function conventions (Deno runtime)
// Automatically has access to SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    // Verify caller token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid user token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify admin role in profiles
    const { data: profile } = await userClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || (profile.role !== 'admin' && profile.role !== 'administrator')) {
      return new Response(JSON.stringify({ error: 'Forbidden: Caller is not an Administrator' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { email, fullName, phoneNumber } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = (fullName || '').trim() || 'Municipal Supervisor';
    const cleanPhone = (phoneNumber || '').trim() || '0000000000';

    // Admin Client with Service Role Key
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user exists in auth.users
    let targetUserId: string;
    let isNewUser = false;

    const { data: userList } = await adminClient.auth.admin.listUsers();
    const existing = userList?.users?.find((u: any) => u.email?.toLowerCase() === cleanEmail);

    if (existing) {
      targetUserId = existing.id;
    } else {
      const tempPassword = 'Sup!' + Math.random().toString(36).substring(2, 10) + '9A#';
      const { data: created, error: createError } = await adminClient.auth.admin.createUser({
        email: cleanEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: cleanName, phone_number: cleanPhone },
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      targetUserId = created.user.id;
      isNewUser = true;
    }

    // Upsert profiles
    const { error: profileError } = await adminClient.from('profiles').upsert({
      id: targetUserId,
      email: cleanEmail,
      full_name: cleanName,
      phone_number: cleanPhone,
      role: 'supervisor',
      account_status: 'active',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

    if (profileError) {
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: isNewUser ? 'created' : 'promoted',
        user: {
          id: targetUserId,
          email: cleanEmail,
          fullName: cleanName,
          phoneNumber: cleanPhone,
          role: 'supervisor',
          accountStatus: 'active',
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
