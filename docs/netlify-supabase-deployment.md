# Netlify + Supabase Deployment Check

Use this when testing the GitHub -> Netlify deployment with real Supabase Auth.

## Netlify Environment Variables

Set these in Netlify site settings:

```text
VITE_SUPABASE_URL=https://cqdtgoddfooknmjhmnzy.supabase.co
VITE_SUPABASE_ANON_KEY=<your Supabase anon key>
VITE_ENABLE_DEMO_AUTH=false
NODE_VERSION=22.12.0
```

Do not set `VITE_ENABLE_DEMO_AUTH=true` on Netlify.

## Supabase Setup

The app expects these database pieces:

- all migrations in `supabase/migrations`
- budget/debt migrations for personal workspace modules
- one Supabase Auth user for the platform owner
- one matching `public.profiles` row for that Auth user
- active tenants to have at least one workspace
- `create-user` Edge Function deployed with JWT verification enabled
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set in the Edge Function environment

## Health Check

Run this in Supabase SQL Editor:

```sql
-- paste contents of supabase/deployment_health_check.sql
```

Every result section ending in `should_be_empty` should return zero rows.

## Expected First Login

Log in with the Supabase Auth email/password for the platform admin. The app should land on `/platform`.

If login succeeds but the app shows errors:

- confirm the Auth user id matches `public.profiles.id`
- confirm `public.profiles.role = 'platform_admin'`
- confirm `public.profiles.is_active = true`
- confirm active tenants have at least one workspace
- open the browser console and look for Supabase table/RLS errors

## Creating Tenant Users

Use the app's Platform Admin or Tenant Admin user creation flow. It calls the Supabase Edge Function `create-user`.

If user creation fails, check:

- Edge Function is deployed and active
- Edge Function has `SUPABASE_URL`
- Edge Function has `SUPABASE_SERVICE_ROLE_KEY`
- the signed-in profile is `platform_admin` or a tenant admin for the target tenant
