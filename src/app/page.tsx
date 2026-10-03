'use client';

export const dynamic = 'force-dynamic';

import { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Flame, TrendingUp, Wallet } from 'lucide-react';
import { BudgetDisplay } from '@/components/budget/BudgetDisplay';
import { AddExpenseSheet } from '@/components/budget/AddExpenseSheet';
import { AddToBudgetSheet } from '@/components/budget/AddToBudgetSheet';
import { TransactionItem } from '@/components/budget/TransactionItem';
import { Navigation } from '@/components/ui/Navigation';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { OfflineBanner } from '@/components/pwa/OfflineBanner';
import { useStore } from '@/lib/store';
import { groupTransactionsByDate, formatCurrency } from '@/lib/utils';
import { useTransactions } from '@/hooks/useTransactions';
import { useBudget } from '@/hooks/useBudget';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

// SearchParams must be in a Suspense boundary — isolated component
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

function HomeContent() {
  const [showAdd, setShowAdd] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const fabRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { user, loading: authLoading } = useAuth();
  const budget = useStore((s) => s.budget);
  const transactions = useStore((s) => s.transactions);
  const { deleteTransaction } = useTransactions();
  useBudget();

  // Register SW once, non-blocking
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
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

  // Close FAB menu on outside click
  useEffect(() => {
    if (!fabOpen) return;
    function handleClick(e: MouseEvent) {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) {
        setFabOpen(false);
      }
    }
    document.addEventListener('pointerdown', handleClick);
    return () => document.removeEventListener('pointerdown', handleClick);
  }, [fabOpen]);

  const openAdd = useCallback(() => { setFabOpen(false); setShowAdd(true); }, []);
  const closeAdd = useCallback(() => setShowAdd(false), []);
  const openTopUp = useCallback(() => { setFabOpen(false); setShowTopUp(true); }, []);
  const closeTopUp = useCallback(() => setShowTopUp(false), []);

  if (authLoading || !user) {
    return (
      <div className="page-root flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-[#f97316] border-t-transparent animate-spin-slow" />
          <p className="text-[#9ca3af] text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  const recentGroups = groupTransactionsByDate(transactions).slice(0, 3);
  const displayName = (user.email?.split('@')[0] ?? 'there').slice(0, 18);
  const navBottom = 'calc(64px + env(safe-area-inset-bottom, 0px))';

  return (
    <div
      className="page-root overflow-y-auto scroll-container"
      style={{ paddingBottom: `calc(${navBottom} + 80px)` }}
    >
      {/* Suspense-wrapped search params handler (for PWA shortcut ?action=add) */}
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
      {budget ? (
        <BudgetDisplay />
      ) : (
        <NoBudgetCard onSetup={() => router.push('/setup')} />
      )}

      {/* Recent transactions */}
      <div className="px-5 mt-1">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-white text-base">Recent</h2>
          {transactions.length > 0 && (
            <button
              onClick={() => router.push('/history')}
              className="text-[#f97316] text-sm font-semibold active:opacity-60 transition-opacity"
            >
              See all →
            </button>
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
                      onDelete={deleteTransaction}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Expandable FAB ─────────────────────────────────────────────── */}
      <div
        ref={fabRef}
        className="fixed right-5 z-30 flex flex-col-reverse items-end gap-3"
        style={{ bottom: `calc(${navBottom} + 20px)` }}
      >
        <AnimatePresence>
          {fabOpen && (
            <>
              {/* Top-up budget */}
              <motion.div
                key="topup"
                initial={{ opacity: 0, y: 10, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.85 }}
                transition={{ duration: 0.15, delay: 0.05 }}
                className="flex items-center gap-2"
              >
                <span className="bg-[#13131a] border border-[#1f1f2e] text-white text-xs font-semibold px-3 py-1.5 rounded-xl shadow-lg">
                  Top-up Budget
                </span>
                <button
                  onPointerDown={openTopUp}
                  className="w-12 h-12 rounded-full bg-[#22c55e] flex items-center justify-center shadow-lg shadow-green-500/25 active:scale-90 transition-transform gpu"
                  aria-label="Add to budget"
                >
                  <Wallet className="w-5 h-5 text-white" />
                </button>
              </motion.div>

              {/* Add expense */}
              <motion.div
                key="expense"
                initial={{ opacity: 0, y: 10, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.85 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-2"
              >
                <span className="bg-[#13131a] border border-[#1f1f2e] text-white text-xs font-semibold px-3 py-1.5 rounded-xl shadow-lg">
                  Add Expense
                </span>
                <button
                  onPointerDown={openAdd}
                  className="w-12 h-12 rounded-full bg-[#f97316] flex items-center justify-center shadow-lg shadow-orange-500/25 active:scale-90 transition-transform gpu"
                  aria-label="Add expense"
                >
                  <TrendingUp className="w-5 h-5 text-white" />
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Main FAB */}
        <button
          onPointerDown={() => setFabOpen((v) => !v)}
          className="w-16 h-16 rounded-full bg-gradient-to-br from-[#f97316] to-[#ea580c] flex items-center justify-center shadow-xl shadow-orange-500/30 active:scale-90 transition-transform duration-100 gpu relative"
          aria-label={fabOpen ? 'Close actions' : 'Open actions'}
        >
          {!fabOpen && <span className="animate-pulse-ring" />}
          <motion.div
            animate={{ rotate: fabOpen ? 45 : 0 }}
            transition={{ duration: 0.15 }}
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
    <Suspense fallback={null}>
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
      <div className="text-5xl mb-4 animate-float inline-block">💸</div>
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
