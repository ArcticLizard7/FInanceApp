import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type UserRole = 'tenant_admin' | 'finance_director' | 'finance_manager' | 'accounts_assistant';

interface CreateUserBody {
  username: string;
  displayName: string;
  email: string;
  password: string;
  role: UserRole;
  tenantId: string;
  workspaceAccess: string[];
  isActive: boolean;
  mfaEnabled: boolean;
  createdBy: string | null;
  sessionAccessToken?: string;
}

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: 'Supabase function environment is not configured.' });
  }

  const body = await req.json() as Partial<CreateUserBody>;
  const authHeader = req.headers.get('Authorization');
  const accessToken = body.sessionAccessToken || authHeader?.replace(/^Bearer\s+/i, '');

  if (!accessToken) {
    return json(401, { error: 'You must be signed in to create users.' });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await adminClient.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return json(401, { error: 'Your session could not be verified.' });
  }

  const email = body.email?.trim().toLowerCase();
  const username = body.username?.trim().toLowerCase();
  const displayName = body.displayName?.trim();
  const tenantId = body.tenantId;
  const role = body.role;
  const workspaceAccess = Array.isArray(body.workspaceAccess) ? body.workspaceAccess : [];

  if (!email || !username || !displayName || !body.password || !tenantId || !role) {
    return json(400, { error: 'Username, display name, email, password, role, and tenant are required.' });
  }

  if (body.password.length < 8) {
    return json(400, { error: 'Password must be at least 8 characters.' });
  }

  if (role === 'platform_admin') {
    return json(403, { error: 'Tenant users cannot be platform administrators.' });
  }

  const { data: actor, error: actorError } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single();

  if (actorError || !actor) {
    return json(403, { error: 'No administrator profile exists for the signed-in user.' });
  }

  if (!actor.is_active) {
    return json(403, { error: 'Your administrator profile is not active.' });
  }

  const isPlatformAdmin = actor.role === 'platform_admin';
  const isTenantAdmin = actor.role === 'tenant_admin' && actor.tenant_id === tenantId;

  if (!isPlatformAdmin && !isTenantAdmin) {
    return json(403, { error: 'You do not have permission to create users for this tenant.' });
  }

  const { data: tenant, error: tenantError } = await adminClient
    .from('tenants')
    .select('id, settings')
    .eq('id', tenantId)
    .single();

  if (tenantError || !tenant) {
    return json(404, { error: 'Tenant not found.' });
  }

  const maxUsers = Number(tenant.settings?.maxUsers ?? 0);
  if (maxUsers > 0) {
    const { count, error: countError } = await adminClient
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    if (countError) {
      return json(500, { error: 'Could not check the tenant user limit.' });
    }

    if ((count ?? 0) >= maxUsers) {
      return json(400, { error: `This tenant is limited to ${maxUsers} users.` });
    }
  }

  const { data: existingUsername } = await adminClient
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();

  const { data: existingEmail } = await adminClient
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existingUsername || existingEmail) {
    return json(409, { error: 'A user with that username or email already exists.' });
  }

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password: body.password,
    email_confirm: true,
    user_metadata: { display_name: displayName, username },
    app_metadata: { tenant_id: tenantId, role },
  });

  if (createError || !created.user) {
    return json(400, { error: createError?.message ?? 'Could not create the Auth user.' });
  }

  const profile = {
    id: created.user.id,
    tenant_id: tenantId,
    username,
    display_name: displayName,
    email,
    role,
    workspace_access: workspaceAccess,
    is_active: body.isActive ?? true,
    mfa_enabled: body.mfaEnabled ?? false,
    created_by: body.createdBy ?? authData.user.id,
  };

  const { data: insertedProfile, error: profileError } = await adminClient
    .from('profiles')
    .insert(profile)
    .select('*')
    .single();

  if (profileError) {
    await adminClient.auth.admin.deleteUser(created.user.id);
    return json(400, { error: profileError.message });
  }

  return json(200, { profile: insertedProfile });
});
