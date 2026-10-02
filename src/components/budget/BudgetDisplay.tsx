'use client';

import { motion, useSpring, useTransform } from 'motion/react';
import { useEffect } from 'react';
import { NumberCounter } from '@/components/animations/NumberCounter';
import { useStore } from '@/lib/store';
import {
  getSpentAmount,         // Bug #4 fix: calculate spent directly
  getRemainingAmount,
  getSpentPercentage,
  getBudgetColor,
  calculateDailyBudget,
  getDaysLeft,
  formatCurrency,
  getCurrencySymbol,
} from '@/lib/utils';

export function BudgetDisplay() {
  const budget = useStore((s) => s.budget);
  const transactions = useStore((s) => s.transactions);

  if (!budget) return null;

  const spent = getSpentAmount(transactions);           // Bug #4: direct sum, not derived from remaining
  const remaining = getRemainingAmount(budget, transactions);
  const percentage = getSpentPercentage(budget, transactions);
  const daysLeft = getDaysLeft(budget.endDate);
  const dailyBudget = calculateDailyBudget(remaining, daysLeft);
  const color = getBudgetColor(percentage);
  const symbol = getCurrencySymbol(budget.currency);

  // Today's spend — filter to budget's timezone-aware date
  const todaySpent = transactions
    .filter((t) => new Date(t.created_at).toDateString() === new Date().toDateString())
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="px-5 pt-6 pb-4">
      {/* Hero: remaining amount */}
      <div className="text-center mb-6">
        <p className="text-[#9ca3af] text-sm font-medium mb-1 tracking-wide">Remaining</p>
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="flex items-baseline justify-center gap-1"
        >
          <span className="text-3xl font-bold text-[#9ca3af]">{symbol}</span>
          <NumberCounter
            value={remaining}
            className="text-6xl font-black text-white leading-none"
            decimals={0}
          />
        </motion.div>

        {/* Spent / budget context line */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="text-sm mt-2 font-medium"
          style={{ color }}
        >
          {formatCurrency(spent, budget.currency)} spent of {formatCurrency(budget.amount, budget.currency)}
        </motion.p>
      </div>

      {/* Animated progress bar */}
      <BudgetProgressBar percentage={percentage} color={color} />

      {/* Stats row */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28 }}
        className="flex justify-between mt-5 bg-[#13131a] rounded-2xl border border-[#1f1f2e] px-2 py-3"
      >
        <StatCard
          label="Daily left"
          value={formatCurrency(dailyBudget, budget.currency)}
          sub="per day"
        />
        <div className="w-px bg-[#1f1f2e]" />
        <StatCard
          label="Days left"
          value={daysLeft === 0 ? 'Last day!' : String(daysLeft)}
          sub={daysLeft === 1 ? 'day remaining' : 'days remaining'}
          highlight={daysLeft <= 3}
        />
        <div className="w-px bg-[#1f1f2e]" />
        <StatCard
          label="Today"
          value={formatCurrency(todaySpent, budget.currency)}
          sub="spent today"
          highlight={false}
        />
      </motion.div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  highlight = false,
}: {
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex-1 text-center px-1">
      <p className="text-[9px] font-semibold text-[#9ca3af] uppercase tracking-widest">{label}</p>
      <p className={`text-base font-black mt-0.5 ${highlight ? 'text-[#ef4444]' : 'text-white'}`}>{value}</p>
      <p className="text-[10px] text-[#4b5563] mt-0.5">{sub}</p>
    </div>
  );
}

// Separate component so useSpring doesn't run in a conditional branch
function BudgetProgressBar({ percentage, color }: { percentage: number; color: string }) {
  const springWidth = useSpring(0, { stiffness: 55, damping: 18 });
  const width = useTransform(springWidth, (v) => `${v}%`);

  useEffect(() => {
    const timer = setTimeout(() => springWidth.set(percentage), 350);
    return () => clearTimeout(timer);
  }, [percentage, springWidth]);

  return (
    <div className="w-full h-3 bg-[#1a1a24] rounded-full overflow-hidden border border-[#1f1f2e]">
      <motion.div
        className="h-full rounded-full"
        style={{
          width,
          background: `linear-gradient(90deg, ${color}bb, ${color})`,
          boxShadow: `0 0 10px ${color}55`,
        }}
      />
    </div>
  );
}
