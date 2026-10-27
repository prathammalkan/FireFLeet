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

`supabase/migrations/001_initial_schema.sql` defines the budgets, transactions, and categories tables, constraints, indexes, triggers, and RLS policies. `supabase/migrations/002_security_remediation.sql` is a separate upgrade for an existing schema: it fails closed when required objects, policies, event triggers, privileges, or data invariants differ from the expected model. Review both files against the intended Supabase project before applying them. Apply migrations through the Supabase SQL editor or the approved Supabase migration workflow; do not reset or run destructive SQL against production as a shortcut.

PostgreSQL schema-specific default privileges cannot revoke a grant inherited from a global default privilege. Migration 002 therefore stops when `postgres` or `supabase_admin` has a global table default grant to `PUBLIC`, `anon`, or `authenticated`; removing that global grant would affect unrelated schemas and requires a separately reviewed owner action. When global defaults are safe, migration 002 revokes only the relevant `public`-schema defaults and verifies the result.

Every user-owned table must retain RLS and policies that scope rows to `auth.uid()`.

## Deployment

Vercel is configured to run `npm install` and `next build`. Configure the three environment variables above in the Vercel Production environment, verify the build, and smoke-test the deployed URL before release. Production deployment is performed through the repository's established Vercel integration.

GitHub Actions runs lint, type checking, tests, and the production build on pushes and pull requests. Protect `main` and require this workflow before merging.
