'use client';

import { useCallback, useEffect, useRef } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { useStore, type Transaction } from '@/lib/store';
import { useAuth } from './useAuth';
import { generateId, validateAmount } from '@/lib/utils';

export function useTransactions() {
  const { user } = useAuth();
  const supabase = getSupabaseBrowserClient();
  const budget = useStore((s) => s.budget);
  const addTx = useStore((s) => s.addTransaction);
  const deleteTx = useStore((s) => s.deleteTransaction);
  const setTransactions = useStore((s) => s.setTransactions);

  // Store pending deletes so we can undo them
  const pendingDeletes = useRef<Map<string, Transaction>>(new Map());

  const fetchTransactions = useCallback(async () => {
    if (!user || !budget) return;

    // DAT-05: Verify budget belongs to current user
    if (budget.userId !== user.id) {
      setTransactions([]);
      return;
    }

    const { data, error } = await supabase
      .from('transactions')
      .select('id, amount, category, comment, created_at, user_id, budget_id')
      .eq('user_id', user.id)
      .eq('budget_id', budget.id)
      .order('created_at', { ascending: false })
      .limit(500);

    if (!error && data) {
      setTransactions(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data.map((t: any) => {
          const amount = Number(t.amount);
          return {
            id: String(t.id),
            amount: isFinite(amount) ? amount : 0,
            category: String(t.category || 'other'),
            comment: t.comment ? String(t.comment).slice(0, 200) : null,
            created_at: String(t.created_at),
            userId: String(t.user_id),
            budgetId: String(t.budget_id),
          };
        })
      );
    }
  }, [user, budget, supabase, setTransactions]);

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

      const amountError = validateAmount(amount);
      if (amountError) throw new Error(amountError);

      const safeCategory = String(category).slice(0, 50);
      const safeComment = comment ? String(comment).trim().slice(0, 200) : null;
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

      // Haptic feedback
      navigator?.vibrate?.(10);

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

  /**
   * Soft delete — removes from UI immediately.
   * The actual DB delete happens after a 5s undo window (via confirmDelete).
   * If user calls restoreTransaction within 5s, the transaction is put back.
   */
  const deleteTransaction = useCallback(
    (id: string) => {
      const safeId = String(id);
      const transactions = useStore.getState().transactions;
      const tx = transactions.find((t) => t.id === safeId);

      if (tx) {
        pendingDeletes.current.set(safeId, tx);
      }

      // Remove from UI immediately
      deleteTx(safeId);

      // Schedule permanent DB delete after 5s
      setTimeout(async () => {
        if (!pendingDeletes.current.has(safeId)) return; // already restored
        pendingDeletes.current.delete(safeId);

        if (!user) return;
        await supabase
          .from('transactions')
          .delete()
          .eq('id', safeId)
          .eq('user_id', user.id);
      }, 5500); // slightly longer than the 5s undo UI to ensure user can tap
    },
    [user, supabase, deleteTx]
  );

  /**
   * Undo a soft delete — puts the transaction back into the store.
   */
  const restoreTransaction = useCallback(
    (id: string) => {
      const safeId = String(id);
      const tx = pendingDeletes.current.get(safeId);
      if (tx) {
        pendingDeletes.current.delete(safeId);
        addTx(tx);
      }
    },
    [addTx]
  );

  return { fetchTransactions, addTransaction, deleteTransaction, restoreTransaction };
}
