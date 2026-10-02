'use client';

import { useCallback, useEffect } from 'react';
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
          amount: Number(t.amount), // ensure numeric — Supabase DECIMAL returns string
          category: t.category,
          comment: t.comment ?? null,
          created_at: t.created_at,
          userId: t.user_id,
          budgetId: t.budget_id,
        }))
      );
    }
  }, [user, budget, supabase, setTransactions]);

  // Bug #1 fix: fetch transactions whenever budget becomes available
  useEffect(() => {
    if (user && budget) {
      fetchTransactions();
    }
  }, [user?.id, budget?.id]); // Only re-run when user or budget identity changes
  // eslint-disable-next-line react-hooks/exhaustive-deps

  const addTransaction = useCallback(
    async ({ amount, category, comment }: { amount: number; category: string; comment: string | null }) => {
      if (!user || !budget) return;

      // Optimistic update — shows immediately in UI
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
      const { data, error } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          budget_id: budget.id,
          amount,
          category,
          comment,
        })
        .select()
        .single();

      if (error) {
        // Rollback on failure
        deleteTx(tempId);
        throw error;
      }

      // Replace temp ID with real server ID
      deleteTx(tempId);
      addTx({
        id: data.id,
        amount: Number(data.amount),
        category: data.category,
        comment: data.comment ?? null,
        created_at: data.created_at,
        userId: data.user_id,
        budgetId: data.budget_id,
      });
    },
    [user, budget, supabase, addTx, deleteTx]
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      // Optimistic — remove from UI immediately
      deleteTx(id);
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id ?? ''); // RLS also enforces, but explicit for safety

      if (error) {
        // Can't easily rollback without storing; refetch from server
        await fetchTransactions();
      }
    },
    [user, supabase, deleteTx, fetchTransactions]
  );

  return { fetchTransactions, addTransaction, deleteTransaction };
}
