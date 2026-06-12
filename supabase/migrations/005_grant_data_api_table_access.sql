revoke all on table
  public.tenants,
  public.profiles,
  public.workspaces,
  public.user_preferences,
  public.tasks,
  public.contacts,
  public.payment_requests,
  public.notifications
from anon;

grant select, insert, update, delete on table
  public.tenants,
  public.profiles,
  public.workspaces,
  public.user_preferences,
  public.tasks,
  public.contacts,
  public.payment_requests,
  public.notifications
to authenticated;
