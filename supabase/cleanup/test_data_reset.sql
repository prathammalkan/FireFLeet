-- =============================================================================
-- FireFleet — Test Data Reset Script
-- =============================================================================
--
-- SAFETY: This script is authorized ONLY for Supabase project: pcancrkntdvnlvgbuitl
-- DO NOT execute this against any other project.
--
-- PURPOSE: Wipes all test user data from transactions, budgets, and categories,
--          then re-applies migration state so the schema is clean for release testing.
--
-- EXECUTION: Run in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
--            Verify the project URL in Settings → General before executing.
--
-- VERIFICATION STEP (run this first to confirm you are on the correct project):
-- SELECT current_database(), NOW();
-- Expected: database name should correspond to project pcancrkntdvnlvgbuitl
--
-- =============================================================================

-- Step 1: Pre-wipe row counts (verify expected state before deletion)
SELECT 'transactions' AS table_name, COUNT(*) AS row_count FROM public.transactions
UNION ALL
SELECT 'budgets', COUNT(*) FROM public.budgets
UNION ALL
SELECT 'categories', COUNT(*) FROM public.categories;

-- Step 2: Delete all test data in dependency order
--         (transactions reference budgets, so delete transactions first)
DELETE FROM public.transactions;
DELETE FROM public.budgets;
DELETE FROM public.categories;

-- Step 3: Post-wipe verification — all counts must be 0
SELECT 'transactions' AS table_name, COUNT(*) AS row_count FROM public.transactions
UNION ALL
SELECT 'budgets', COUNT(*) FROM public.budgets
UNION ALL
SELECT 'categories', COUNT(*) FROM public.categories;

-- Step 4: Verify RLS policies are still active after the wipe
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM
  pg_tables
WHERE
  schemaname = 'public'
  AND tablename IN ('transactions', 'budgets', 'categories')
ORDER BY tablename;

-- Step 5: Verify all expected indexes are present
SELECT
  indexname,
  tablename
FROM
  pg_indexes
WHERE
  schemaname = 'public'
  AND tablename IN ('transactions', 'budgets', 'categories')
ORDER BY tablename, indexname;

-- =============================================================================
-- End of test_data_reset.sql
-- Project: pcancrkntdvnlvgbuitl
-- =============================================================================
