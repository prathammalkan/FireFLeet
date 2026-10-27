# FireFleet

FireFleet is a personal finance Progressive Web App built with Next.js 16, React 19, Zustand, and Supabase.

## Local development

Use Node.js 24.x (the Vercel project runtime) and npm:

```bash
npm ci
npm run dev
```

Copy `.env.example` to `.env.local` and provide:

- `NEXT_PUBLIC_SUPABASE_URL` — the intended Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the Supabase publishable/anon key. Never use a service-role key in the browser.
- `NEXT_PUBLIC_APP_URL` — the canonical app URL used for auth redirects.

Run the release checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The build can compile without local Supabase credentials, but authentication and data workflows require valid project configuration.

## Database migrations

`supabase/migrations/001_initial_schema.sql` defines the budgets, transactions, and categories tables, constraints, indexes, triggers, and RLS policies. `supabase/migrations/002_security_remediation.sql` is a separate upgrade for an existing schema: it fails closed when required objects, policies, event triggers, privileges, or data invariants differ from the expected model. `supabase/migrations/003_budget_delete_semantics.sql` repairs the known `transactions.budget_id` foreign-key drift from `ON DELETE SET NULL` to the repository's intended `ON DELETE CASCADE`; this matches the Settings reset-data contract and must be tested against a disposable database first. Review all files against the intended Supabase project before applying them. Apply migrations through the Supabase SQL editor or the approved Supabase migration workflow; do not reset or run destructive SQL against production as a shortcut.

PostgreSQL schema-specific default privileges cannot revoke a grant inherited from a global default privilege. Migration 002 therefore stops when `postgres` or `supabase_admin` has a global table default grant to `PUBLIC`, `anon`, or `authenticated`; removing that global grant would affect unrelated schemas and requires a separately reviewed owner action. It also checks authority before changing role-specific defaults: if the migration role cannot act for `supabase_admin` and that role has unsafe `public` defaults, run the revoke while acting as `supabase_admin` (or grant reviewed role membership) before rerunning migration 002. When global defaults are safe and public defaults are already closed, the migration changes only the roles it is authorized to alter and verifies the resulting `public`-schema state.

Every user-owned table must retain RLS and policies that scope rows to `auth.uid()`.

### Migration recovery

Migration files are not evidence that a database change was applied. Record the live migration history before and after applying migrations 002 and 003. Run both only after disposable-database verification and a reviewed production snapshot. If a migration fails before commit, roll back the migration transaction; neither file deletes or rewrites existing rows. Migration 003 changes future budget deletion to intentional cascade behavior, so do not blindly reverse it after application—restore the prior foreign key only through an owner-reviewed forward change that matches the application version. If the application deployment must be reverted, restore the previous Vercel deployment first and keep database changes compatible; do not reverse database migrations as an application rollback shortcut.

## Deployment

Vercel is configured to run `npm install` and `next build`. Configure the three environment variables above in the Vercel Production environment, verify the build, and smoke-test the deployed URL before release. Production deployment is performed through the repository's established Vercel integration.

GitHub Actions runs lint, type checking, tests, and the production build on pushes and pull requests. Protect `main` and require this workflow before merging.
