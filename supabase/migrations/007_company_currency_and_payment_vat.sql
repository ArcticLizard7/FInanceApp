alter table public.workspaces
  add column if not exists currency text not null default 'GBP';

alter table public.payment_requests
  add column if not exists vat_code text not null default 'S',
  add column if not exists vat_breakdown jsonb not null default '[]'::jsonb;

alter table public.payment_requests
  drop constraint if exists payment_requests_vat_code_check;

alter table public.payment_requests
  add constraint payment_requests_vat_code_check
  check (vat_code in ('S', 'R', 'Z', 'M'));
