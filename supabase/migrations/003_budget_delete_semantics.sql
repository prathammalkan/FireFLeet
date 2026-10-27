-- FireFleet budget deletion semantics — v1
--
-- The application contract is that Settings > Reset Data deletes the budget
-- and all of its transactions. The repository schema therefore specifies
-- ON DELETE CASCADE. This forward-only migration repairs the known live drift
-- from ON DELETE SET NULL without rewriting existing rows.
--
-- It fails closed for a missing, ambiguous, unvalidated, or unexpected foreign
-- key. The drop/add occurs inside one DO statement so a failure cannot leave
-- this foreign key half-replaced when the migration runner commits statements
-- individually.

DO $$
DECLARE
  fk RECORD;
  matching_fk_count INTEGER;
BEGIN
  IF to_regclass('public.transactions') IS NULL
     OR to_regclass('public.budgets') IS NULL THEN
    RAISE EXCEPTION 'Required budgets or transactions table is missing; cascade migration stopped';
  END IF;

  SELECT count(*) INTO matching_fk_count
  FROM pg_constraint c
  WHERE c.conrelid = 'public.transactions'::regclass
    AND c.contype = 'f'
    AND c.confrelid = 'public.budgets'::regclass
    AND c.conkey = ARRAY[
      (SELECT a.attnum
       FROM pg_attribute a
       WHERE a.attrelid = 'public.transactions'::regclass
         AND a.attname = 'budget_id'
         AND NOT a.attisdropped)
    ]::smallint[]
    AND c.confkey = ARRAY[
      (SELECT a.attnum
       FROM pg_attribute a
       WHERE a.attrelid = 'public.budgets'::regclass
         AND a.attname = 'id'
         AND NOT a.attisdropped)
    ]::smallint[];

  IF matching_fk_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one transactions.budget_id -> budgets.id foreign key, found %; cascade migration stopped',
      matching_fk_count;
  END IF;

  SELECT c.conname, c.confdeltype, c.convalidated, c.condeferrable,
         c.condeferred, c.connoinherit
  INTO fk
  FROM pg_constraint c
  WHERE c.conrelid = 'public.transactions'::regclass
    AND c.contype = 'f'
    AND c.confrelid = 'public.budgets'::regclass
    AND c.conkey = ARRAY[
      (SELECT a.attnum
       FROM pg_attribute a
       WHERE a.attrelid = 'public.transactions'::regclass
         AND a.attname = 'budget_id'
         AND NOT a.attisdropped)
    ]::smallint[]
    AND c.confkey = ARRAY[
      (SELECT a.attnum
       FROM pg_attribute a
       WHERE a.attrelid = 'public.budgets'::regclass
         AND a.attname = 'id'
         AND NOT a.attisdropped)
    ]::smallint[];

  IF NOT fk.convalidated OR fk.condeferrable OR fk.condeferred OR fk.connoinherit THEN
    RAISE EXCEPTION 'Existing foreign key % has unsupported validation or deferrability; cascade migration stopped', fk.conname;
  END IF;

  IF fk.confdeltype = 'c' THEN
    RETURN;
  END IF;

  IF fk.confdeltype <> 'n' THEN
    RAISE EXCEPTION 'Existing foreign key % has delete action %, expected SET NULL or CASCADE; cascade migration stopped',
      fk.conname, fk.confdeltype;
  END IF;

  EXECUTE format(
    'ALTER TABLE public.transactions DROP CONSTRAINT %I',
    fk.conname
  );
  EXECUTE format(
    'ALTER TABLE public.transactions ADD CONSTRAINT %I FOREIGN KEY (budget_id) REFERENCES public.budgets(id) ON DELETE CASCADE',
    fk.conname
  );
END $$;
