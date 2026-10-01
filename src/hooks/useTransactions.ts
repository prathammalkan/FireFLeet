'use client';

import { useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import { useAuth } from './useAuth';
import { generateId } from '@/lib/utils';

export function useTransactions() {
  const { user } = useAuth();
  const supabase = getSupabaseBrowserClient();
  const budget = useStore((s) => s.budget);
  const addTx = useStore((s) => s.addTransaction);
  const deleteTx = useStore((s) => s.deleteTransaction);
  const setTransactions = useStore((s) => s.setTransactions);

  const fetchTransactions = useCallback(async () => {
    if (!user || !budget) return;
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('budget_id', budget.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setTransactions(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data.map((t: any) => ({
          id: t.id,
          amount: t.amount,
          category: t.category,
          comment: t.comment,
          created_at: t.created_at,
          userId: t.user_id,
          budgetId: t.budget_id,
        }))
      );
    }
  }, [user, budget, supabase, setTransactions]);

  const addTransaction = useCallback(
    async ({ amount, category, comment }: { amount: number; category: string; comment: string | null }) => {
      if (!user || !budget) return;

      // Optimistic update
      const tempId = generateId();
      const optimistic = {
        id: tempId,
        amount,
        category,
        comment,
        created_at: new Date().toISOString(),
        userId: user.id,
        budgetId: budget.id,
      };
      addTx(optimistic);

      // Persist to Supabase
      const { data, error } = await supabase.from('transactions').insert({
        user_id: user.id,
        budget_id: budget.id,
        amount,
        category,
        comment,
      }).select().single();

      if (error) {
        // Rollback
        deleteTx(tempId);
        throw error;
      }

      // Replace temp with real
      deleteTx(tempId);
      addTx({
        id: data.id,
        amount: data.amount,
        category: data.category,
        comment: data.comment,
        created_at: data.created_at,
        userId: data.user_id,
        budgetId: data.budget_id,
      });
    },
    [user, budget, supabase, addTx, deleteTx]
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      // Optimistic
      deleteTx(id);
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) {
        // Can't easily rollback without storing the item; just refetch
        await fetchTransactions();
      }
    },
    [supabase, deleteTx, fetchTransactions]
  );

  return { fetchTransactions, addTransaction, deleteTransaction };
}
