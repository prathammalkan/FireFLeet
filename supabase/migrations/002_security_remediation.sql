-- FireFleet security and schema remediation — v1
--
-- This migration is deliberately separate from 001_initial_schema.sql. It is
-- intended for an already-created Supabase database after the preflight
-- queries in the release runbook have been reviewed.
--
-- It fails closed when required service-role privileges, the RLS event trigger,
-- or existing data invariants are not present. It does not delete or rewrite
-- application rows.

-- ─── Preconditions: verify the live object model before any change ────────────
DO $$
DECLARE
  expected RECORD;
  table_name TEXT;
  role_name TEXT;
  creator_role TEXT;
BEGIN
  IF to_regnamespace('public') IS NULL THEN
    RAISE EXCEPTION 'Required schema public is missing; remediation stopped';
  END IF;

  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role', 'postgres', 'supabase_admin'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      RAISE EXCEPTION 'Required role % is missing; remediation stopped', role_name;
    END IF;
  END LOOP;

  FOREACH table_name IN ARRAY ARRAY['budgets', 'categories', 'transactions'] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = table_name
        AND c.relkind IN ('r', 'p')
    ) THEN
      RAISE EXCEPTION 'Required table public.% is missing; remediation stopped', table_name;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = table_name
        AND c.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'RLS is not enabled on public.%; remediation stopped', table_name;
    END IF;
  END LOOP;

  FOR expected IN
    SELECT * FROM (VALUES
      ('budgets', 'id', 'NO'),
      ('budgets', 'user_id', 'NO'),
      ('budgets', 'amount', 'NO'),
      ('budgets', 'currency', 'NO'),
      ('budgets', 'period_type', 'NO'),
      ('budgets', 'start_date', 'NO'),
      ('budgets', 'end_date', 'NO'),
      ('transactions', 'id', 'NO'),
      ('transactions', 'user_id', 'NO'),
      ('transactions', 'budget_id', 'YES'),
      ('transactions', 'amount', 'NO'),
      ('transactions', 'category', 'NO'),
      ('transactions', 'comment', 'YES'),
      ('categories', 'id', 'NO'),
      ('categories', 'user_id', 'NO'),
      ('categories', 'name', 'NO'),
      ('categories', 'emoji', 'NO'),
      ('categories', 'color', 'NO')
    ) AS columns(table_name, column_name, nullable)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = expected.table_name
        AND column_name = expected.column_name
        AND is_nullable = expected.nullable
    ) THEN
      RAISE EXCEPTION 'Required column public.%.% with nullable=% is missing or incompatible; remediation stopped',
        expected.table_name, expected.column_name, expected.nullable;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE oid = 'public.rls_auto_enable()'::regprocedure
  ) THEN
    RAISE EXCEPTION 'public.rls_auto_enable() is missing; remediation stopped';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_event_trigger
    WHERE evtname = 'ensure_rls'
      AND evtenabled <> 'D'
      AND evtfoid = 'public.rls_auto_enable()'::regprocedure
  ) THEN
    RAISE EXCEPTION 'enabled ensure_rls event trigger registration is missing; remediation stopped';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE oid = 'public.update_updated_at_column()'::regprocedure
  ) THEN
    RAISE EXCEPTION 'public.update_updated_at_column() is missing; remediation stopped';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_budgets_updated_at'
      AND tgrelid = 'public.budgets'::regclass
      AND tgfoid = 'public.update_updated_at_column()'::regprocedure
      AND NOT tgisinternal
      AND tgenabled <> 'D'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_transactions_updated_at'
      AND tgrelid = 'public.transactions'::regclass
      AND tgfoid = 'public.update_updated_at_column()'::regprocedure
      AND NOT tgisinternal
      AND tgenabled <> 'D'
  ) THEN
    RAISE EXCEPTION 'required updated_at triggers are missing, disabled, or attached to another function; remediation stopped';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('budgets', 'categories', 'transactions')
      AND policyname <> ALL (ARRAY[
        'Users can read own budgets',
        'Users can insert own budgets',
        'Users can update own budgets',
        'Users can delete own budgets',
        'Users can read own transactions',
        'Users can insert own transactions',
        'Users can update own transactions',
        'Users can delete own transactions',
        'Users can read own categories',
        'Users can insert own categories',
        'Users can update own categories',
        'Users can delete own categories'
      ])
  ) THEN
    RAISE EXCEPTION 'Unexpected policy exists on a FireFleet table; review policies before remediation';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('budgets', 'categories', 'transactions')
      AND (
        (policyname LIKE 'Users can read own %' AND cmd <> 'SELECT')
        OR (policyname LIKE 'Users can insert own %' AND cmd <> 'INSERT')
        OR (policyname LIKE 'Users can update own %' AND cmd <> 'UPDATE')
        OR (policyname LIKE 'Users can delete own %' AND cmd <> 'DELETE')
      )
  ) THEN
    RAISE EXCEPTION 'Existing FireFleet policy command does not match its name; review policies before remediation';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid IN (
      'public.budgets'::regclass,
      'public.categories'::regclass,
      'public.transactions'::regclass
    )
      AND c.contype = 'c'
      AND NOT c.convalidated
  ) THEN
    RAISE EXCEPTION 'An existing FireFleet CHECK constraint is not validated; validate or review it before remediation';
  END IF;

  -- A global default grant is inherited by every schema. PostgreSQL cannot
  -- revoke such a grant only for public, so changing it here would alter
  -- unrelated schemas/system defaults. Stop and require an owner-reviewed
  -- global change instead of pretending the public-schema revoke is enough.
  IF EXISTS (
    SELECT 1
    FROM pg_default_acl d
    JOIN pg_roles owner_role ON owner_role.oid = d.defaclrole
    CROSS JOIN LATERAL aclexplode(d.defaclacl) acl
    LEFT JOIN pg_roles grantee_role ON grantee_role.oid = acl.grantee
    WHERE d.defaclobjtype = 'r'
      AND d.defaclnamespace = 0
      AND owner_role.rolname IN ('postgres', 'supabase_admin')
      AND (
        acl.grantee = 0
        OR grantee_role.rolname IN ('anon', 'authenticated')
      )
  ) THEN
    RAISE EXCEPTION 'Unsafe global table default privilege found for postgres or supabase_admin; remove it through a separately reviewed global policy change before remediation';
  END IF;

  -- The migration must be able to remediate defaults owned by postgres.
  -- supabase_admin is a Supabase-managed role: never grant membership or
  -- superuser rights merely to alter its defaults. If we lack authority, leave
  -- those defaults untouched and report them as a separate platform-level
  -- follow-up rather than blocking application-table remediation.
  IF NOT (
    current_user = 'postgres'
    OR pg_has_role(current_user, 'postgres', 'MEMBER')
    OR EXISTS (
      SELECT 1 FROM pg_roles
      WHERE rolname = current_user AND rolsuper
    )
  ) AND EXISTS (
    SELECT 1
    FROM pg_default_acl d
    JOIN pg_roles owner_role ON owner_role.oid = d.defaclrole
    CROSS JOIN LATERAL aclexplode(d.defaclacl) acl
    LEFT JOIN pg_roles grantee_role ON grantee_role.oid = acl.grantee
    JOIN pg_namespace schema_name ON schema_name.oid = d.defaclnamespace
    WHERE d.defaclobjtype = 'r'
      AND schema_name.nspname = 'public'
      AND owner_role.rolname = 'postgres'
      AND (
        acl.grantee = 0
        OR grantee_role.rolname IN ('anon', 'authenticated')
      )
  ) THEN
    RAISE EXCEPTION 'Current role % cannot alter postgres default privileges; run the public-schema revoke as postgres before rerunning remediation',
      current_user;
  END IF;
END $$;

-- ─── Preconditions: preserve privileged service access ────────────────────────
DO $$
DECLARE
  table_name TEXT;
  privilege_name TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    RAISE EXCEPTION 'Required role service_role is missing; remediation stopped';
  END IF;

  FOREACH table_name IN ARRAY ARRAY['budgets', 'categories', 'transactions'] LOOP
    FOREACH privilege_name IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE'] LOOP
      IF NOT has_table_privilege(
        'service_role',
        format('public.%I', table_name),
        privilege_name
      ) THEN
        RAISE EXCEPTION 'service_role lacks % on public.%; remediation stopped',
          privilege_name, table_name;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- ─── Preconditions: reject violating rows before adding constraints ────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.budgets
    WHERE amount <= 0 OR amount > 9999999
  ) THEN
    RAISE EXCEPTION 'budgets contains an amount outside (0, 9999999]';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.budgets
    WHERE currency NOT IN ('INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD')
  ) THEN
    RAISE EXCEPTION 'budgets contains an unsupported currency';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.budgets
    WHERE period_type NOT IN ('weekly', 'monthly', 'custom')
  ) THEN
    RAISE EXCEPTION 'budgets contains an unsupported period_type';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.budgets
    WHERE end_date < start_date
  ) THEN
    RAISE EXCEPTION 'budgets contains an invalid date range';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.transactions
    WHERE amount <= 0 OR amount > 9999999
  ) THEN
    RAISE EXCEPTION 'transactions contains an amount outside (0, 9999999]';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.transactions
    WHERE char_length(category) > 50
       OR (comment IS NOT NULL AND char_length(comment) > 200)
  ) THEN
    RAISE EXCEPTION 'transactions contains an overlong category or comment';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.categories
    WHERE char_length(name) > 50
       OR char_length(emoji) > 10
       OR color !~ '^#[0-9a-fA-F]{6}$'
  ) THEN
    RAISE EXCEPTION 'categories contains a value outside its declared format';
  END IF;
END $$;

-- ─── Constraints: preserve equivalent checks and add only missing ones ────────
-- The initial migration uses unnamed inline CHECK constraints. Match their
-- definitions before adding named remediation constraints, otherwise a healthy
-- database would receive duplicate checks on every upgrade.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.budgets'::regclass
      AND conname = 'budgets_amount_range_check'
      AND NOT (
        pg_get_constraintdef(oid) ILIKE '%amount%'
        AND pg_get_constraintdef(oid) ILIKE '%9999999%'
        AND pg_get_constraintdef(oid) ILIKE '%>%'
        AND pg_get_constraintdef(oid) ILIKE '%<=%'
      )
  ) THEN RAISE EXCEPTION 'Existing budgets_amount_range_check is incompatible'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.budgets'::regclass
      AND conname = 'budgets_currency_check'
      AND NOT (
        pg_get_constraintdef(oid) ILIKE '%currency%'
        AND pg_get_constraintdef(oid) ILIKE '%INR%'
        AND pg_get_constraintdef(oid) ILIKE '%USD%'
        AND pg_get_constraintdef(oid) ILIKE '%EUR%'
        AND pg_get_constraintdef(oid) ILIKE '%GBP%'
        AND pg_get_constraintdef(oid) ILIKE '%JPY%'
        AND pg_get_constraintdef(oid) ILIKE '%AUD%'
        AND pg_get_constraintdef(oid) ILIKE '%CAD%'
      )
  ) THEN RAISE EXCEPTION 'Existing budgets_currency_check is incompatible'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.budgets'::regclass
      AND conname = 'budgets_period_type_check'
      AND NOT (
        pg_get_constraintdef(oid) ILIKE '%period_type%'
        AND pg_get_constraintdef(oid) ILIKE '%weekly%'
        AND pg_get_constraintdef(oid) ILIKE '%monthly%'
        AND pg_get_constraintdef(oid) ILIKE '%custom%'
      )
  ) THEN RAISE EXCEPTION 'Existing budgets_period_type_check is incompatible'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.budgets'::regclass
      AND conname = 'budgets_date_range_check'
      AND NOT (
        pg_get_constraintdef(oid) ILIKE '%end_date%'
        AND pg_get_constraintdef(oid) ILIKE '%start_date%'
        AND pg_get_constraintdef(oid) ILIKE '%>=%'
      )
  ) THEN RAISE EXCEPTION 'Existing budgets_date_range_check is incompatible'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.transactions'::regclass
      AND conname = 'transactions_amount_range_check'
      AND NOT (
        pg_get_constraintdef(oid) ILIKE '%amount%'
        AND pg_get_constraintdef(oid) ILIKE '%9999999%'
        AND pg_get_constraintdef(oid) ILIKE '%>%'
        AND pg_get_constraintdef(oid) ILIKE '%<=%'
      )
  ) THEN RAISE EXCEPTION 'Existing transactions_amount_range_check is incompatible'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.transactions'::regclass
      AND conname = 'transactions_category_length_check'
      AND NOT (
        pg_get_constraintdef(oid) ILIKE '%category%'
        AND pg_get_constraintdef(oid) ILIKE '%50%'
      )
  ) THEN RAISE EXCEPTION 'Existing transactions_category_length_check is incompatible'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.transactions'::regclass
      AND conname = 'transactions_comment_length_check'
      AND NOT (
        pg_get_constraintdef(oid) ILIKE '%comment%'
        AND pg_get_constraintdef(oid) ILIKE '%200%'
      )
  ) THEN RAISE EXCEPTION 'Existing transactions_comment_length_check is incompatible'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.categories'::regclass
      AND conname = 'categories_name_length_check'
      AND NOT (
        pg_get_constraintdef(oid) ILIKE '%name%'
        AND pg_get_constraintdef(oid) ILIKE '%50%'
      )
  ) THEN RAISE EXCEPTION 'Existing categories_name_length_check is incompatible'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.categories'::regclass
      AND conname = 'categories_emoji_length_check'
      AND NOT (
        pg_get_constraintdef(oid) ILIKE '%emoji%'
        AND pg_get_constraintdef(oid) ILIKE '%10%'
      )
  ) THEN RAISE EXCEPTION 'Existing categories_emoji_length_check is incompatible'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.categories'::regclass
      AND conname = 'categories_color_format_check'
      AND NOT (
        pg_get_constraintdef(oid) ILIKE '%color%'
        AND pg_get_constraintdef(oid) ILIKE '%#[0-9a-fA-F]{6}%'
      )
  ) THEN RAISE EXCEPTION 'Existing categories_color_format_check is incompatible'; END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.budgets'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%amount%'
      AND pg_get_constraintdef(oid) ILIKE '%9999999%'
      AND pg_get_constraintdef(oid) ILIKE '%>%'
      AND pg_get_constraintdef(oid) ILIKE '%<=%'
  ) THEN
    ALTER TABLE public.budgets ADD CONSTRAINT budgets_amount_range_check
      CHECK (amount > 0 AND amount <= 9999999) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.budgets'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%currency%'
      AND pg_get_constraintdef(oid) ILIKE '%INR%'
      AND pg_get_constraintdef(oid) ILIKE '%USD%'
      AND pg_get_constraintdef(oid) ILIKE '%EUR%'
      AND pg_get_constraintdef(oid) ILIKE '%GBP%'
      AND pg_get_constraintdef(oid) ILIKE '%JPY%'
      AND pg_get_constraintdef(oid) ILIKE '%AUD%'
      AND pg_get_constraintdef(oid) ILIKE '%CAD%'
  ) THEN
    ALTER TABLE public.budgets ADD CONSTRAINT budgets_currency_check
      CHECK (currency IN ('INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.budgets'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%period_type%'
      AND pg_get_constraintdef(oid) ILIKE '%weekly%'
      AND pg_get_constraintdef(oid) ILIKE '%monthly%'
      AND pg_get_constraintdef(oid) ILIKE '%custom%'
  ) THEN
    ALTER TABLE public.budgets ADD CONSTRAINT budgets_period_type_check
      CHECK (period_type IN ('weekly', 'monthly', 'custom')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.budgets'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%end_date%'
      AND pg_get_constraintdef(oid) ILIKE '%start_date%'
      AND pg_get_constraintdef(oid) ILIKE '%>=%'
  ) THEN
    ALTER TABLE public.budgets ADD CONSTRAINT budgets_date_range_check
      CHECK (end_date >= start_date) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.transactions'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%amount%'
      AND pg_get_constraintdef(oid) ILIKE '%9999999%'
      AND pg_get_constraintdef(oid) ILIKE '%>%'
      AND pg_get_constraintdef(oid) ILIKE '%<=%'
  ) THEN
    ALTER TABLE public.transactions ADD CONSTRAINT transactions_amount_range_check
      CHECK (amount > 0 AND amount <= 9999999) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.transactions'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%category%'
      AND pg_get_constraintdef(oid) ILIKE '%50%'
  ) THEN
    ALTER TABLE public.transactions ADD CONSTRAINT transactions_category_length_check
      CHECK (char_length(category) <= 50) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.transactions'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%comment%'
      AND pg_get_constraintdef(oid) ILIKE '%200%'
  ) THEN
    ALTER TABLE public.transactions ADD CONSTRAINT transactions_comment_length_check
      CHECK (comment IS NULL OR char_length(comment) <= 200) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.categories'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%name%'
      AND pg_get_constraintdef(oid) ILIKE '%50%'
  ) THEN
    ALTER TABLE public.categories ADD CONSTRAINT categories_name_length_check
      CHECK (char_length(name) <= 50) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.categories'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%emoji%'
      AND pg_get_constraintdef(oid) ILIKE '%10%'
  ) THEN
    ALTER TABLE public.categories ADD CONSTRAINT categories_emoji_length_check
      CHECK (char_length(emoji) <= 10) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.categories'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%color%'
      AND pg_get_constraintdef(oid) ILIKE '%#[0-9a-fA-F]{6}%'
  ) THEN
    ALTER TABLE public.categories ADD CONSTRAINT categories_color_format_check
      CHECK (color ~ '^#[0-9a-fA-F]{6}$') NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'budgets_amount_range_check' AND NOT convalidated)
    THEN ALTER TABLE public.budgets VALIDATE CONSTRAINT budgets_amount_range_check; END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'budgets_currency_check' AND NOT convalidated)
    THEN ALTER TABLE public.budgets VALIDATE CONSTRAINT budgets_currency_check; END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'budgets_period_type_check' AND NOT convalidated)
    THEN ALTER TABLE public.budgets VALIDATE CONSTRAINT budgets_period_type_check; END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'budgets_date_range_check' AND NOT convalidated)
    THEN ALTER TABLE public.budgets VALIDATE CONSTRAINT budgets_date_range_check; END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_amount_range_check' AND NOT convalidated)
    THEN ALTER TABLE public.transactions VALIDATE CONSTRAINT transactions_amount_range_check; END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_category_length_check' AND NOT convalidated)
    THEN ALTER TABLE public.transactions VALIDATE CONSTRAINT transactions_category_length_check; END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_comment_length_check' AND NOT convalidated)
    THEN ALTER TABLE public.transactions VALIDATE CONSTRAINT transactions_comment_length_check; END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_name_length_check' AND NOT convalidated)
    THEN ALTER TABLE public.categories VALIDATE CONSTRAINT categories_name_length_check; END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_emoji_length_check' AND NOT convalidated)
    THEN ALTER TABLE public.categories VALIDATE CONSTRAINT categories_emoji_length_check; END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_color_format_check' AND NOT convalidated)
    THEN ALTER TABLE public.categories VALIDATE CONSTRAINT categories_color_format_check; END IF;
END $$;

-- ─── Table privileges: API roles receive only row-policy-backed CRUD ──────────
-- PUBLIC is revoked as well as anon so an accidental PUBLIC grant cannot give
-- anon access back. service_role is explicitly restored to its privileged role.
REVOKE ALL PRIVILEGES ON TABLE
  public.budgets, public.categories, public.transactions
  FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.budgets, public.categories, public.transactions
  TO authenticated;

GRANT ALL PRIVILEGES ON TABLE
  public.budgets, public.categories, public.transactions
  TO service_role;

-- ─── Default privileges: future public tables start closed to API roles ──────
DO $$
DECLARE
  creator_role TEXT;
BEGIN
  FOREACH creator_role IN ARRAY ARRAY['postgres', 'supabase_admin'] LOOP
    IF (
      current_user = creator_role
      OR pg_has_role(current_user, creator_role, 'MEMBER')
      OR EXISTS (
        SELECT 1 FROM pg_roles
        WHERE rolname = current_user AND rolsuper
      )
    ) THEN
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon, authenticated',
        creator_role
      );
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_default_acl d
    JOIN pg_roles owner_role ON owner_role.oid = d.defaclrole
    CROSS JOIN LATERAL aclexplode(d.defaclacl) acl
    LEFT JOIN pg_roles grantee_role ON grantee_role.oid = acl.grantee
    JOIN pg_namespace schema_name ON schema_name.oid = d.defaclnamespace
    WHERE d.defaclobjtype = 'r'
      AND schema_name.nspname = 'public'
      AND owner_role.rolname = 'postgres'
      AND (
        acl.grantee = 0
        OR grantee_role.rolname IN ('anon', 'authenticated')
      )
  ) THEN
    RAISE EXCEPTION 'Postgres public-schema table defaults still grant PUBLIC, anon, or authenticated; remediation stopped';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_default_acl d
    JOIN pg_roles owner_role ON owner_role.oid = d.defaclrole
    CROSS JOIN LATERAL aclexplode(d.defaclacl) acl
    LEFT JOIN pg_roles grantee_role ON grantee_role.oid = acl.grantee
    JOIN pg_namespace schema_name ON schema_name.oid = d.defaclnamespace
    WHERE d.defaclnamespace <> 0
      AND schema_name.nspname = 'public'
      AND owner_role.rolname = 'supabase_admin'
      AND d.defaclobjtype = 'r'
      AND (
        acl.grantee = 0
        OR grantee_role.rolname IN ('anon', 'authenticated')
      )
  ) THEN
    RAISE NOTICE 'supabase_admin public-schema table defaults still grant API roles; this Supabase-managed role was not modified without authority. Do not create FireFLeet application objects as supabase_admin; review platform-level defaults separately.';
  END IF;
END $$;

-- ─── Function security: preserve the event trigger, remove API execution ─────
DO $$
DECLARE
  is_security_definer BOOLEAN;
BEGIN
  SELECT prosecdef INTO is_security_definer
  FROM pg_proc
  WHERE oid = 'public.rls_auto_enable()'::regprocedure;

  IF NOT is_security_definer THEN
    RAISE EXCEPTION 'public.rls_auto_enable() is not SECURITY DEFINER; remediation stopped';
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_updated_at_column()
  FROM PUBLIC, anon, authenticated;

-- ─── Policies: authenticated-only ownership checks ────────────────────────────
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can read own budgets" ON public.budgets;
  DROP POLICY IF EXISTS "Users can insert own budgets" ON public.budgets;
  DROP POLICY IF EXISTS "Users can update own budgets" ON public.budgets;
  DROP POLICY IF EXISTS "Users can delete own budgets" ON public.budgets;

  DROP POLICY IF EXISTS "Users can read own transactions" ON public.transactions;
  DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
  DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
  DROP POLICY IF EXISTS "Users can delete own transactions" ON public.transactions;

  DROP POLICY IF EXISTS "Users can read own categories" ON public.categories;
  DROP POLICY IF EXISTS "Users can insert own categories" ON public.categories;
  DROP POLICY IF EXISTS "Users can update own categories" ON public.categories;
  DROP POLICY IF EXISTS "Users can delete own categories" ON public.categories;
END $$;

CREATE POLICY "Users can read own budgets"
  ON public.budgets FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can insert own budgets"
  ON public.budgets FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can update own budgets"
  ON public.budgets FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can delete own budgets"
  ON public.budgets FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can read own transactions"
  ON public.transactions FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can insert own transactions"
  ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (
      budget_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.budgets b
        WHERE b.id = budget_id
          AND b.user_id = (SELECT auth.uid())
      )
    )
  );
CREATE POLICY "Users can update own transactions"
  ON public.transactions FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (
      budget_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.budgets b
        WHERE b.id = budget_id
          AND b.user_id = (SELECT auth.uid())
      )
    )
  );
CREATE POLICY "Users can delete own transactions"
  ON public.transactions FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can read own categories"
  ON public.categories FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can insert own categories"
  ON public.categories FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can update own categories"
  ON public.categories FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can delete own categories"
  ON public.categories FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ─── Performance ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_categories_user_id
  ON public.categories(user_id);
