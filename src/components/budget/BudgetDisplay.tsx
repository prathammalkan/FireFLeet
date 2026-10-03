'use client';

import { memo } from 'react';
import { motion, useSpring, useTransform } from 'motion/react';
import { useEffect } from 'react';
import { NumberCounter } from '@/components/animations/NumberCounter';
import { useStore } from '@/lib/store';
import {
  getSpentAmount,
  getRemainingAmount,
  getSpentPercentage,
  getBudgetColor,
  calculateDailyBudget,
  getDaysLeft,
  formatCurrency,
  getCurrencySymbol,
} from '@/lib/utils';

export const BudgetDisplay = memo(function BudgetDisplay() {
  const budget = useStore((s) => s.budget);
  const transactions = useStore((s) => s.transactions);

  if (!budget) return null;

  const spent = getSpentAmount(transactions);
  const remaining = getRemainingAmount(budget, transactions);
  const percentage = getSpentPercentage(budget, transactions);
  const daysLeft = getDaysLeft(budget.endDate);
  const dailyBudget = calculateDailyBudget(remaining, daysLeft);
  const color = getBudgetColor(percentage);
  const symbol = getCurrencySymbol(budget.currency);

  const todaySpent = transactions
    .filter((t) => new Date(t.created_at).toDateString() === new Date().toDateString())
    .reduce((s, t) => s + t.amount, 0);

  return (
    <div className="px-5 pt-5 pb-4">
      {/* Remaining */}
      <div className="text-center mb-5">
        <p className="text-[#9ca3af] text-xs font-semibold uppercase tracking-widest mb-1">Remaining</p>
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-3xl font-bold text-[#9ca3af]">{symbol}</span>
          <NumberCounter
            value={remaining}
            className="text-6xl font-black text-white leading-none"
            decimals={0}
          />
        </div>
        <p className="text-sm mt-1.5 font-medium" style={{ color }}>
          {formatCurrency(spent, budget.currency)} spent of {formatCurrency(budget.amount, budget.currency)}
        </p>
      </div>

      {/* Progress bar */}
      <BudgetProgressBar percentage={percentage} color={color} />

      {/* Stats */}
      <div className="flex justify-between mt-4 bg-[#13131a] rounded-2xl border border-[#1f1f2e] px-2 py-3">
        <StatCard label="Daily left" value={formatCurrency(dailyBudget, budget.currency)} sub="per day" />
        <div className="w-px bg-[#1f1f2e]" />
        <StatCard
          label="Days left"
          value={daysLeft === 0 ? 'Last!' : String(daysLeft)}
          sub="remaining"
          warn={daysLeft <= 3}
        />
        <div className="w-px bg-[#1f1f2e]" />
        <StatCard label="Today" value={formatCurrency(todaySpent, budget.currency)} sub="spent" />
      </div>
    </div>
  );
});

function StatCard({
  label, value, sub, warn = false,
}: { label: string; value: string; sub: string; warn?: boolean }) {
  return (
    <div className="flex-1 text-center px-1">
      <p className="text-[9px] font-bold text-[#9ca3af] uppercase tracking-widest">{label}</p>
      <p className={`text-sm font-black mt-0.5 ${warn ? 'text-[#ef4444]' : 'text-white'}`}>{value}</p>
      <p className="text-[10px] text-[#4b5563] mt-0.5">{sub}</p>
    </div>
  );
}

function BudgetProgressBar({ percentage, color }: { percentage: number; color: string }) {
  const springWidth = useSpring(0, { stiffness: 80, damping: 20 });
  const width = useTransform(springWidth, (v) => `${Math.min(100, v)}%`);

  useEffect(() => {
    const t = setTimeout(() => springWidth.set(percentage), 200);
    return () => clearTimeout(t);
  }, [percentage, springWidth]);

  return (
    <div className="w-full h-3 bg-[#1a1a24] rounded-full overflow-hidden border border-[#1f1f2e]">
      <motion.div
        className="h-full rounded-full"
        style={{
          width,
          background: `linear-gradient(90deg, ${color}99, ${color})`,
        }}
      />
    </div>
  );
}
