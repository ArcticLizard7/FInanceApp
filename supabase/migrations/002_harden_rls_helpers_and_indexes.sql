revoke execute on function public.current_user_role() from public, anon, authenticated;
revoke execute on function public.current_tenant_id() from public, anon, authenticated;
revoke execute on function public.is_platform_admin() from public, anon, authenticated;
revoke execute on function public.same_tenant(uuid) from public, anon, authenticated;

create index if not exists tenants_created_by_idx on public.tenants(created_by);
create index if not exists profiles_created_by_idx on public.profiles(created_by);
create index if not exists user_preferences_active_workspace_id_idx on public.user_preferences(active_workspace_id);

create index if not exists tasks_workspace_id_idx on public.tasks(workspace_id);
create index if not exists tasks_delegated_by_idx on public.tasks(delegated_by);
create index if not exists tasks_created_by_idx on public.tasks(created_by);
create index if not exists tasks_parent_task_id_idx on public.tasks(parent_task_id);
create index if not exists tasks_linked_payment_request_id_idx on public.tasks(linked_payment_request_id);

create index if not exists contacts_workspace_id_idx on public.contacts(workspace_id);

create index if not exists payment_requests_workspace_id_idx on public.payment_requests(workspace_id);
create index if not exists payment_requests_linked_task_id_idx on public.payment_requests(linked_task_id);
create index if not exists payment_requests_created_by_idx on public.payment_requests(created_by);

create index if not exists notifications_workspace_id_idx on public.notifications(workspace_id);
