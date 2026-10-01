'use client';

import { motion, useSpring, useTransform } from 'motion/react';
import { useEffect, useState } from 'react';
import { NumberCounter } from '@/components/animations/NumberCounter';
import { useStore } from '@/lib/store';
import {
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

  const remaining = getRemainingAmount(budget, transactions);
  const spent = budget.amount - remaining;
  const percentage = getSpentPercentage(budget, transactions);
  const daysLeft = getDaysLeft(budget.endDate);
  const dailyBudget = calculateDailyBudget(remaining, daysLeft);
  const color = getBudgetColor(percentage);
  const symbol = getCurrencySymbol(budget.currency);

  return (
    <div className="px-5 pt-6 pb-4">
      {/* Main remaining amount */}
      <div className="text-center mb-6">
        <p className="text-[#9ca3af] text-sm font-medium mb-1">Remaining</p>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="flex items-baseline justify-center gap-1"
        >
          <span className="text-4xl font-bold text-[#9ca3af]">{symbol}</span>
          <NumberCounter
            value={remaining}
            className="text-6xl font-black text-white leading-none"
            decimals={0}
          />
        </motion.div>

        {/* Spent label */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-sm mt-2"
          style={{ color }}
        >
          {formatCurrency(spent, budget.currency)} spent of {formatCurrency(budget.amount, budget.currency)}
        </motion.p>
      </div>

      {/* Progress bar */}
      <BudgetProgress percentage={percentage} color={color} />

      {/* Stats row */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex justify-between mt-5"
      >
        <StatCard
          label="Daily budget"
          value={formatCurrency(dailyBudget, budget.currency)}
          sub="per day"
        />
        <StatCard
          label="Days left"
          value={String(daysLeft)}
          sub={daysLeft === 1 ? 'day' : 'days'}
        />
        <StatCard
          label="Today spent"
          value={formatCurrency(
            transactions
              .filter((t) => new Date(t.created_at).toDateString() === new Date().toDateString())
              .reduce((s, t) => s + t.amount, 0),
            budget.currency
          )}
          sub="today"
        />
      </motion.div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex-1 text-center">
      <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold text-white mt-0.5">{value}</p>
      <p className="text-[11px] text-[#4b5563]">{sub}</p>
    </div>
  );
}

function BudgetProgress({ percentage, color }: { percentage: number; color: string }) {
  const springWidth = useSpring(0, { stiffness: 60, damping: 18 });
  const width = useTransform(springWidth, (v) => `${v}%`);

  useEffect(() => {
    const timer = setTimeout(() => springWidth.set(percentage), 300);
    return () => clearTimeout(timer);
  }, [percentage, springWidth]);

  return (
    <div className="w-full h-3 bg-[#1a1a24] rounded-full overflow-hidden border border-[#1f1f2e]">
      <motion.div
        className="h-full rounded-full"
        style={{
          width,
          background: `linear-gradient(90deg, ${color}cc, ${color})`,
          boxShadow: `0 0 12px ${color}60`,
        }}
      />
    </div>
  );
}
