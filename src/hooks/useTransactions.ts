'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import { pendingDeleteTimers, pendingDeletes } from '@/lib/pendingDeletes';
import { useAuth } from './useAuth';
import { generateId, validateAmount } from '@/lib/utils';

// Stable module-level singleton — no re-instantiation on render
const supabase = getSupabaseBrowserClient();

interface TransactionRow {
  id: string;
  amount: string | number;
  category: string | null;
  comment: string | null;
  created_at: string;
  user_id: string;
  budget_id: string | null;
}

export function useTransactions() {
  const { user } = useAuth();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const clearDeleteError = useCallback(() => setDeleteError(null), []);
  const budget = useStore((s) => s.budget);
  const addTx = useStore((s) => s.addTransaction);
  const deleteTx = useStore((s) => s.deleteTransaction);
  const setTransactions = useStore((s) => s.setTransactions);

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

    if (error) {
      console.warn('fetchTransactions: database request failed', error.message);
      return;
    }

    if (data) {
      setTransactions(
        data
          // Keep rows pending deletion hidden until the DB delete lands
          .filter((t: TransactionRow) => !pendingDeletes.has(String(t.id)))
          .map((t: TransactionRow) => {
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
  }, [user, budget, setTransactions]);

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
      if (typeof navigator !== 'undefined') navigator.vibrate?.(10);

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
    [user, budget, addTx, deleteTx]
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

      // A stale gesture must not issue a blind delete for an unknown row.
      if (!tx || !user) return;

      const previousTimer = pendingDeleteTimers.get(safeId);
      if (previousTimer) clearTimeout(previousTimer);
      pendingDeletes.set(safeId, tx);
      setDeleteError(null);

      // Remove from UI immediately
      deleteTx(safeId);

      // Schedule permanent DB delete after 5s
      const timer = setTimeout(async () => {
        if (!pendingDeletes.has(safeId)) return; // already restored or flushed
        pendingDeletes.delete(safeId);
        pendingDeleteTimers.delete(safeId);

        try {
          const { error } = await supabase
            .from('transactions')
            .delete()
            .eq('id', safeId)
            .eq('user_id', user.id);
          if (error) throw error;
        } catch (e) {
          console.warn('deleteTransaction: DB delete threw', e);
          // Restore only if a concurrent refresh has not already reinserted it.
          useStore.setState((state) => state.transactions.some((t) => t.id === tx.id)
            ? state
            : { transactions: [tx, ...state.transactions] });
          setDeleteError('Could not delete that expense. It was restored.');
        }
      }, 5500); // slightly longer than the 5s undo UI to ensure user can tap
      pendingDeleteTimers.set(safeId, timer);
    },
    [deleteTx, user]
  );

  /**
   * Undo a soft delete — puts the transaction back into the store.
   */
  const restoreTransaction = useCallback(
    (id: string) => {
      const safeId = String(id);
      const tx = pendingDeletes.get(safeId);
      if (tx) {
        const timer = pendingDeleteTimers.get(safeId);
        if (timer) clearTimeout(timer);
        pendingDeleteTimers.delete(safeId);
        pendingDeletes.delete(safeId);
        useStore.setState((state) => state.transactions.some((t) => t.id === tx.id)
          ? state
          : { transactions: [tx, ...state.transactions] });
        setDeleteError(null);
      }
    },
    []
  );

  return {
    fetchTransactions,
    addTransaction,
    deleteTransaction,
    restoreTransaction,
    deleteError,
    clearDeleteError,
  };
}
