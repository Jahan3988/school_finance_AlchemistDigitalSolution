# School Finance Management System

A web-based school finance application for managing students, monthly fee vouchers, fee payments, receipts, and financial reports. The application uses Supabase Authentication and PostgreSQL; data access is protected by PostgreSQL Row Level Security (RLS) and server-side authorization.

## Project objectives

- Replace manual fee tracking with a consistent student and voucher register.
- Record full and partial payments with unique receipts and auditable payment history.
- Calculate balances, payment status, collections, and defaulters from database records.
- Provide role-restricted administrative workflows and printable fee documents.
- Support a repeatable local development and production deployment process.

## Technology stack

- **Application:** Next.js App Router 16, React 19, TypeScript
- **UI:** Tailwind CSS 4, shadcn/ui components, Lucide icons, Recharts
- **Forms and validation:** React Hook Form and Zod
- **Backend:** Supabase PostgreSQL, Supabase Auth, `@supabase/ssr`
- **Hosting:** Vercel (recommended)

## Features

- Student creation, editing, search, class/section filters, pagination, status changes, and student detail pages.
- Class and section management.
- Monthly voucher generation for active students, with unique voucher numbers, due dates, duplicate prevention, and fee snapshots.
- Full and partial fee payments using Cash, Bank Transfer, EasyPaisa, or JazzCash.
- Unique receipts, payment idempotency, transaction references, payment history, and balance validation.
- Dashboard metrics for expected and collected fees, pending and overdue balances, defaulters, and student count.
- Monthly collection, outstanding fee, paid voucher, overdue voucher, and class-wise reports.
- Printable A4 fee challans and payment receipts.
- Authentication-protected dashboard routes and database-enforced role permissions.

All student fees, vouchers, payments, reports, and printable documents use PKR. The currency update relabels existing amounts; it does not convert numeric values using an exchange rate. Voucher statuses are calculated from the outstanding balance and due date.

## Project structure

```text
public/                         Static assets
src/
  app/
    (dashboard)/
      classes/                  Class and section administration
      fee-vouchers/             Voucher listing and details
      payments/                 Payment collection, history, receipts
      reports/                  Financial reports
      students/                 Student listing, details, and forms
    api/session/activity/       Session activity endpoint
    auth/callback/              Supabase Auth callback
    login/                      Sign-in
    forgot-password/            Password recovery request
    reset-password/             Password reset
  components/                   Shared UI and print components
  hooks/                        Client hooks
  lib/                          Supabase clients, validation, and helpers
  services/                     Data access services
  types/                        Shared TypeScript types
  utils/                        Shared utilities
supabase/
  migrations/                   Ordered PostgreSQL migrations
```

## Requirements and installation

- Node.js 20.9 or later
- npm
- A Supabase project
- A GitHub repository and Vercel account for hosted deployment

Clone the repository, install the locked dependencies, and create a local environment file:

```bash
git clone <your-github-repository-url>
cd school-fee-management-system
npm ci
```

In PowerShell, copy the example file with:

```powershell
Copy-Item .env.example .env.local
```

Fill in the Supabase values in `.env.local` as described below. Do not commit this file.

If PowerShell blocks the `npm`/`npx` script shims because of its execution policy, use `npm.cmd` and `npx.cmd` in the commands below.

## Local development

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Protected dashboard pages require a valid Supabase user with an application role that is permitted to access the dashboard.

Run the local production checks:

```bash
npm run lint
npx tsc --noEmit
npm run build
npm run start
```

The project currently has no automated `npm test` script. A successful build does not verify connectivity to a hosted Supabase database or test database permissions.

## Environment variables

The application requires these three variables:

| Variable | Required | Description | Example placeholder |
|---|---:|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL | `https://your-project.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase publishable client key | `your-supabase-publishable-key` |
| `NEXT_PUBLIC_SITE_URL` | Yes | Origin used to build Auth redirect URLs | `http://localhost:3000` |

`.env.example` contains placeholders only. Set `NEXT_PUBLIC_SITE_URL` to the exact HTTPS origin for production, for example `https://your-school-domain.example`. `NODE_ENV` is supplied by Next.js and is not an application-specific environment variable.

The app uses the publishable key with RLS; it does not require or use a Supabase service-role key. Never put a service-role key, OAuth client secret, or other privileged secret in a `NEXT_PUBLIC_*` variable.

## Supabase configuration

1. Create a Supabase project and copy its project URL and publishable key from the project API settings.
2. Set those values in `.env.local` for local development.
3. Apply the database migrations in the order below.
4. Configure Supabase Auth URLs and providers as described in [Authentication setup](#authentication-setup).
5. Create a trusted user and grant the appropriate application role.
6. Confirm the configured URL and key belong to the same Supabase project where the migrations were applied.

The SQL editor in the Supabase Dashboard can be used to apply the migration files. Each migration must be applied once, in full, to the intended project. Do not rerun an already applied migration or run the initial schema against an existing installation.

## Database schema

The main public tables are:

- **`profiles`** — application profile linked to `auth.users`, including full name and role.
- **`classes`** — unique class and section pairs.
- **`students`** — student contact, enrollment, class/section, status, and monthly fee.
- **`fee_vouchers`** — immutable billing-period fee snapshots, unique voucher numbers, due dates, and generated balances/status fields.
- **`payments`** — payment ledger, unique receipt numbers, method, date, transaction reference, and idempotency key.

The `app_private.app_sessions` table stores application session activity outside the exposed `public` schema. It is not expected to appear as `public.app_sessions`.

Important views and database functions include:

- `fee_voucher_directory` and `payment_receipt_directory` for voucher and receipt listings.
- `generate_monthly_fee_vouchers(...)` for transactional, duplicate-safe voucher generation.
- `record_fee_payment(...)` for authorized, idempotent payment recording and balance updates.
- `get_school_dashboard_summary(...)` and `get_classwise_collection_report(...)` for aggregated dashboard/report data.
- `set_profile_role(...)` for authorized role assignment by a Super Admin.

Database constraints enforce unique roll numbers/receipts/vouchers, valid amounts, and referential integrity. RLS and guarded database functions restrict access to authenticated users with permitted roles.

## SQL migration instructions

Apply the following migrations in order. **Choose exactly one** of the two authentication/session migrations:

1. `20261114170000_initial_school_fee_schema.sql`
2. Either:
   - `20261115090000_auth_roles_and_session_security.sql` — recommended for a new deployment; installs the application's role model and session security; or
   - `20261115102000_application_session_security.sql` — for an existing database that needs the session objects while retaining its current role setup. Before using this option, confirm existing profile roles are compatible with the roles the application accepts.
3. `20261115110000_set_default_currency_pkr.sql`
4. `20261116100000_unique_normalized_student_roll_numbers.sql`
5. `20261116110000_monthly_fee_vouchers.sql`
6. `20261116120000_fee_collection_and_payments.sql`
7. `20261116130000_dashboard_financial_reports.sql`
8. `20261116140000_student_access_and_payment_date_controls.sql`
9. `20261116150000_switch_currency_to_pkr.sql`
10. `20261116180000_admin_staff_and_global_settings.sql`

Run each file once in Supabase SQL Editor, in order, and wait for each transaction to complete before running the next. The earlier currency/dashboard migrations are retained for migration-history compatibility; the final PKR migration updates existing student, voucher, and payment currency labels and defaults, without changing numeric amounts. It temporarily drops and restores the composite currency foreign keys as part of the update. The financial dashboard migration also reconciles voucher totals from payment records. The access-controls migration updates the admin helper, student policies, profile-role permissions, voucher write permissions, payment-date validation, and voucher status view.

The admin/staff/settings migration adds `profiles.is_active`, shared light/dark/system theme settings, staff-management functions, and session revocation for deactivated accounts. It also installs the `has_school_role` helper used by its RLS policies, including when the existing-database session migration was chosen above. Apply it before running the current application; otherwise dashboard profile checks will fail because `profiles.is_active` is missing.

The SQL migrations include a PostgREST schema reload where needed. If a newly created view or function is still reported as missing, run this in the SQL Editor and restart the app:

```sql
NOTIFY pgrst, 'reload schema';
```

To check that the voucher and receipt views exist:

```sql
select
  to_regclass('public.fee_vouchers') as fee_vouchers,
  to_regclass('public.fee_voucher_directory') as fee_voucher_directory,
  to_regclass('public.payment_receipt_directory') as payment_receipt_directory;
```

For an existing project, review which migrations have already been applied before proceeding. Editing an older migration file does not cause Supabase to rerun it; use the new forward migration for changes intended for an already-initialized database.

## Authentication setup

1. In Supabase, enable the sign-in provider(s) you intend to use. For email/password deployments, disable public sign-up and provision users administratively.
2. Set the Supabase Auth **Site URL** to the hosted application origin.
3. Add allowed redirect URLs for local development and each deployed environment, including:
   - `http://localhost:3000/auth/callback`
   - `https://your-school-domain.example/auth/callback`
   - Any exact Vercel preview URLs that need Auth testing.
4. Set `NEXT_PUBLIC_SITE_URL` to the corresponding origin in each local/Vercel environment.
5. Create the first trusted user under **Authentication → Users**. The auth/roles migration creates a least-privileged teacher profile for new users.
6. Promote the trusted initial administrator in SQL Editor, replacing the example email with that user's email:

```sql
update public.profiles as p
set role = 'admin'
from auth.users as u
where u.id = p.id
  and lower(u.email) = lower('admin@example.com');
```

The application roles are `super_admin`, `admin`, `accountant`, `teacher`, and `receptionist`. Dashboard access is restricted to administrators, Super Admins, and accountants; student/class administration is restricted to administrators and Super Admins. The broader auth/roles migration provides the guarded `set_profile_role` function for Super Admin role assignment. The session-only alternative does not install that function; it is appropriate only when the existing role schema is already compatible with the application, and role changes must be managed through trusted database administration. Direct updates to `profiles.role` are revoked.

The application enforces a 30-minute inactivity limit and an eight-hour maximum session duration in the database. If enabling Google OAuth, configure the provider credentials only in Supabase Auth and add the Supabase callback URL shown by Supabase to the OAuth provider. Never store OAuth secrets in this repository.

## Vercel deployment through GitHub

1. Push the project to a private or appropriately access-controlled GitHub repository. Confirm `.env.local` and all real credentials are absent from the commit.
2. In Vercel, select **Add New → Project**, connect GitHub, and import the repository.
3. Keep the detected **Next.js** framework and default build settings. Vercel should use the repository's `package-lock.json`; the build command is `npm run build`.
4. In Vercel project settings, add the three environment variables from `.env.example` for **Production**. Add separate values for **Preview** and **Development** if those deployments need Supabase access. Use the matching Supabase project and exact site origin for each environment.
5. Apply all required Supabase migrations to the correct production project before exposing the production app. Create/promote the initial administrator and configure Auth site/redirect URLs.
6. Deploy from the selected production Git branch. Wait for the Vercel build to pass and open the deployment URL.
7. Smoke-test sign-in/sign-out, an administrator-only page, student/class access, voucher generation, payment recording, reports, and print pages using designated staging/test records. Confirm unauthorized users are denied and no test data is created in production.
8. If an environment variable or Auth redirect URL changes, redeploy and retest the affected flow.

Vercel deployment is not complete merely because the project imports or builds. Verify production environment variables, Supabase migrations, Auth redirects, database permissions, and application flows separately.

## Security considerations

- Keep `.env`, `.env.local`, `.env.*`, and all private credentials out of GitHub. `.env.example` is the only environment file intentionally committed.
- Only use the publishable Supabase key in browser/server application configuration. Never use a service-role key in the Next.js app or any `NEXT_PUBLIC_*` variable.
- RLS is required; do not disable it to work around permission errors. Database mutations use role-checked server actions and guarded database functions.
- Keep public user sign-up disabled unless the application is deliberately changed to support self-registration and safe role assignment.
- Use HTTPS for production and configure exact Auth redirect URLs. Keep Supabase and GitHub access limited to trusted administrators.
- Apply migrations through a reviewed process, back up production data, and test upgrades against staging first.
- The schema is designed for a single school and does not provide multi-school/tenant isolation.

## Production verification checklist

Before final submission, run:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Then verify the deployed Supabase project and Vercel environment: required tables/views/functions exist, Auth redirects match the domain, admin and non-admin permissions behave as intended, and real voucher/payment/report flows pass with staging records. A successful local build only verifies compilation; it does not prove remote database connectivity, Auth configuration, or production authorization.
