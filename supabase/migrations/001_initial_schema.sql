-- FireFleet Database Schema — v2
-- Enhanced security constraints, indexes, and RLS hardening
-- Run this in the Supabase SQL Editor (safe to run on existing schema)

-- ─── Enable Extensions ────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Budgets ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS budgets (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      DECIMAL(12, 2) NOT NULL CHECK (amount > 0 AND amount <= 9999999),
  currency    TEXT        NOT NULL DEFAULT 'INR'
                CHECK (currency IN ('INR','USD','EUR','GBP','JPY','AUD','CAD')),
  period_type TEXT        NOT NULL DEFAULT 'monthly'
                CHECK (period_type IN ('weekly','monthly','custom')),
  start_date  DATE        NOT NULL,
  end_date    DATE        NOT NULL CHECK (end_date >= start_date),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Transactions ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  budget_id   UUID        REFERENCES budgets(id) ON DELETE CASCADE, -- CASCADE (was SET NULL)
  amount      DECIMAL(12, 2) NOT NULL CHECK (amount > 0 AND amount <= 9999999),
  category    TEXT        NOT NULL DEFAULT 'other'
                CHECK (char_length(category) <= 50),
  comment     TEXT        CHECK (comment IS NULL OR char_length(comment) <= 200),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Categories (user-defined, optional) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL CHECK (char_length(name) <= 50),
  emoji       TEXT        NOT NULL DEFAULT '💸' CHECK (char_length(emoji) <= 10),
  color       TEXT        NOT NULL DEFAULT '#9ca3af'
                CHECK (color ~ '^#[0-9a-fA-F]{6}$'), -- hex color validation
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE budgets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies idempotently
DO $$
BEGIN
  -- Budgets
  DROP POLICY IF EXISTS "Users can read own budgets"   ON budgets;
  DROP POLICY IF EXISTS "Users can insert own budgets" ON budgets;
  DROP POLICY IF EXISTS "Users can update own budgets" ON budgets;
  DROP POLICY IF EXISTS "Users can delete own budgets" ON budgets;

  -- Transactions
  DROP POLICY IF EXISTS "Users can read own transactions"   ON transactions;
  DROP POLICY IF EXISTS "Users can insert own transactions" ON transactions;
  DROP POLICY IF EXISTS "Users can update own transactions" ON transactions;
  DROP POLICY IF EXISTS "Users can delete own transactions" ON transactions;

  -- Categories
  DROP POLICY IF EXISTS "Users can read own categories"   ON categories;
  DROP POLICY IF EXISTS "Users can insert own categories" ON categories;
  DROP POLICY IF EXISTS "Users can delete own categories" ON categories;
END $$;

-- Budgets: strict RLS — users can only touch their own rows
CREATE POLICY "Users can read own budgets"
  ON budgets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own budgets"
  ON budgets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own budgets"
  ON budgets FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own budgets"
  ON budgets FOR DELETE USING (auth.uid() = user_id);

-- Transactions: strict RLS with budget cross-check
-- INSERT also verifies that the budget_id belongs to the same user
CREATE POLICY "Users can read own transactions"
  ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions"
  ON transactions FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (
      budget_id IS NULL
      OR budget_id IN (SELECT id FROM budgets WHERE user_id = auth.uid())
    )
  );
CREATE POLICY "Users can update own transactions"
  ON transactions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions"
  ON transactions FOR DELETE USING (auth.uid() = user_id);

-- Categories
CREATE POLICY "Users can read own categories"
  ON categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own categories"
  ON categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories"
  ON categories FOR DELETE USING (auth.uid() = user_id);

-- ─── Auto-update updated_at ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_budgets_updated_at      ON budgets;
DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;

CREATE TRIGGER update_budgets_updated_at
  BEFORE UPDATE ON budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Indexes ──────────────────────────────────────────────────────────────────
-- Composite index: covers the exact query in useBudget (user_id + end_date filter)
CREATE INDEX IF NOT EXISTS idx_budgets_user_active
  ON budgets(user_id, end_date DESC);

-- Composite index: covers the exact query in useTransactions (user_id + budget_id + created_at)
CREATE INDEX IF NOT EXISTS idx_transactions_user_budget_date
  ON transactions(user_id, budget_id, created_at DESC);

-- Legacy single-col indexes (kept for backwards compat)
CREATE INDEX IF NOT EXISTS idx_budgets_user_id        ON budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id   ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_budget_id ON transactions(budget_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
