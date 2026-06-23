# Safe Online Hosting Checklist

This app is currently a local-first productivity app. For real online use, do not publish the demo auth/localStorage version as-is.

## Recommended Stack

- Hosting: Vercel, Netlify, Cloudflare Pages, or Azure Static Web Apps
- Backend/auth/database: Supabase
- Build command: `npm run build`
- Publish directory: `dist`
- Node version: `22.12.0` or newer

## 1. Create Supabase Project

1. Create a Supabase project.
2. In Supabase SQL Editor, run:

   `supabase/migrations/001_initial_safe_online_schema.sql`

3. Enable email/password auth in Supabase Authentication.
4. Create the first platform admin user in Supabase Auth.
5. Add a matching row in `public.profiles` with:
   - `id`: the Supabase Auth user id
   - `role`: `platform_admin`
   - `tenant_id`: `null`

You can use `supabase/seed_first_admin.sql` as a starter. Replace the placeholder auth user id and email values before running it.

## 2. Configure Environment Variables

Copy `.env.example` to `.env.local` for local testing:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
VITE_ENABLE_DEMO_AUTH=false
```

Set the same variables in your hosting provider.

Do not set `VITE_ENABLE_DEMO_AUTH=true` in production.

## 3. Production Safety Gate

Production demo auth is blocked by default. If the app is deployed without a real auth migration, the login page will show a locked setup message instead of default credentials.

This is intentional. The old demo login is only suitable for local development.

## 4. Data Stores

The app stores use Supabase when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set and demo auth is disabled.

Without those variables, local development falls back to demo auth/localStorage.

Production should use:

```text
VITE_ENABLE_DEMO_AUTH=false
```

Do not publish a production deployment using demo auth.

## 5. User Administration

The browser app can read and update profile rows through RLS, but it should not create Supabase Auth users directly with a service-role key. For production user invites, add one of these:

- Supabase Dashboard-managed users for a small private deployment.
- A Supabase Edge Function that uses the service-role key server-side to invite/create users, then inserts the matching `profiles` row.
- A third-party identity provider such as Microsoft Entra ID if this becomes a work/team app.

## 6. Host Routing

Because this is a React Router app, configure your host to serve `index.html` for all app routes:

- `/today`
- `/tasks`
- `/review`
- `/settings`
- any other route under the app

Most Vite-aware hosts handle this automatically. Netlify can use a `_redirects` file if needed.

## 7. Before Inviting Users

Run:

```powershell
npm run lint
npm run build
npm audit
```

Also verify:

- Demo credentials are not visible online.
- `VITE_ENABLE_DEMO_AUTH` is not set to `true`.
- Supabase RLS is enabled on every table.
- Each user has exactly one `profiles` row.
- Tenant users can only see their tenant data.
- Backups are enabled in Supabase.
