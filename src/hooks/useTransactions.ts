'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import { pendingDeleteTimers, pendingDeletes } from '@/lib/pendingDeletes';
import { useAuth } from './useAuth';
import { generateId, validateAmount } from '@/lib/utils';
import { getCachedTransactions, setCachedTransactions } from '@/lib/cache';

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

  const normaliseRow = (t: TransactionRow) => {
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
  };

  const fetchTransactions = useCallback(async () => {
    if (!user || !budget) return;

    // DAT-05: Verify budget belongs to current user
    if (budget.userId !== user.id) {
      setTransactions([]);
      return;
    }

    // ACCOUNT-TRANSITION GUARD: capture identities at call time; discard stale responses.
    // A slow Supabase response arriving after sign-out or account-switch must not
    // populate the new user's store with the previous user's transactions.
    const callerUserId = user.id;
    const callerBudgetId = budget.id;

    const { data, error } = await supabase
      .from('transactions')
      .select('id, amount, category, comment, created_at, user_id, budget_id')
      .eq('user_id', callerUserId)
      .eq('budget_id', callerBudgetId)
      .order('created_at', { ascending: false })
      .limit(500);

    // After await: verify the active user/budget still match the caller's identity.
    const currentState = useStore.getState();
    if (
      currentState.currentUser?.id !== callerUserId ||
      currentState.budget?.id !== callerBudgetId
    ) {
      return;
    }

    if (error) {
      console.warn('fetchTransactions: database request failed', error.message);
      return;
    }

    if (data) {
      const normalised = data
        // Keep rows pending deletion hidden until the DB delete lands
        .filter((t: TransactionRow) => !pendingDeletes.has(String(t.id)))
        // Defence-in-depth: ensure every returned row belongs to the caller
        .filter(
          (t: TransactionRow) =>
            String(t.user_id) === callerUserId &&
            String(t.budget_id) === callerBudgetId
        )
        .map((t: TransactionRow) => normaliseRow(t));

      setTransactions(normalised);
      // Write to cache after successful fetch (account + budget isolated)
      void setCachedTransactions(callerUserId, callerBudgetId, normalised);
    }
  }, [user, budget, setTransactions]);

  useEffect(() => {
    if (!user || !budget) return;

    // DAT-05: reject mismatched ownership before any fetch
    if (budget.userId !== user.id) {
      setTransactions([]);
      return;
    }

    let cancelled = false;

    async function hydrate() {
      if (!user || !budget) return;
      const hydrateUserId = user.id;
      const hydrateBudgetId = budget.id;
      // Hydrate from IndexedDB for instant display
      const cached = await getCachedTransactions(hydrateUserId, hydrateBudgetId);
      // Verify the user/budget have not changed since we started the async read
      const state = useStore.getState();
      if (
        state.currentUser?.id !== hydrateUserId ||
        state.budget?.id !== hydrateBudgetId
      ) {
        return;
      }
      if (cached !== null && !cancelled) {
        // Filter pending deletes from cached data too
        const filtered = cached.filter((t) => !pendingDeletes.has(t.id));
        setTransactions(filtered);
      }
      if (!cancelled) {
        await fetchTransactions();
      }
    }

    void hydrate();
    return () => { cancelled = true; };
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
      const confirmed = {
        id: data.id,
        amount: Math.round(Number(data.amount) * 100) / 100,
        category: String(data.category),
        comment: data.comment ? String(data.comment).slice(0, 200) : null,
        created_at: data.created_at,
        userId: data.user_id,
        budgetId: data.budget_id,
      };
      addTx(confirmed);

      // Invalidate transaction cache so next hydration gets fresh data
      const currentTxs = useStore.getState().transactions;
      void setCachedTransactions(user.id, budget.id, currentTxs);
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

          // Invalidate cache after confirmed delete
          if (budget) {
            const currentTxs = useStore.getState().transactions;
            void setCachedTransactions(user.id, budget.id, currentTxs);
          }
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
    [deleteTx, user, budget]
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
