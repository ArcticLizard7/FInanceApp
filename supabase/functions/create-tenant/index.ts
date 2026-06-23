import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type TenantPlan = 'trial' | 'standard' | 'enterprise';

interface CreateTenantBody {
  name: string;
  slug: string;
  colour: string;
  plan: TenantPlan;
  contactName: string;
  contactEmail: string;
  notes: string;
  settings: Record<string, unknown>;
  adminUsername: string;
  adminDisplayName: string;
  adminEmail: string;
  adminPassword: string;
  sessionAccessToken?: string;
}

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const cleanSlug = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '');

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

  const body = await req.json() as Partial<CreateTenantBody>;
  const authHeader = req.headers.get('Authorization');
  const accessToken = body.sessionAccessToken || authHeader?.replace(/^Bearer\s+/i, '');

  if (!accessToken) {
    return json(401, { error: 'You must be signed in to create tenants.' });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await adminClient.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return json(401, { error: 'Your session could not be verified.' });
  }

  const { data: actor, error: actorError } = await adminClient
    .from('profiles')
    .select('id, role, is_active')
    .eq('id', authData.user.id)
    .single();

  if (actorError || !actor) {
    return json(403, { error: 'No administrator profile exists for the signed-in user.' });
  }

  if (actor.role !== 'platform_admin' || !actor.is_active) {
    return json(403, { error: 'Only an active platform administrator can create tenants.' });
  }

  const name = body.name?.trim();
  const slug = cleanSlug(body.slug ?? '');
  const colour = body.colour?.trim() || '#6366f1';
  const plan = body.plan ?? 'standard';
  const adminUsername = body.adminUsername?.trim().toLowerCase();
  const adminDisplayName = body.adminDisplayName?.trim() || 'Tenant Administrator';
  const adminEmail = body.adminEmail?.trim().toLowerCase();

  if (!name || !slug || !adminUsername || !adminEmail || !body.adminPassword) {
    return json(400, { error: 'Tenant name, slug, admin username, admin email, and admin password are required.' });
  }

  if (body.adminPassword.length < 8) {
    return json(400, { error: 'Admin password must be at least 8 characters.' });
  }

  if (!['trial', 'standard', 'enterprise'].includes(plan)) {
    return json(400, { error: 'Select a valid tenant plan.' });
  }

  const { error: adminCheckError } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1,
  });

  if (adminCheckError) {
    return json(500, {
      error: 'Supabase Edge Function service role key is not configured correctly. Set SUPABASE_SERVICE_ROLE_KEY to the project service_role secret.',
    });
  }

  const { data: existingTenant } = await adminClient
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (existingTenant) {
    return json(409, { error: 'That tenant slug is already taken.' });
  }

  const [{ data: existingUsername }, { data: existingEmail }] = await Promise.all([
    adminClient.from('profiles').select('id').eq('username', adminUsername).maybeSingle(),
    adminClient.from('profiles').select('id').eq('email', adminEmail).maybeSingle(),
  ]);

  if (existingUsername || existingEmail) {
    return json(409, { error: 'A user with that username or email already exists.' });
  }

  const tenantId = crypto.randomUUID();
  const workspaceId = crypto.randomUUID();
  let createdAuthUserId: string | null = null;
  let tenantInserted = false;

  const tenantInsert = {
    id: tenantId,
    name,
    slug,
    colour,
    plan,
    status: 'active',
    settings: body.settings ?? {},
    contact_name: body.contactName?.trim() ?? '',
    contact_email: body.contactEmail?.trim() ?? '',
    notes: body.notes?.trim() ?? '',
    created_by: authData.user.id,
  };

  const { data: tenant, error: tenantError } = await adminClient
    .from('tenants')
    .insert(tenantInsert)
    .select('*')
    .single();

  if (tenantError || !tenant) {
    return json(400, { error: tenantError?.message ?? 'Could not create the tenant.' });
  }

  tenantInserted = true;

  const { data: workspace, error: workspaceError } = await adminClient
    .from('workspaces')
    .insert({
      id: workspaceId,
      tenant_id: tenantId,
      name: 'Main Workspace',
      type: 'company',
      colour,
      currency: 'GBP',
      is_default: true,
      is_archived: false,
      hide_finance_features: false,
    })
    .select('*')
    .single();

  if (workspaceError || !workspace) {
    if (tenantInserted) await adminClient.from('tenants').delete().eq('id', tenantId);
    return json(400, { error: workspaceError?.message ?? 'Could not create the default workspace.' });
  }

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email: adminEmail,
    password: body.adminPassword,
    email_confirm: true,
    user_metadata: { display_name: adminDisplayName, username: adminUsername },
    app_metadata: { tenant_id: tenantId, role: 'tenant_admin' },
  });

  if (createError || !created.user) {
    if (tenantInserted) await adminClient.from('tenants').delete().eq('id', tenantId);
    return json(400, { error: createError?.message ?? 'Could not create the tenant administrator Auth user.' });
  }

  createdAuthUserId = created.user.id;

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .insert({
      id: created.user.id,
      tenant_id: tenantId,
      username: adminUsername,
      display_name: adminDisplayName,
      email: adminEmail,
      role: 'tenant_admin',
      workspace_access: [],
      is_active: true,
      mfa_enabled: true,
      created_by: authData.user.id,
    })
    .select('*')
    .single();

  if (profileError || !profile) {
    if (createdAuthUserId) await adminClient.auth.admin.deleteUser(createdAuthUserId);
    if (tenantInserted) await adminClient.from('tenants').delete().eq('id', tenantId);
    return json(400, { error: profileError?.message ?? 'Could not create the tenant administrator profile.' });
  }

  return json(200, { tenant, workspace, profile });
});
