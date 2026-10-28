'use client';

import { useCallback, useEffect, useRef } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import { useAuth } from './useAuth';
import { isValidCurrency, toDateInputValue } from '@/lib/utils';
import { getCachedBudget, setCachedBudget } from '@/lib/cache';
import type { Currency, PeriodType } from '@/lib/store';

// Stable module-level singleton — no re-instantiation on render
const supabase = getSupabaseBrowserClient();

const VALID_PERIOD_TYPES: PeriodType[] = ['weekly', 'monthly', 'custom'];

/**
 * Minimum gap between revalidation fetches triggered by focus/visibility events.
 * Prevents a burst of fetches when the user rapidly switches tabs.
 */
const REVALIDATE_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes

interface CreateBudgetParams {
  amount: number;
  currency: Currency;
  periodType: PeriodType;
  startDate: string;
  endDate: string;
}

export function useBudget() {
  const { user } = useAuth();
  const setBudget = useStore((s) => s.setBudget);
  const budget = useStore((s) => s.budget);
  const lastFetchRef = useRef<number>(0);

  const fetchBudget = useCallback(async () => {
    if (!user) return;
    // Capture userId at call time — used for post-await ownership verification.
    const callerUserId = user.id;
    const today = toDateInputValue();
    const { data, error } = await supabase
      .from('budgets')
      .select('id, amount, currency, period_type, start_date, end_date, user_id')
      .eq('user_id', callerUserId)
      .gte('end_date', today)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // ACCOUNT-TRANSITION GUARD: after the await the active user may have changed
    // (sign-out, account switch). Discard a response that belongs to a stale session
    // so it can never populate the new user's store.
    if (useStore.getState().currentUser?.id !== callerUserId) return;

    if (error) {
      console.error('[useBudget] fetch error:', error.message);
      return;
    }

    if (data) {
      // Defence-in-depth: verify the returned row belongs to the caller (RLS + .eq() enforce
      // this server-side, but an explicit check ensures a logic bug cannot cross user data).
      if (String(data.user_id) !== callerUserId) {
        console.error('[useBudget] Cross-user data in response; discarding');
        return;
      }

      // SEC-04 FIX: Validate all server values before trusting them
      const currency = isValidCurrency(data.currency) ? data.currency : 'INR';
      const periodType = VALID_PERIOD_TYPES.includes(data.period_type as PeriodType)
        ? (data.period_type as PeriodType)
        : 'monthly';
      const amount = Number(data.amount);

      if (!isFinite(amount) || amount <= 0) {
        console.error('[useBudget] Invalid amount from server:', data.amount);
        return;
      }

      const validated = {
        id: String(data.id),
        amount: Math.round(amount * 100) / 100,  // normalize to 2dp
        currency,
        periodType,
        startDate: String(data.start_date),
        endDate: String(data.end_date),
        userId: callerUserId,
      };

      setBudget(validated);
      lastFetchRef.current = Date.now();

      // Write to cache after successful fetch (account-isolated by userId)
      void setCachedBudget(callerUserId, validated);
    } else {
      // No active budget — clear any stale cached budget
      setBudget(null);
      lastFetchRef.current = Date.now();
      void setCachedBudget(callerUserId, null);
    }
  }, [user, setBudget]);

  // On mount: hydrate from IndexedDB cache first, then fetch from Supabase
  useEffect(() => {
    if (!user) return;
    if (budget) return; // already hydrated in memory

    let cancelled = false;

    async function hydrate() {
      if (!user) return;
      const hydrateUserId = user.id;
      // Try cache first for instant paint
      const cached = await getCachedBudget(hydrateUserId);
      // Verify the user has not changed since we started the async read
      if (useStore.getState().currentUser?.id !== hydrateUserId) return;
      if (cached !== null && !cancelled) {
        setBudget(cached);
        // Still revalidate from network in background — cache may be stale
      }
      if (!cancelled) {
        await fetchBudget();
      }
    }

    void hydrate();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Revalidate on window focus and visibility restore — replaces setInterval polling.
  // A 2-minute cooldown prevents redundant fetches from rapid tab-switching.
  useEffect(() => {
    if (!user) return;

    function maybeRevalidate() {
      if (Date.now() - lastFetchRef.current < REVALIDATE_COOLDOWN_MS) return;
      void fetchBudget();
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') maybeRevalidate();
    }

    function onFocus() {
      maybeRevalidate();
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
    };
  }, [user, fetchBudget]);

  const createBudget = useCallback(
    async (params: CreateBudgetParams) => {
      if (!user) throw new Error('Not authenticated');

      // Validate all params server-side too (DB constraints enforce), but be explicit
      if (!isFinite(params.amount) || params.amount <= 0 || params.amount > 9_999_999) {
        throw new Error('Invalid budget amount');
      }
      if (!isValidCurrency(params.currency)) throw new Error('Invalid currency');
      if (!VALID_PERIOD_TYPES.includes(params.periodType)) throw new Error('Invalid period');

      const safeAmount = Math.round(params.amount * 100) / 100;

      const { data, error } = await supabase
        .from('budgets')
        .insert({
          user_id: user.id,
          amount: safeAmount,
          currency: params.currency,
          period_type: params.periodType,
          start_date: params.startDate,
          end_date: params.endDate,
        })
        .select('id, amount, currency, period_type, start_date, end_date, user_id')
        .single();

      if (error) throw error;

      const validated = {
        id: data.id,
        amount: Math.round(Number(data.amount) * 100) / 100,
        currency: isValidCurrency(data.currency) ? data.currency : 'INR',
        periodType: VALID_PERIOD_TYPES.includes(data.period_type as PeriodType)
          ? (data.period_type as PeriodType)
          : 'monthly',
        startDate: data.start_date,
        endDate: data.end_date,
        userId: data.user_id,
      };

      setBudget(validated);
      lastFetchRef.current = Date.now();
      void setCachedBudget(user.id, validated);
    },
    [user, setBudget]
  );

  /**
   * Top-up: add amount to existing budget total.
   * Returns new confirmed amount from server.
   */
  const updateBudgetAmount = useCallback(
    async (newAmount: number): Promise<number> => {
      if (!user || !budget) throw new Error('Not authenticated');
      if (!isFinite(newAmount) || newAmount <= 0 || newAmount > 9_999_999) {
        throw new Error('Invalid amount');
      }
      const safeAmount = Math.round(newAmount * 100) / 100;

      const { data, error } = await supabase
        .from('budgets')
        .update({ amount: safeAmount })
        .eq('id', budget.id)
        .eq('user_id', user.id)
        .select('amount')
        .single();

      if (error) throw error;
      const confirmed = Math.round(Number(data.amount) * 100) / 100;
      const updated = { ...budget, amount: confirmed };
      setBudget(updated);
      void setCachedBudget(user.id, updated);
      return confirmed;
    },
    [user, budget, setBudget]
  );

  return { budget, fetchBudget, createBudget, updateBudgetAmount };
}
