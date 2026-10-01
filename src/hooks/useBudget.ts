'use client';

import { useCallback, useEffect } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import { useAuth } from './useAuth';
import type { Currency, PeriodType } from '@/lib/store';

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

  // Fetch budget on mount
  useEffect(() => {
    if (!user || budget) return;
    fetchBudget();
  }, [user]);

  const fetchBudget = useCallback(async () => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('budgets')
      .select('*')
      .eq('user_id', user.id)
      .gte('end_date', today)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!error && data) {
      setBudget({
        id: data.id,
        amount: data.amount,
        currency: data.currency as Currency,
        periodType: data.period_type as PeriodType,
        startDate: data.start_date,
        endDate: data.end_date,
        userId: data.user_id,
      });
    }
  }, [user, supabase, setBudget]);

  const createBudget = useCallback(
    async (params: CreateBudgetParams) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('budgets')
        .insert({
          user_id: user.id,
          amount: params.amount,
          currency: params.currency,
          period_type: params.periodType,
          start_date: params.startDate,
          end_date: params.endDate,
        })
        .select()
        .single();

      if (error) throw error;
      setBudget({
        id: data.id,
        amount: data.amount,
        currency: data.currency as Currency,
        periodType: data.period_type as PeriodType,
        startDate: data.start_date,
        endDate: data.end_date,
        userId: data.user_id,
      });
    },
    [user, supabase, setBudget]
  );

  return { budget, fetchBudget, createBudget };
}
