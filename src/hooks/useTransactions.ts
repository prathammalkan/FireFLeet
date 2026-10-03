'use client';

import { useCallback, useEffect } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import { useAuth } from './useAuth';
import { generateId, validateAmount, isValidCurrency } from '@/lib/utils';
import type { Currency, PeriodType } from '@/lib/store';

export function useTransactions() {
  const { user } = useAuth();
  const supabase = getSupabaseBrowserClient();
  const budget = useStore((s) => s.budget);
  const addTx = useStore((s) => s.addTransaction);
  const deleteTx = useStore((s) => s.deleteTransaction);
  const setTransactions = useStore((s) => s.setTransactions);

  const fetchTransactions = useCallback(async () => {
    if (!user || !budget) return;

    // DAT-05 FIX: Verify this budget belongs to the current user before querying
    if (budget.userId !== user.id) {
      setTransactions([]);
      return;
    }

    const { data, error } = await supabase
      .from('transactions')
      .select('id, amount, category, comment, created_at, user_id, budget_id')
      .eq('user_id', user.id)          // double-guard (RLS also enforces this)
      .eq('budget_id', budget.id)
      .order('created_at', { ascending: false })
      .limit(500);                     // safety cap — prevent memory DoS on huge accounts

    if (!error && data) {
      setTransactions(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data.map((t: any) => {
          const amount = Number(t.amount);
          return {
            id: String(t.id),
            amount: isFinite(amount) ? amount : 0,   // guard corrupt DB values
            category: String(t.category || 'other'),
            comment: t.comment ? String(t.comment).slice(0, 200) : null, // sanitize length
            created_at: String(t.created_at),
            userId: String(t.user_id),
            budgetId: String(t.budget_id),
          };
        })
      );
    }
  }, [user, budget, supabase, setTransactions]);

  // Fetch whenever user+budget identity changes
  useEffect(() => {
    if (user && budget) fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, budget?.id]);

  const addTransaction = useCallback(
    async ({
      amount,
      category,
      comment,
    }: {
      amount: number;
      category: string;
      comment: string | null;
    }) => {
      if (!user || !budget) throw new Error('Not authenticated');

      // DAT-04 FIX: Validate amount client-side before optimistic update
      const amountError = validateAmount(amount);
      if (amountError) throw new Error(amountError);

      // Sanitize inputs
      const safeCategory = String(category).slice(0, 50);
      const safeComment = comment ? String(comment).trim().slice(0, 200) : null;
      // Round to 2dp to prevent floating-point values reaching DB
      const safeAmount = Math.round(amount * 100) / 100;

      // Optimistic update
      const tempId = generateId();
      const optimistic = {
        id: tempId,
        amount: safeAmount,
        category: safeCategory,
        comment: safeComment,
        created_at: new Date().toISOString(),
        userId: user.id,
        budgetId: budget.id,
      };
      addTx(optimistic);

      const { data, error } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          budget_id: budget.id,
          amount: safeAmount,
          category: safeCategory,
          comment: safeComment,
        })
        .select('id, amount, category, comment, created_at, user_id, budget_id')
        .single();

      if (error) {
        deleteTx(tempId);
        throw error;
      }

      // Replace temp with server record
      deleteTx(tempId);
      addTx({
        id: data.id,
        amount: Math.round(Number(data.amount) * 100) / 100,
        category: String(data.category),
        comment: data.comment ? String(data.comment).slice(0, 200) : null,
        created_at: data.created_at,
        userId: data.user_id,
        budgetId: data.budget_id,
      });
    },
    [user, budget, supabase, addTx, deleteTx]
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      if (!user) return;
      const safeId = String(id);

      // Optimistic removal
      deleteTx(safeId);

      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', safeId)
        .eq('user_id', user.id);   // belt-and-suspenders on top of RLS

      if (error) {
        // Re-sync from server on failure
        await fetchTransactions();
      }
    },
    [user, supabase, deleteTx, fetchTransactions]
  );

  return { fetchTransactions, addTransaction, deleteTransaction };
}
