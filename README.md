# FinanceFlow — Property Finance Management App

A full-stack productivity and finance management web app for a Finance Manager in a UK property development environment.

---

## Prerequisites

1. **Node.js v22.12.0 or later** — download from https://nodejs.org/en/download
   - Choose the Windows Installer (.msi) — LTS version recommended
   - During installation, ensure "Add to PATH" is checked
2. **Restart your terminal** after Node.js installs

---

## Installation

Open PowerShell or Windows Terminal, navigate to this folder, then run:

```powershell
cd "C:\Users\Pete\Documents\Webapps\Productivity"
npm install
```

This installs all dependencies (~60 seconds on first run).

---

## Running in Development

```powershell
npm run dev
```

Then open: **http://localhost:5173**

The app loads with sample data pre-populated (Acme Developments Ltd + Cornerstone Homes).

---

## Building for Production

```powershell
npm run build
npm run preview   # previews the production build locally
```

The production build is output to `dist/`.

---

## App Structure

```
src/
  types/          — TypeScript models (Task, PaymentRequest, Workspace, etc.)
  stores/         — Zustand state stores (one per domain)
  services/       — storageService, emailService, excelService, recurringService
  services/integrations/  — stubs for M365, Xero, COINS
  utils/          — dateUtils, colorUtils, id generator, cn()
  data/           — mock/seed data
  components/
    common/       — Button, Modal, Input, Card, Badge, EmptyState
    layout/       — Sidebar, Header (with notifications + workspace switcher)
    tasks/        — TaskCard, TaskForm, PriorityBadge
    payments/     — PaymentForm, PaymentStatusBadge
  pages/          — One file per page/route
  App.tsx         — Router + store initialisation
  main.tsx        — React entry point
  index.css       — Tailwind directives + scrollbar styling
```

---

## Pages & Features

| Route | Page | Description |
|-------|------|-------------|
| `/today` | Today's Focus | Daily command centre — overdue, due today, reminders |
| `/dashboard` | Dashboard | KPI cards, task lists, cashflow preview, category chart |
| `/tasks` | Tasks | Full task list with search + filters |
| `/kanban` | Kanban Board | Drag-and-drop board (To Do / In Progress / Waiting / Done) |
| `/timeline` | Timeline | Tasks + payment deadlines by period |
| `/payments` | Payment Requests | Full CRUD table with approve/reject/paid workflow |
| `/cashflow` | Cashflow Snapshot | 4-week payment forecast with bar chart |
| `/import` | Excel Import | File upload → column mapping → preview → import |
| `/contacts` | Contacts | Contacts used for task delegation by email |
| `/reports` | Reports | Charts: completion trend, status breakdown, payment trends |
| `/notifications` | Notifications | Read, snooze, dismiss system alerts |
| `/settings` | Settings | Workspace management, preferences, integrations (stubs) |

---

## Workspace / Company Switching

- Switch companies using the header dropdown or sidebar chip
- Each workspace has completely separate tasks, payments, contacts
- Personal workspace hides finance features if configured
- Manage workspaces at Settings → Workspaces

---

## Data Persistence

All data is stored in `localStorage` under the `ff_` namespace.
To reset to seed data: open browser DevTools → Application → Local Storage → clear all `ff_*` keys → refresh.

---

## Future Backend Migration

When ready to migrate to a database:

1. **Replace** `src/services/storageService.ts` methods (`get`/`set`) with API calls
2. **Types remain identical** — no changes to stores or components needed
3. Recommended stack: **Supabase** (PostgreSQL + auth + real-time) or **Azure SQL + Azure Functions**

---

## Future Authentication

Architecture is pre-structured for multi-user support:
- Add a `userId` field to all records (already have `workspaceId`)
- Use **Azure AD B2C** or **Auth0** for SSO — integrates with Microsoft 365
- Role-based access (Finance Manager / Finance Director / Accounts Assistant / Admin)

---

## Future Integrations

All integration stubs are in `src/services/integrations/`:

| Integration | File | Notes |
|-------------|------|-------|
| Microsoft 365 | `microsoftService.ts` | MSAL browser auth, Graph API |
| Xero | `xeroService.ts` | OAuth 2.0, accounting API |
| Access COINS | `coinsService.ts` | COINS OA REST/SOAP |
| SendGrid / Resend | `emailService.ts` | Replace mock `sendEmail` body |

---

## Database Recommendations

| Option | Best For |
|--------|----------|
| **Supabase** | Fast start, PostgreSQL, built-in auth, real-time |
| **Azure SQL** | If already in Microsoft 365 ecosystem |
| **PlanetScale** | Serverless MySQL, free tier |

Schema is essentially one table per type (tasks, payments, workspaces, contacts, notifications) with `workspaceId` and future `userId` as foreign keys.

---

## Safe Online Hosting

Do not publish the demo auth/localStorage version for real users. Production demo auth is blocked by default unless explicitly enabled with `VITE_ENABLE_DEMO_AUTH=true`.

For the safe hosting path, see [`docs/safe-online-hosting.md`](docs/safe-online-hosting.md).

---

## Microsoft 365 Integration (Future)

1. Register app in **Azure Active Directory** (App Registrations)
2. Add API permissions: `Mail.Send`, `Calendars.ReadWrite`, `Tasks.ReadWrite`, `Files.ReadWrite`
3. Install `@azure/msal-browser`
4. Update `src/services/integrations/microsoftService.ts` with real MSAL auth flow
5. Replace mock email service with Graph `POST /me/sendMail`

---

## Xero Integration (Future)

1. Create app at https://developer.xero.com
2. OAuth 2.0 with scopes: `accounting.transactions`, `accounting.contacts`, `accounting.reports.read`
3. Store refresh token server-side (never in localStorage)
4. Update `src/services/integrations/xeroService.ts`

---

Built with React 18 · TypeScript · Vite · Tailwind CSS · Zustand · Recharts · date-fns · read-excel-file
