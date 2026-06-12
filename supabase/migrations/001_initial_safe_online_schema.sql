create extension if not exists pgcrypto;

create type public.user_role as enum (
  'platform_admin',
  'tenant_admin',
  'finance_director',
  'finance_manager',
  'accounts_assistant'
);

create type public.tenant_plan as enum ('trial', 'standard', 'enterprise');
create type public.tenant_status as enum ('active', 'suspended', 'archived');
create type public.workspace_type as enum ('company', 'personal');
create type public.task_status as enum ('todo', 'in_progress', 'waiting', 'completed', 'cancelled');
create type public.priority as enum ('low', 'medium', 'high', 'critical');
create type public.task_category as enum (
  'payment_requests',
  'invoices',
  'approvals',
  'reporting',
  'vat_tax',
  'payroll',
  'project_finance',
  'general_admin',
  'personal'
);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  colour text not null default '#6366f1',
  plan public.tenant_plan not null default 'trial',
  status public.tenant_status not null default 'active',
  settings jsonb not null default '{}'::jsonb,
  contact_name text not null default '',
  contact_email text not null default '',
  notes text not null default '',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  username text not null unique,
  display_name text not null,
  email text not null,
  role public.user_role not null default 'accounts_assistant',
  workspace_access uuid[] not null default '{}',
  is_active boolean not null default true,
  mfa_enabled boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_admin_has_no_tenant check (
    (role = 'platform_admin' and tenant_id is null) or
    (role <> 'platform_admin' and tenant_id is not null)
  )
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  type public.workspace_type not null default 'company',
  colour text not null default '#6366f1',
  is_default boolean not null default false,
  is_archived boolean not null default false,
  hide_finance_features boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_workspace_id uuid references public.workspaces(id) on delete set null,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  description text not null default '',
  category public.task_category not null default 'general_admin',
  status public.task_status not null default 'todo',
  priority public.priority not null default 'medium',
  due_date timestamptz,
  assigned_to uuid,
  assigned_to_name text,
  assigned_to_email text,
  delegated_by uuid references auth.users(id),
  notes text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  checklist jsonb not null default '[]'::jsonb,
  recurrence jsonb,
  reminder jsonb,
  parent_task_id uuid references public.tasks(id) on delete set null,
  linked_payment_request_id uuid,
  tags text[] not null default '{}',
  completed_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  email text not null default '',
  role text not null default '',
  company text not null default '',
  phone text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  supplier text not null,
  project text not null default '',
  description text not null default '',
  amount numeric(12, 2) not null default 0,
  vat_amount numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  currency text not null default 'GBP',
  due_date timestamptz not null,
  requested_by text not null default '',
  approval_status text not null default 'draft',
  payment_status text not null default 'unpaid',
  approved_by text,
  approved_at timestamptz,
  paid_at timestamptz,
  scheduled_date timestamptz,
  notes text not null default '',
  linked_task_id uuid references public.tasks(id) on delete set null,
  recurrence jsonb,
  invoice_reference text not null default '',
  purchase_order_number text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks
  add constraint tasks_linked_payment_fk
  foreign key (linked_payment_request_id)
  references public.payment_requests(id)
  on delete set null;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  related_id uuid,
  related_type text,
  is_read boolean not null default false,
  is_dismissed boolean not null default false,
  snoozed_until timestamptz,
  created_at timestamptz not null default now()
);

create index profiles_tenant_id_idx on public.profiles(tenant_id);
create index workspaces_tenant_id_idx on public.workspaces(tenant_id);
create index tasks_tenant_workspace_idx on public.tasks(tenant_id, workspace_id);
create index payment_requests_tenant_workspace_idx on public.payment_requests(tenant_id, workspace_id);
create index contacts_tenant_workspace_idx on public.contacts(tenant_id, workspace_id);
create index notifications_tenant_workspace_idx on public.notifications(tenant_id, workspace_id);

create or replace function public.current_user_role()
returns public.user_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.current_tenant_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select tenant_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_user_role() = 'platform_admin'
$$;

create or replace function public.same_tenant(row_tenant_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_platform_admin() or row_tenant_id = public.current_tenant_id()
$$;

alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.user_preferences enable row level security;
alter table public.tasks enable row level security;
alter table public.contacts enable row level security;
alter table public.payment_requests enable row level security;
alter table public.notifications enable row level security;

create policy tenants_select on public.tenants
  for select using (public.is_platform_admin() or id = public.current_tenant_id());
create policy tenants_manage_platform on public.tenants
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy profiles_select on public.profiles
  for select using (public.is_platform_admin() or tenant_id = public.current_tenant_id() or id = auth.uid());
create policy profiles_manage_admin on public.profiles
  for all using (
    public.is_platform_admin() or
    (public.current_user_role() = 'tenant_admin' and tenant_id = public.current_tenant_id())
  )
  with check (
    public.is_platform_admin() or
    (public.current_user_role() = 'tenant_admin' and tenant_id = public.current_tenant_id() and role <> 'platform_admin')
  );

create policy workspaces_tenant_access on public.workspaces
  for all using (public.same_tenant(tenant_id)) with check (public.same_tenant(tenant_id));

create policy preferences_self_access on public.user_preferences
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy tasks_tenant_access on public.tasks
  for all using (public.same_tenant(tenant_id)) with check (public.same_tenant(tenant_id));

create policy contacts_tenant_access on public.contacts
  for all using (public.same_tenant(tenant_id)) with check (public.same_tenant(tenant_id));

create policy payment_requests_tenant_access on public.payment_requests
  for all using (public.same_tenant(tenant_id)) with check (public.same_tenant(tenant_id));

create policy notifications_tenant_access on public.notifications
  for all using (public.same_tenant(tenant_id)) with check (public.same_tenant(tenant_id));
