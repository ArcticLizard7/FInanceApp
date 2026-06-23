-- FinanceFlow deployment health check
-- Run this in the Supabase SQL Editor after applying migrations and before/after a Netlify deploy.
-- It is read-only and should return zero rows for every section marked "should_be_empty".

-- 1) Auth users that cannot log into the app because public.profiles is missing.
select
  'auth_users_missing_profiles_should_be_empty' as check_name,
  au.id,
  au.email
from auth.users au
left join public.profiles p on p.id = au.id
where p.id is null;

-- 2) Profiles that violate the app's tenant rules.
select
  'invalid_profile_tenant_links_should_be_empty' as check_name,
  p.id,
  p.email,
  p.role,
  p.tenant_id
from public.profiles p
where
  (p.role = 'platform_admin' and p.tenant_id is not null)
  or
  (p.role <> 'platform_admin' and p.tenant_id is null)
  or
  (p.tenant_id is not null and not exists (
    select 1 from public.tenants t where t.id = p.tenant_id
  ));

-- 3) Active tenants with no workspace. Entering these tenants gives the app no active workspace.
select
  'active_tenants_without_workspaces_should_be_empty' as check_name,
  t.id,
  t.name,
  t.slug
from public.tenants t
where t.status = 'active'
  and not exists (
    select 1 from public.workspaces w where w.tenant_id = t.id
  );

-- 4) Active tenants with workspaces but no default workspace.
select
  'active_tenants_without_default_workspace_should_be_empty' as check_name,
  t.id,
  t.name,
  t.slug
from public.tenants t
where t.status = 'active'
  and exists (
    select 1 from public.workspaces w where w.tenant_id = t.id
  )
  and not exists (
    select 1 from public.workspaces w where w.tenant_id = t.id and w.is_default
  );

-- 5) Expected app table summary.
select
  'app_table_summary' as check_name,
  table_name,
  rls_enabled,
  row_count_estimate
from (
  select
    c.relname as table_name,
    c.relrowsecurity as rls_enabled,
    c.reltuples::bigint as row_count_estimate
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname in (
      'tenants',
      'profiles',
      'workspaces',
      'user_preferences',
      'tasks',
    'contacts',
    'payment_requests',
    'budget_profiles',
    'budget_categories',
    'monthly_budgets',
    'monthly_budget_income',
    'budget_transactions',
    'debt_groups',
    'debt_accounts',
    'debt_repayments',
    'debt_balance_snapshots',
    'notifications'
    )
) tables
order by table_name;

-- 6) Missing authenticated grants for the app's Data API tables.
with expected_tables(table_name) as (
  values
    ('tenants'),
    ('profiles'),
    ('workspaces'),
    ('user_preferences'),
    ('tasks'),
    ('contacts'),
    ('payment_requests'),
    ('budget_profiles'),
    ('budget_categories'),
    ('monthly_budgets'),
    ('monthly_budget_income'),
    ('budget_transactions'),
    ('debt_groups'),
    ('debt_accounts'),
    ('debt_repayments'),
    ('debt_balance_snapshots'),
    ('notifications')
),
expected_privileges(privilege_type) as (
  values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')
)
select
  'missing_authenticated_table_grants_should_be_empty' as check_name,
  et.table_name,
  ep.privilege_type
from expected_tables et
cross join expected_privileges ep
where not exists (
  select 1
  from information_schema.role_table_grants g
  where g.table_schema = 'public'
    and g.table_name = et.table_name
    and g.grantee = 'authenticated'
    and g.privilege_type = ep.privilege_type
)
order by et.table_name, ep.privilege_type;

-- 7) RLS helper functions expected by policies.
select
  'rls_helper_functions' as check_name,
  n.nspname as schema_name,
  p.proname as function_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'private'
  and p.proname in (
    'current_user_role',
    'current_tenant_id',
    'is_platform_admin',
    'same_tenant'
  )
order by p.proname;
