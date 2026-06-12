drop policy if exists tenants_select on public.tenants;
drop policy if exists tenants_manage_platform on public.tenants;

create policy tenants_select on public.tenants
  for select using (public.is_platform_admin() or id = public.current_tenant_id());
create policy tenants_insert_platform on public.tenants
  for insert with check (public.is_platform_admin());
create policy tenants_update_platform on public.tenants
  for update using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy tenants_delete_platform on public.tenants
  for delete using (public.is_platform_admin());

drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_manage_admin on public.profiles;

create policy profiles_select on public.profiles
  for select using (
    public.is_platform_admin() or
    tenant_id = public.current_tenant_id() or
    id = (select auth.uid())
  );
create policy profiles_insert_admin on public.profiles
  for insert with check (
    public.is_platform_admin() or
    (public.current_user_role() = 'tenant_admin' and tenant_id = public.current_tenant_id() and role <> 'platform_admin')
  );
create policy profiles_update_admin on public.profiles
  for update using (
    public.is_platform_admin() or
    (public.current_user_role() = 'tenant_admin' and tenant_id = public.current_tenant_id())
  )
  with check (
    public.is_platform_admin() or
    (public.current_user_role() = 'tenant_admin' and tenant_id = public.current_tenant_id() and role <> 'platform_admin')
  );
create policy profiles_delete_admin on public.profiles
  for delete using (
    public.is_platform_admin() or
    (public.current_user_role() = 'tenant_admin' and tenant_id = public.current_tenant_id() and role <> 'platform_admin')
  );

drop policy if exists preferences_self_access on public.user_preferences;
create policy preferences_select_self on public.user_preferences
  for select using (user_id = (select auth.uid()));
create policy preferences_insert_self on public.user_preferences
  for insert with check (user_id = (select auth.uid()));
create policy preferences_update_self on public.user_preferences
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy preferences_delete_self on public.user_preferences
  for delete using (user_id = (select auth.uid()));
