-- FireFleet security and schema remediation — v1
--
-- This migration is deliberately separate from 001_initial_schema.sql. It is
-- intended for an already-created Supabase database after the preflight
-- queries in the release runbook have been reviewed.
--
-- It fails closed when required service-role privileges, the RLS event trigger,
-- or existing data invariants are not present. It does not delete or rewrite
-- application rows.

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

-- ─── Constraints: idempotently add and validate missing invariants ────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.budgets'::regclass AND conname = 'budgets_amount_range_check'
  ) THEN
    ALTER TABLE public.budgets
      ADD CONSTRAINT budgets_amount_range_check
      CHECK (amount > 0 AND amount <= 9999999) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.budgets'::regclass AND conname = 'budgets_currency_check'
  ) THEN
    ALTER TABLE public.budgets
      ADD CONSTRAINT budgets_currency_check
      CHECK (currency IN ('INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.budgets'::regclass AND conname = 'budgets_period_type_check'
  ) THEN
    ALTER TABLE public.budgets
      ADD CONSTRAINT budgets_period_type_check
      CHECK (period_type IN ('weekly', 'monthly', 'custom')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.budgets'::regclass AND conname = 'budgets_date_range_check'
  ) THEN
    ALTER TABLE public.budgets
      ADD CONSTRAINT budgets_date_range_check
      CHECK (end_date >= start_date) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.transactions'::regclass AND conname = 'transactions_amount_range_check'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_amount_range_check
      CHECK (amount > 0 AND amount <= 9999999) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.transactions'::regclass AND conname = 'transactions_category_length_check'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_category_length_check
      CHECK (char_length(category) <= 50) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.transactions'::regclass AND conname = 'transactions_comment_length_check'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_comment_length_check
      CHECK (comment IS NULL OR char_length(comment) <= 200) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.categories'::regclass AND conname = 'categories_name_length_check'
  ) THEN
    ALTER TABLE public.categories
      ADD CONSTRAINT categories_name_length_check
      CHECK (char_length(name) <= 50) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.categories'::regclass AND conname = 'categories_emoji_length_check'
  ) THEN
    ALTER TABLE public.categories
      ADD CONSTRAINT categories_emoji_length_check
      CHECK (char_length(emoji) <= 10) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.categories'::regclass AND conname = 'categories_color_format_check'
  ) THEN
    ALTER TABLE public.categories
      ADD CONSTRAINT categories_color_format_check
      CHECK (color ~ '^#[0-9a-fA-F]{6}$') NOT VALID;
  END IF;
END $$;

ALTER TABLE public.budgets VALIDATE CONSTRAINT budgets_amount_range_check;
ALTER TABLE public.budgets VALIDATE CONSTRAINT budgets_currency_check;
ALTER TABLE public.budgets VALIDATE CONSTRAINT budgets_period_type_check;
ALTER TABLE public.budgets VALIDATE CONSTRAINT budgets_date_range_check;
ALTER TABLE public.transactions VALIDATE CONSTRAINT transactions_amount_range_check;
ALTER TABLE public.transactions VALIDATE CONSTRAINT transactions_category_length_check;
ALTER TABLE public.transactions VALIDATE CONSTRAINT transactions_comment_length_check;
ALTER TABLE public.categories VALIDATE CONSTRAINT categories_name_length_check;
ALTER TABLE public.categories VALIDATE CONSTRAINT categories_emoji_length_check;
ALTER TABLE public.categories VALIDATE CONSTRAINT categories_color_format_check;

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
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = creator_role) THEN
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon, authenticated',
        creator_role
      );
    END IF;
  END LOOP;
END $$;

-- ─── Function security: preserve the event trigger, remove API execution ─────
DO $$
DECLARE
  is_security_definer BOOLEAN;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE oid = 'public.rls_auto_enable()'::regprocedure
  ) THEN
    RAISE EXCEPTION 'public.rls_auto_enable() is missing; remediation stopped';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_event_trigger
    WHERE evtname = 'ensure_rls'
      AND evtenabled <> 'D'
      AND evtfoid = 'public.rls_auto_enable()'::regprocedure
  ) THEN
    RAISE EXCEPTION 'enabled ensure_rls event trigger registration is missing; remediation stopped';
  END IF;

  SELECT prosecdef INTO is_security_definer
  FROM pg_proc
  WHERE oid = 'public.rls_auto_enable()'::regprocedure;

  IF NOT is_security_definer THEN
    RAISE EXCEPTION 'public.rls_auto_enable() is not SECURITY DEFINER; remediation stopped';
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()
  FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE oid = 'public.update_updated_at_column()'::regprocedure
  ) THEN
    RAISE EXCEPTION 'public.update_updated_at_column() is missing; remediation stopped';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname IN ('update_budgets_updated_at', 'update_transactions_updated_at')
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'expected updated_at triggers are missing; remediation stopped';
  END IF;
END $$;

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
