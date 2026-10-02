'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Plus, Flame } from 'lucide-react';
import { BudgetDisplay } from '@/components/budget/BudgetDisplay';
import { AddExpenseSheet } from '@/components/budget/AddExpenseSheet';
import { TransactionItem } from '@/components/budget/TransactionItem';
import { Navigation } from '@/components/ui/Navigation';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { OfflineBanner } from '@/components/pwa/OfflineBanner';
import { StaggerChildren, StaggerItem } from '@/components/animations/StaggerChildren';
import { useStore } from '@/lib/store';
import { groupTransactionsByDate } from '@/lib/utils';
import { useTransactions } from '@/hooks/useTransactions';
import { useBudget } from '@/hooks/useBudget';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

// Greeting based on time of day
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

  // useBudget hook handles its own fetching on mount
  useBudget();

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }
  }, []);

  // Auth-based redirect — only runs when loading is complete
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      const onboarded = localStorage.getItem('ff-onboarded');
      router.push(onboarded ? '/auth' : '/onboarding');
    }
  }, [user, authLoading, router]);

  // Show spinner while auth is resolving
  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-10 h-10 rounded-full border-2 border-[#f97316] border-t-transparent"
          />
          <p className="text-[#9ca3af] text-sm">Loading FireFleet…</p>
        </div>
      </div>
    );
  }

  // Show only last 3 date groups in "Recent" section
  const recentGroups = groupTransactionsByDate(transactions).slice(0, 3);
  const displayName = user.email?.split('@')[0] ?? 'there';

  return (
    // Bug #11: proper safe-area bottom padding
    <div
      className="min-h-screen bg-[#0a0a0f]"
      style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom) + 16px)' }}
    >
      <OfflineBanner />

      {/* Header — Bug #8: correct safe area top padding */}
      <div
        className="px-5 flex items-center justify-between"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}
      >
        <div>
          <p className="text-[#9ca3af] text-sm">Good {getGreeting()},</p>
          <h1 className="text-xl font-bold text-white capitalize">{displayName}</h1>
        </div>
        <motion.div
          className="w-10 h-10 rounded-full bg-gradient-to-br from-[#f97316] to-[#ea580c] flex items-center justify-center shadow-lg shadow-orange-500/30"
          whileTap={{ scale: 0.9 }}
        >
          <Flame className="w-5 h-5 text-white" />
        </motion.div>
      </div>

      {/* Budget display / no-budget prompt */}
      {budget ? (
        <BudgetDisplay />
      ) : (
        <NoBudgetCard onSetup={() => router.push('/setup')} />
      )}

      {/* Recent transactions */}
      <div className="px-5 mt-2">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-white">Recent</h2>
          {transactions.length > 0 && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => router.push('/history')}
              className="text-[#f97316] text-sm font-semibold"
            >
              See all →
            </motion.button>
          )}
        </div>

        {transactions.length === 0 ? (
          <EmptyState onAdd={() => setShowAdd(true)} />
        ) : (
          <StaggerChildren className="flex flex-col gap-2">
            {recentGroups.map((group) => (
              <div key={group.date}>
                <p className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wider mb-2">
                  {group.label}
                </p>
                {group.transactions.map((t) => (
                  <StaggerItem key={t.id} className="mb-2">
                    <TransactionItem
                      transaction={t}
                      currency={budget?.currency ?? 'INR'}
                      onDelete={deleteTransaction}
                    />
                  </StaggerItem>
                ))}
              </div>
            ))}
          </StaggerChildren>
        )}
      </div>

      {/* FAB — Bug #9: consistent bottom positioning with nav */}
      <motion.button
        whileTap={{ scale: 0.88 }}
        whileHover={{ scale: 1.06 }}
        onClick={() => setShowAdd(true)}
        className="fixed right-5 w-16 h-16 rounded-full bg-gradient-to-br from-[#f97316] to-[#ea580c] shadow-2xl shadow-orange-500/40 flex items-center justify-center z-30"
        style={{ bottom: 'calc(64px + env(safe-area-inset-bottom) + 20px)' }}
        aria-label="Add expense"
      >
        {/* Animated pulse ring */}
        <motion.div
          className="absolute inset-0 rounded-full bg-[#f97316]/35"
          animate={{ scale: [1, 1.55], opacity: [0.5, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
        />
        <Plus className="w-7 h-7 text-white relative z-10" strokeWidth={2.5} />
      </motion.button>

      <AddExpenseSheet isOpen={showAdd} onClose={() => setShowAdd(false)} />
      <Navigation />
      <InstallPrompt />
    </div>
  );
}

function NoBudgetCard({ onSetup }: { onSetup: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      className="mx-5 mt-6 p-6 rounded-3xl bg-gradient-to-br from-[#f97316]/10 to-[#ea580c]/5 border border-[#f97316]/20"
    >
      <p className="text-5xl mb-3">🎯</p>
      <h2 className="text-xl font-bold text-white mb-1">No budget yet</h2>
      <p className="text-[#9ca3af] text-sm mb-5">Set your spending limit to start tracking.</p>
      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={onSetup}
        className="px-6 py-3 rounded-2xl bg-gradient-to-r from-[#f97316] to-[#ea580c] text-white font-bold shadow-lg shadow-orange-500/25"
      >
        Set Budget →
      </motion.button>
    </motion.div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center py-14"
    >
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        className="text-6xl mb-4"
      >
        💸
      </motion.div>
      <p className="text-white font-semibold text-lg">Nothing logged yet</p>
      <p className="text-[#9ca3af] text-sm mt-1 mb-7">Tap + to record your first expense</p>
      <motion.button
        whileTap={{ scale: 0.94 }}
        onClick={onAdd}
        className="px-6 py-3 rounded-2xl border border-[#f97316]/40 text-[#f97316] font-semibold text-sm"
      >
        Add First Expense
      </motion.button>
    </motion.div>
  );
}
