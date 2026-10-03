'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { Plus, Flame } from 'lucide-react';
import { BudgetDisplay } from '@/components/budget/BudgetDisplay';
import { AddExpenseSheet } from '@/components/budget/AddExpenseSheet';
import { TransactionItem } from '@/components/budget/TransactionItem';
import { Navigation } from '@/components/ui/Navigation';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { OfflineBanner } from '@/components/pwa/OfflineBanner';
import { useStore } from '@/lib/store';
import { groupTransactionsByDate } from '@/lib/utils';
import { useTransactions } from '@/hooks/useTransactions';
import { useBudget } from '@/hooks/useBudget';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

export default function HomePage() {
  const [showAdd, setShowAdd] = useState(false);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const budget = useStore((s) => s.budget);
  const transactions = useStore((s) => s.transactions);
  const { deleteTransaction } = useTransactions();

  useBudget();

  // Register SW once
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      const onboarded = localStorage.getItem('ff-onboarded');
      router.replace(onboarded ? '/auth' : '/onboarding'); // replace not push = no back-nav to loading
    }
  }, [user, authLoading, router]);

  const openAdd = useCallback(() => setShowAdd(true), []);
  const closeAdd = useCallback(() => setShowAdd(false), []);

  if (authLoading || !user) {
    return (
      <div className="page-root flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 rounded-full border-2 border-[#f97316] border-t-transparent animate-spin-slow" />
          <p className="text-[#9ca3af] text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  const recentGroups = groupTransactionsByDate(transactions).slice(0, 3);
  const displayName = (user.email?.split('@')[0] ?? 'there').slice(0, 18);

  // Navigation height + safe area bottom
  const navBottom = 'calc(64px + env(safe-area-inset-bottom, 0px))';

  return (
    <div
      className="page-root overflow-y-auto scroll-container"
      style={{ paddingBottom: `calc(${navBottom} + 16px)` }}
    >
      <OfflineBanner />

      {/* Header */}
      <div
        className="px-5 flex items-center justify-between"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
      >
        <div>
          <p className="text-[#9ca3af] text-sm">Good {getGreeting()},</p>
          <h1 className="text-xl font-bold text-white capitalize">{displayName}</h1>
        </div>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#f97316] to-[#ea580c] flex items-center justify-center">
          <Flame className="w-5 h-5 text-white" />
        </div>
      </div>

      {/* Budget */}
      {budget ? <BudgetDisplay /> : <NoBudgetCard onSetup={() => router.push('/setup')} />}

      {/* Recent */}
      <div className="px-5 mt-2">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-white">Recent</h2>
          {transactions.length > 0 && (
            <button
              onClick={() => router.push('/history')}
              className="text-[#f97316] text-sm font-semibold active:opacity-70"
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
                <p className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wider mb-2">
                  {group.label}
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

      {/* FAB — CSS pulse ring, no JS animation on the ring */}
      <button
        onClick={openAdd}
        className="fixed right-5 w-16 h-16 rounded-full bg-gradient-to-br from-[#f97316] to-[#ea580c] flex items-center justify-center z-30 active:scale-90 transition-transform duration-100 gpu"
        style={{ bottom: `calc(${navBottom} + 20px)` }}
        aria-label="Add expense"
      >
        <span className="animate-pulse-ring" />
        <Plus className="w-7 h-7 text-white relative z-10" strokeWidth={2.5} />
      </button>

      <AddExpenseSheet isOpen={showAdd} onClose={closeAdd} />
      <Navigation />
      <InstallPrompt />
    </div>
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
    <div className="text-center py-14 animate-fade-slide-up">
      <div className="text-6xl mb-4 animate-float inline-block">💸</div>
      <p className="text-white font-semibold text-lg">Nothing logged yet</p>
      <p className="text-[#9ca3af] text-sm mt-1 mb-7">Tap + to record your first expense</p>
      <button
        onClick={onAdd}
        className="px-6 py-3 rounded-2xl border border-[#f97316]/40 text-[#f97316] font-semibold text-sm active:opacity-70 transition-opacity"
      >
        Add First Expense
      </button>
    </div>
  );
}
