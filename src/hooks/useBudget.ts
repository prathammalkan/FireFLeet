'use client';

import { useCallback, useEffect, useRef } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import { useAuth } from './useAuth';
import { isValidCurrency } from '@/lib/utils';
import type { Currency, PeriodType } from '@/lib/store';

const VALID_PERIOD_TYPES: PeriodType[] = ['weekly', 'monthly', 'custom'];

interface CreateBudgetParams {
  amount: number;
  currency: Currency;
  periodType: PeriodType;
  startDate: string;
  endDate: string;
}

export function useBudget() {
  const { user } = useAuth();
  const supabase = getSupabaseBrowserClient();
  const setBudget = useStore((s) => s.setBudget);
  const budget = useStore((s) => s.budget);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchBudget = useCallback(async () => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('budgets')
      .select('id, amount, currency, period_type, start_date, end_date, user_id')
      .eq('user_id', user.id)
      .gte('end_date', today)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[useBudget] fetch error:', error.message);
      return;
    }

    if (data) {
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

      setBudget({
        id: String(data.id),
        amount: Math.round(amount * 100) / 100,  // normalize to 2dp
        currency,
        periodType,
        startDate: String(data.start_date),
        endDate: String(data.end_date),
        userId: String(data.user_id),
      });
    } else {
      // No active budget — clear any stale cached budget
      setBudget(null);
    }
  }, [user, supabase, setBudget]);

  // Fetch on mount when user available and no budget cached
  useEffect(() => {
    if (!user || budget) return;
    fetchBudget();
  }, [user, budget, fetchBudget]);

  // EDGE-01 FIX: Refresh budget every 5 minutes to detect expiry at runtime
  useEffect(() => {
    if (!user) return;
    refreshTimerRef.current = setInterval(fetchBudget, 5 * 60 * 1000);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
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

      setBudget({
        id: data.id,
        amount: Math.round(Number(data.amount) * 100) / 100,
        currency: isValidCurrency(data.currency) ? data.currency : 'INR',
        periodType: VALID_PERIOD_TYPES.includes(data.period_type as PeriodType)
          ? (data.period_type as PeriodType)
          : 'monthly',
        startDate: data.start_date,
        endDate: data.end_date,
        userId: data.user_id,
      });
    },
    [user, supabase, setBudget]
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
      setBudget({ ...budget, amount: confirmed });
      return confirmed;
    },
    [user, budget, supabase, setBudget]
  );

  return { budget, fetchBudget, createBudget, updateBudgetAmount };
}
