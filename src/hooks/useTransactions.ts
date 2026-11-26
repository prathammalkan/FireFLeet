'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import { pendingDeleteTimers, pendingDeletes } from '@/lib/pendingDeletes';
import { useAuth } from './useAuth';
import { generateId, validateAmount } from '@/lib/utils';
import { getCachedTransactions, setCachedTransactions } from '@/lib/cache';
import {
  assertMutationAllowed,
  dedupeInFlight,
  markFetched,
  shouldRevalidate,
} from '@/lib/rateLimit';
import { CATEGORIES } from '@/components/budget/CategoryPicker';

// Stable module-level singleton — no re-instantiation on render
const supabase = getSupabaseBrowserClient();

const VALID_CATEGORY_IDS = new Set<string>(CATEGORIES.map((c) => c.id));
const TX_REVALIDATE_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes (matches cache TTL)

function normalizeCategory(raw: unknown): string {
  const val = String(raw || 'other').slice(0, 50);
  return VALID_CATEGORY_IDS.has(val) ? val : 'other';
}

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
  const updateTx = useStore((s) => s.updateTransaction);
  const setTransactions = useStore((s) => s.setTransactions);

  const normaliseRow = (t: TransactionRow) => {
    const amount = Number(t.amount);
    return {
      id: String(t.id),
      amount: isFinite(amount) ? amount : 0,
      category: normalizeCategory(t.category),
      comment: t.comment ? String(t.comment).slice(0, 200) : null,
      created_at: String(t.created_at),
      userId: String(t.user_id),
      budgetId: String(t.budget_id),
    };
  };

  const fetchTransactions = useCallback(async (force = false) => {
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
    const fetchKey = `tx:${callerUserId}:${callerBudgetId}`;

    if (!force && !shouldRevalidate(fetchKey, TX_REVALIDATE_COOLDOWN_MS)) {
      return;
    }

    await dedupeInFlight(fetchKey, async () => {
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
        markFetched(fetchKey);
        // Write to cache after successful fetch (account + budget isolated)
        void setCachedTransactions(callerUserId, callerBudgetId, normalised);
      }
    });
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
      const fetchKey = `tx:${hydrateUserId}:${hydrateBudgetId}`;

      // If we already fetched recently in-memory and store already holds matching budget txs, skip work
      if (!shouldRevalidate(fetchKey, TX_REVALIDATE_COOLDOWN_MS)) {
        const inMemory = useStore.getState().transactions;
        if (inMemory.length > 0 && inMemory[0]?.budgetId === hydrateBudgetId) {
          return;
        }
      }

      // Hydrate from IndexedDB for instant display
      const cached = await getCachedTransactions(hydrateUserId, hydrateBudgetId);
      // Verify the user/budget have not changed since we started the async read
      const state = useStore.getState();
      if (
        state.currentUser?.id !== hydrateUserId ||
        state.budget?.id !== hydrateBudgetId ||
        cancelled
      ) {
        return;
      }
      if (cached !== null) {
        // Filter pending deletes from cached data too
        const filtered = cached.filter((t) => !pendingDeletes.has(t.id));
        setTransactions(filtered);
        markFetched(fetchKey);
        return; // Device cache is fresh — zero server load on tab navigation
      }
      await fetchTransactions(true);
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
      if (budget.userId !== user.id) throw new Error('Budget ownership mismatch');
      assertMutationAllowed(`tx-write:${user.id}`);

      const amountError = validateAmount(amount);
      if (amountError) throw new Error(amountError);

      const safeCategory = normalizeCategory(category);
      const safeComment = comment ? String(comment).trim().slice(0, 200) : null;
      const safeAmount = Math.round(amount * 100) / 100;
      const callerUserId = user.id;
      const callerBudgetId = budget.id;

      // Optimistic update
      const tempId = generateId();
      const optimistic = {
        id: tempId,
        amount: safeAmount,
        category: safeCategory,
        comment: safeComment,
        created_at: new Date().toISOString(),
        userId: callerUserId,
        budgetId: callerBudgetId,
      };
      addTx(optimistic);

      // Haptic feedback
      if (typeof navigator !== 'undefined') navigator.vibrate?.(10);

      const { data, error } = await supabase
        .from('transactions')
        .insert({
          user_id: callerUserId,
          budget_id: callerBudgetId,
          amount: safeAmount,
          category: safeCategory,
          comment: safeComment,
        })
        .select('id, amount, category, comment, created_at, user_id, budget_id')
        .single();

      // Guard against sign-out or budget switch while insert was in flight
      const postState = useStore.getState();
      if (
        postState.currentUser?.id !== callerUserId ||
        postState.budget?.id !== callerBudgetId
      ) {
        return;
      }

      if (error) {
        deleteTx(tempId);
        throw error;
      }

      // Update temp entry in-place with server record so list position stays rock-solid
      const confirmed = {
        id: data.id,
        amount: Math.round(Number(data.amount) * 100) / 100,
        category: normalizeCategory(data.category),
        comment: data.comment ? String(data.comment).slice(0, 200) : null,
        created_at: data.created_at,
        userId: data.user_id,
        budgetId: data.budget_id,
      };
      updateTx(tempId, confirmed);

      // Sync updated list to device cache
      const currentTxs = useStore.getState().transactions;
      markFetched(`tx:${callerUserId}:${callerBudgetId}`);
      void setCachedTransactions(callerUserId, callerBudgetId, currentTxs);
    },
    [user, budget, addTx, deleteTx, updateTx]
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
      assertMutationAllowed(`tx-write:${user.id}`);

      const callerUserId = user.id;
      const callerBudgetId = budget?.id ?? tx.budgetId;

      const previousTimer = pendingDeleteTimers.get(safeId);
      if (previousTimer) clearTimeout(previousTimer);
      pendingDeletes.set(safeId, tx);
      setDeleteError(null);

      // Remove from UI immediately
      deleteTx(safeId);

      // Schedule permanent DB delete after 5.5s
      const timer = setTimeout(async () => {
        if (!pendingDeletes.has(safeId)) return; // already restored or flushed
        pendingDeletes.delete(safeId);
        pendingDeleteTimers.delete(safeId);

        if (useStore.getState().currentUser?.id !== callerUserId) return;

        try {
          const { error } = await supabase
            .from('transactions')
            .delete()
            .eq('id', safeId)
            .eq('user_id', callerUserId);
          if (error) throw error;

          if (useStore.getState().currentUser?.id !== callerUserId) return;

          // Update device cache after confirmed delete
          if (callerBudgetId) {
            const currentTxs = useStore.getState().transactions;
            void setCachedTransactions(callerUserId, callerBudgetId, currentTxs);
          }
        } catch (e) {
          console.warn('deleteTransaction: DB delete threw', e);
          if (useStore.getState().currentUser?.id !== callerUserId) return;
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
