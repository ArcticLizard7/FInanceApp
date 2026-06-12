create schema if not exists private;

create or replace function private.current_user_role()
returns public.user_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = (select auth.uid())
$$;

create or replace function private.current_tenant_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select tenant_id from public.profiles where id = (select auth.uid())
$$;

create or replace function private.is_platform_admin()
returns boolean
language sql
security definer
set search_path = public, private
stable
as $$
  select private.current_user_role() = 'platform_admin'
$$;

create or replace function private.same_tenant(row_tenant_id uuid)
returns boolean
language sql
security definer
set search_path = public, private
stable
as $$
  select private.is_platform_admin() or row_tenant_id = private.current_tenant_id()
$$;

grant usage on schema private to authenticated;
grant execute on function private.current_user_role() to authenticated;
grant execute on function private.current_tenant_id() to authenticated;
grant execute on function private.is_platform_admin() to authenticated;
grant execute on function private.same_tenant(uuid) to authenticated;

drop policy if exists tenants_select on public.tenants;
drop policy if exists tenants_insert_platform on public.tenants;
drop policy if exists tenants_update_platform on public.tenants;
drop policy if exists tenants_delete_platform on public.tenants;

create policy tenants_select on public.tenants
  for select using (private.is_platform_admin() or id = private.current_tenant_id());
create policy tenants_insert_platform on public.tenants
  for insert with check (private.is_platform_admin());
create policy tenants_update_platform on public.tenants
  for update using (private.is_platform_admin()) with check (private.is_platform_admin());
create policy tenants_delete_platform on public.tenants
  for delete using (private.is_platform_admin());

drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_insert_admin on public.profiles;
drop policy if exists profiles_update_admin on public.profiles;
drop policy if exists profiles_delete_admin on public.profiles;

create policy profiles_select on public.profiles
  for select using (
    id = (select auth.uid()) or
    private.is_platform_admin() or
    tenant_id = private.current_tenant_id()
  );
create policy profiles_insert_admin on public.profiles
  for insert with check (
    private.is_platform_admin() or
    (private.current_user_role() = 'tenant_admin' and tenant_id = private.current_tenant_id() and role <> 'platform_admin')
  );
create policy profiles_update_admin on public.profiles
  for update using (
    private.is_platform_admin() or
    (private.current_user_role() = 'tenant_admin' and tenant_id = private.current_tenant_id())
  )
  with check (
    private.is_platform_admin() or
    (private.current_user_role() = 'tenant_admin' and tenant_id = private.current_tenant_id() and role <> 'platform_admin')
  );
create policy profiles_delete_admin on public.profiles
  for delete using (
    private.is_platform_admin() or
    (private.current_user_role() = 'tenant_admin' and tenant_id = private.current_tenant_id() and role <> 'platform_admin')
  );

drop policy if exists workspaces_tenant_access on public.workspaces;
create policy workspaces_tenant_access on public.workspaces
  for all using (private.same_tenant(tenant_id)) with check (private.same_tenant(tenant_id));

drop policy if exists tasks_tenant_access on public.tasks;
create policy tasks_tenant_access on public.tasks
  for all using (private.same_tenant(tenant_id)) with check (private.same_tenant(tenant_id));

drop policy if exists contacts_tenant_access on public.contacts;
create policy contacts_tenant_access on public.contacts
  for all using (private.same_tenant(tenant_id)) with check (private.same_tenant(tenant_id));

drop policy if exists payment_requests_tenant_access on public.payment_requests;
create policy payment_requests_tenant_access on public.payment_requests
  for all using (private.same_tenant(tenant_id)) with check (private.same_tenant(tenant_id));

drop policy if exists notifications_tenant_access on public.notifications;
create policy notifications_tenant_access on public.notifications
  for all using (private.same_tenant(tenant_id)) with check (private.same_tenant(tenant_id));

drop function if exists public.same_tenant(uuid);
drop function if exists public.is_platform_admin();
drop function if exists public.current_tenant_id();
drop function if exists public.current_user_role();
