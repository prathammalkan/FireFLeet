'use client';

import { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Flame, TrendingUp, Wallet } from 'lucide-react';
import { BudgetDisplay } from '@/components/budget/BudgetDisplay';
import { TransactionItem } from '@/components/budget/TransactionItem';
import { Navigation } from '@/components/ui/Navigation';
import { OfflineBanner } from '@/components/pwa/OfflineBanner';
import { useStore } from '@/lib/store';
import { groupTransactionsByDate, formatCurrency } from '@/lib/utils';
import { useTransactions } from '@/hooks/useTransactions';
import { useBudget } from '@/hooks/useBudget';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

import dynamic from 'next/dynamic';
const AddExpenseSheet = dynamic(
  () => import('@/components/budget/AddExpenseSheet').then((m) => ({ default: m.AddExpenseSheet })),
  { ssr: false }
);
const AddToBudgetSheet = dynamic(
  () => import('@/components/budget/AddToBudgetSheet').then((m) => ({ default: m.AddToBudgetSheet })),
  { ssr: false }
);
const InstallPrompt = dynamic(
  () => import('@/components/pwa/InstallPrompt').then((m) => ({ default: m.InstallPrompt })),
  { ssr: false }
);

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function SearchParamsHandler({ onAddAction }: { onAddAction: () => void }) {
  const searchParams = useSearchParams();
  const budget = useStore((s) => s.budget);
  useEffect(() => {
    if (searchParams?.get('action') === 'add' && budget) {
      onAddAction();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budget?.id]);
  return null;
}

function UndoToast({
  message,
  onUndo,
  onDismiss,
}: {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    timerRef.current = setTimeout(onDismiss, 5000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.18 }}
      className="fixed left-4 right-4 z-[60] flex items-center justify-between gap-3 bg-[#1a1a24] border border-[#1f1f2e] rounded-2xl px-4 py-3 shadow-xl"
      style={{ bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}
    >
      <span className="text-white text-sm font-medium">{message}</span>
      <button
        onClick={onUndo}
        className="text-[#f97316] text-sm font-bold shrink-0 active:opacity-70"
      >
        Undo
      </button>
    </motion.div>
  );
}

function HomeContent() {
  const [showAdd, setShowAdd] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const fabRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { user, loading: authLoading } = useAuth();
  const budget = useStore((s) => s.budget);
  const transactions = useStore((s) => s.transactions);
  const { deleteTransaction, restoreTransaction, deleteError, clearDeleteError } = useTransactions();
  useBudget();

  // Register SW once
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration('/sw.js').then((reg) => {
        if (!reg) navigator.serviceWorker.register('/sw.js').catch(() => {});
      }).catch(() => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
    }
  }, []);

  // Auth redirect
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      const onboarded = localStorage.getItem('ff-onboarded');
      router.replace(onboarded ? '/auth' : '/onboarding');
    }
  }, [user, authLoading, router]);

  // Close FAB on outside tap
  useEffect(() => {
    if (!fabOpen) return;
    function handleClick(e: MouseEvent) {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) setFabOpen(false);
    }
    document.addEventListener('pointerdown', handleClick);
    return () => document.removeEventListener('pointerdown', handleClick);
  }, [fabOpen]);

  const openAdd = useCallback(() => { setFabOpen(false); setShowAdd(true); }, []);
  const closeAdd = useCallback(() => setShowAdd(false), []);
  const openTopUp = useCallback(() => { setFabOpen(false); setShowTopUp(true); }, []);
  const closeTopUp = useCallback(() => setShowTopUp(false), []);

  const handleDelete = useCallback((id: string) => {
    navigator?.vibrate?.(10);
    deleteTransaction(id);
    const timer = setTimeout(() => { setPendingDelete(null); }, 5000);
    setPendingDelete({ id, timer });
  }, [deleteTransaction]);

  const handleUndo = useCallback(() => {
    if (pendingDelete) {
      clearTimeout(pendingDelete.timer);
      restoreTransaction(pendingDelete.id);
      setPendingDelete(null);
    }
  }, [pendingDelete, restoreTransaction]);

  const dismissUndo = useCallback(() => { setPendingDelete(null); }, []);

  // Loading skeleton
  if (authLoading || !user) {
    return (
      <div className="page-root">
        <div
          className="px-5 flex items-center justify-between"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
        >
          <div className="flex flex-col gap-2">
            <div className="skeleton w-20 h-3" />
            <div className="skeleton w-32 h-6" />
          </div>
          <div className="skeleton w-11 h-11 rounded-2xl" />
        </div>
        <div className="px-5 pt-5 pb-3">
          <div className="text-center mb-4">
            <div className="skeleton w-16 h-3 mx-auto mb-2" />
            <div className="skeleton w-48 h-14 mx-auto mb-2" />
            <div className="skeleton w-32 h-4 mx-auto" />
          </div>
          <div className="skeleton w-full h-2.5 rounded-full mb-3" />
          <div className="skeleton w-full h-16 rounded-2xl" />
        </div>
        <div className="px-5 mt-1 flex flex-col gap-2">
          <div className="skeleton w-24 h-4 mb-1" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton w-full h-[72px] rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const recentGroups = groupTransactionsByDate(transactions).slice(0, 3);
  const displayName = (user.email?.split('@')[0] ?? 'there').slice(0, 18);
  const navBottomPx = 'calc(64px + env(safe-area-inset-bottom, 0px))';

  return (
    <div className="page-root">
      <Suspense fallback={null}>
        <SearchParamsHandler onAddAction={openAdd} />
      </Suspense>

      <OfflineBanner />

      {/* Header */}
      <div
        className="px-5 flex items-center justify-between"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
      >
        <div>
          <p className="text-[#9ca3af] text-sm leading-none mb-0.5">Good {getGreeting()},</p>
          <h1 className="text-2xl font-black text-white capitalize leading-none">{displayName}</h1>
        </div>
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#f97316] to-[#ea580c] flex items-center justify-center shadow-lg shadow-orange-500/20">
          <Flame className="w-6 h-6 text-white" />
        </div>
      </div>

      {/* Budget */}
      {budget ? <BudgetDisplay /> : <NoBudgetCard onSetup={() => router.push('/setup')} />}

      {/* Recent transactions */}
      <div className="px-5 mt-1 pb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-white text-base">Recent</h2>
          {transactions.length > 0 && (
            <Link
              href="/history"
              className="text-[#f97316] text-sm font-semibold active:opacity-60 transition-opacity"
            >
              See all →
            </Link>
          )}
        </div>

        {transactions.length === 0 ? (
          <EmptyState onAdd={openAdd} />
        ) : (
          <div className="flex flex-col gap-2">
            {recentGroups.map((group) => (
              <div key={group.date}>
                <p className="text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider mb-2">
                  {group.label}
                  <span className="ml-2 font-semibold normal-case text-[#6b7280]">
                    · {formatCurrency(group.total, budget?.currency ?? 'INR')}
                  </span>
                </p>
                {group.transactions.map((t) => (
                  <div key={t.id} className="mb-2">
                    <TransactionItem
                      transaction={t}
                      currency={budget?.currency ?? 'INR'}
                      onDelete={handleDelete}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Undo toast */}
      <AnimatePresence>
        {pendingDelete && (
          <UndoToast
            message="Expense deleted"
            onUndo={handleUndo}
            onDismiss={dismissUndo}
          />
        )}
      </AnimatePresence>

      {deleteError && (
        <div
          role="alert"
          className="fixed left-4 right-4 z-[60] flex items-center justify-between gap-3 bg-[#3a1515] border border-[#ef4444]/30 rounded-2xl px-4 py-3 shadow-xl text-[#fecaca] text-sm"
          style={{ bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}
        >
          <span>{deleteError}</span>
          <button onClick={clearDeleteError} className="font-bold text-white shrink-0">Dismiss</button>
        </div>
      )}

      {/* Expandable FAB */}
      <div
        ref={fabRef}
        className="fixed right-5 z-30 flex flex-col-reverse items-end gap-3"
        style={{ bottom: `calc(${navBottomPx} + 20px)` }}
        role="group"
        aria-label="Quick actions"
      >
        <AnimatePresence>
          {fabOpen && (
            <>
              <motion.div
                key="topup"
                initial={{ opacity: 0, y: 10, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.85 }}
                transition={{ duration: 0.13, delay: 0.04 }}
                className="flex items-center gap-2"
              >
                <span className="bg-[#13131a] border border-[#1f1f2e] text-white text-xs font-semibold px-3 py-1.5 rounded-xl shadow-lg">
                  Top-up Budget
                </span>
                <button
                  onClick={openTopUp}
                  className="w-12 h-12 rounded-full bg-[#22c55e] flex items-center justify-center shadow-lg shadow-green-500/25 active:scale-90 transition-transform gpu"
                  aria-label="Add to budget"
                >
                  <Wallet className="w-5 h-5 text-white" />
                </button>
              </motion.div>

              <motion.div
                key="expense"
                initial={{ opacity: 0, y: 10, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.85 }}
                transition={{ duration: 0.13 }}
                className="flex items-center gap-2"
              >
                <span className="bg-[#13131a] border border-[#1f1f2e] text-white text-xs font-semibold px-3 py-1.5 rounded-xl shadow-lg">
                  Add Expense
                </span>
                <button
                  onClick={openAdd}
                  className="w-12 h-12 rounded-full bg-[#f97316] flex items-center justify-center shadow-lg shadow-orange-500/25 active:scale-90 transition-transform gpu"
                  aria-label="Add expense"
                >
                  <TrendingUp className="w-5 h-5 text-white" />
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <button
          onClick={() => setFabOpen((v) => !v)}
          className="w-16 h-16 rounded-full bg-gradient-to-br from-[#f97316] to-[#ea580c] flex items-center justify-center shadow-xl shadow-orange-500/30 active:scale-90 transition-transform duration-100 gpu relative"
          aria-label={fabOpen ? 'Close actions' : 'Open actions'}
          aria-expanded={fabOpen}
        >
          {!fabOpen && <span className="animate-pulse-ring" />}
          <motion.div
            animate={{ rotate: fabOpen ? 45 : 0 }}
            transition={{ duration: 0.13 }}
          >
            <Plus className="w-7 h-7 text-white relative z-10" strokeWidth={2.5} />
          </motion.div>
        </button>
      </div>

      <AddExpenseSheet isOpen={showAdd} onClose={closeAdd} />
      <AddToBudgetSheet isOpen={showTopUp} onClose={closeTopUp} />
      <Navigation />
      <InstallPrompt />
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="page-root flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-[#f97316] border-t-transparent animate-spin-slow" />
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}

function NoBudgetCard({ onSetup }: { onSetup: () => void }) {
  return (
    <div className="mx-5 mt-6 p-6 rounded-3xl bg-gradient-to-br from-[#f97316]/10 to-[#ea580c]/5 border border-[#f97316]/20 animate-fade-slide-up">
      <p className="text-5xl mb-3">🎯</p>
      <h2 className="text-xl font-bold text-white mb-1">No budget yet</h2>
      <p className="text-[#9ca3af] text-sm mb-5">Set your spending limit to start tracking.</p>
      <button
        onClick={onSetup}
        className="px-6 py-3 rounded-2xl bg-gradient-to-r from-[#f97316] to-[#ea580c] text-white font-bold active:opacity-80 transition-opacity"
      >
        Set Budget →
      </button>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="text-center py-12 animate-fade-slide-up">
      <div className="text-5xl mb-4 inline-block">💸</div>
      <p className="text-white font-semibold text-lg">Nothing logged yet</p>
      <p className="text-[#9ca3af] text-sm mt-1 mb-6">Tap + to record your first expense</p>
      <button
        onClick={onAdd}
        className="px-6 py-3 rounded-2xl border border-[#f97316]/40 text-[#f97316] font-semibold text-sm active:opacity-70 transition-opacity"
      >
        Add First Expense
      </button>
    </div>
  );
}
