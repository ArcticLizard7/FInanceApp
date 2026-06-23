create table public.budget_profiles (
  id text primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  colour text not null default '#0f766e',
  is_default boolean not null default false,
  include_in_consolidated boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.budget_categories (
  id text primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  budget_id text not null references public.budget_profiles(id) on delete cascade,
  name text not null,
  colour text not null default '#64748b',
  keywords text[] not null default '{}',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.monthly_budgets (
  id text primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  budget_id text not null references public.budget_profiles(id) on delete cascade,
  month text not null,
  category_id text not null references public.budget_categories(id) on delete cascade,
  amount numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint monthly_budgets_month_format check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  constraint monthly_budgets_unique_month_category unique (budget_id, month, category_id)
);

create table public.monthly_budget_income (
  id text primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  budget_id text not null references public.budget_profiles(id) on delete cascade,
  month text not null,
  amount numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint monthly_budget_income_month_format check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  constraint monthly_budget_income_unique_month unique (budget_id, month)
);

create table public.budget_transactions (
  id text primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  budget_id text not null references public.budget_profiles(id) on delete cascade,
  date date not null,
  description text not null,
  amount numeric(12, 2) not null default 0,
  direction text not null default 'payment' check (direction in ('payment', 'receipt')),
  category_id text references public.budget_categories(id) on delete set null,
  debt_allocation jsonb,
  source text not null default 'manual' check (source in ('manual', 'import')),
  import_batch_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.debt_groups (
  id text primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  colour text not null default '#7c3aed',
  is_default boolean not null default false,
  include_in_consolidated boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.debt_accounts (
  id text primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  group_id text not null references public.debt_groups(id) on delete cascade,
  name text not null,
  lender text not null default '',
  type text not null default 'other',
  opening_balance numeric(12, 2) not null default 0,
  interest_rate numeric(8, 4) not null default 0,
  minimum_payment numeric(12, 2) not null default 0,
  payment_due_day integer,
  start_date date,
  term_months integer,
  notes text not null default '',
  status text not null default 'active' check (status in ('active', 'settled', 'paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.debt_repayments (
  id text primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  group_id text not null references public.debt_groups(id) on delete cascade,
  debt_id text not null references public.debt_accounts(id) on delete cascade,
  date date not null,
  amount numeric(12, 2) not null default 0,
  notes text not null default '',
  source_transaction_id text references public.budget_transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.debt_balance_snapshots (
  id text primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  group_id text not null references public.debt_groups(id) on delete cascade,
  debt_id text not null references public.debt_accounts(id) on delete cascade,
  date date not null,
  balance numeric(12, 2) not null default 0,
  notes text not null default '',
  source_transaction_id text references public.budget_transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index budget_profiles_tenant_workspace_idx on public.budget_profiles(tenant_id, workspace_id);
create index budget_categories_budget_idx on public.budget_categories(budget_id);
create index monthly_budgets_budget_month_idx on public.monthly_budgets(budget_id, month);
create index monthly_budget_income_budget_month_idx on public.monthly_budget_income(budget_id, month);
create index budget_transactions_budget_date_idx on public.budget_transactions(budget_id, date);
create index debt_groups_tenant_workspace_idx on public.debt_groups(tenant_id, workspace_id);
create index debt_accounts_group_idx on public.debt_accounts(group_id);
create index debt_repayments_debt_date_idx on public.debt_repayments(debt_id, date);
create index debt_balance_snapshots_debt_date_idx on public.debt_balance_snapshots(debt_id, date);

alter table public.budget_profiles enable row level security;
alter table public.budget_categories enable row level security;
alter table public.monthly_budgets enable row level security;
alter table public.monthly_budget_income enable row level security;
alter table public.budget_transactions enable row level security;
alter table public.debt_groups enable row level security;
alter table public.debt_accounts enable row level security;
alter table public.debt_repayments enable row level security;
alter table public.debt_balance_snapshots enable row level security;

create policy budget_profiles_tenant_access on public.budget_profiles
  for all using (private.same_tenant(tenant_id)) with check (private.same_tenant(tenant_id));
create policy budget_categories_tenant_access on public.budget_categories
  for all using (private.same_tenant(tenant_id)) with check (private.same_tenant(tenant_id));
create policy monthly_budgets_tenant_access on public.monthly_budgets
  for all using (private.same_tenant(tenant_id)) with check (private.same_tenant(tenant_id));
create policy monthly_budget_income_tenant_access on public.monthly_budget_income
  for all using (private.same_tenant(tenant_id)) with check (private.same_tenant(tenant_id));
create policy budget_transactions_tenant_access on public.budget_transactions
  for all using (private.same_tenant(tenant_id)) with check (private.same_tenant(tenant_id));
create policy debt_groups_tenant_access on public.debt_groups
  for all using (private.same_tenant(tenant_id)) with check (private.same_tenant(tenant_id));
create policy debt_accounts_tenant_access on public.debt_accounts
  for all using (private.same_tenant(tenant_id)) with check (private.same_tenant(tenant_id));
create policy debt_repayments_tenant_access on public.debt_repayments
  for all using (private.same_tenant(tenant_id)) with check (private.same_tenant(tenant_id));
create policy debt_balance_snapshots_tenant_access on public.debt_balance_snapshots
  for all using (private.same_tenant(tenant_id)) with check (private.same_tenant(tenant_id));

revoke all on table
  public.budget_profiles,
  public.budget_categories,
  public.monthly_budgets,
  public.monthly_budget_income,
  public.budget_transactions,
  public.debt_groups,
  public.debt_accounts,
  public.debt_repayments,
  public.debt_balance_snapshots
from anon;

grant select, insert, update, delete on table
  public.budget_profiles,
  public.budget_categories,
  public.monthly_budgets,
  public.monthly_budget_income,
  public.budget_transactions,
  public.debt_groups,
  public.debt_accounts,
  public.debt_repayments,
  public.debt_balance_snapshots
to authenticated;
