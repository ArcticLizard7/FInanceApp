-- Run this after:
-- 1. Applying supabase/migrations/001_initial_safe_online_schema.sql
-- 2. Creating your first user in Supabase Auth
--
-- Replace the placeholders below before running.

do $$
declare
  admin_user_id uuid := '00000000-0000-0000-0000-000000000000';
  tenant_id uuid := gen_random_uuid();
  workspace_id uuid := gen_random_uuid();
begin
  insert into public.profiles (
    id,
    tenant_id,
    username,
    display_name,
    email,
    role,
    workspace_access,
    is_active,
    mfa_enabled,
    created_by
  ) values (
    admin_user_id,
    null,
    'owner@example.com',
    'Owner',
    'owner@example.com',
    'platform_admin',
    '{}',
    true,
    false,
    null
  )
  on conflict (id) do update set
    role = excluded.role,
    tenant_id = excluded.tenant_id,
    updated_at = now();

  insert into public.tenants (
    id,
    name,
    slug,
    colour,
    plan,
    status,
    settings,
    contact_name,
    contact_email,
    created_by
  ) values (
    tenant_id,
    'Your Organisation',
    'your-organisation',
    '#6366f1',
    'standard',
    'active',
    '{"maxUsers":0,"maxWorkspaces":0,"enableExcelImport":true,"enableEmailDelegation":true,"enableReports":true}'::jsonb,
    'Owner',
    'owner@example.com',
    admin_user_id
  );

  insert into public.workspaces (
    id,
    tenant_id,
    name,
    type,
    colour,
    currency,
    is_default,
    hide_finance_features
  ) values (
    workspace_id,
    tenant_id,
    'Main Workspace',
    'company',
    '#6366f1',
    'GBP',
    true,
    false
  );
end $$;
