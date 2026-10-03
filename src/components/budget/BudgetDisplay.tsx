'use client';

import { memo, useState } from 'react';
import { motion, useSpring, useTransform } from 'motion/react';
import { useEffect } from 'react';
import { Plus } from 'lucide-react';
import { NumberCounter } from '@/components/animations/NumberCounter';
import { AddToBudgetSheet } from '@/components/budget/AddToBudgetSheet';
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
  const [showTopUp, setShowTopUp] = useState(false);

  if (!budget) return null;

  const spent = getSpentAmount(transactions);
  const remaining = getRemainingAmount(budget, transactions);
  const percentage = getSpentPercentage(budget, transactions);
  const daysLeft = getDaysLeft(budget.endDate);
  const dailyBudget = calculateDailyBudget(remaining, daysLeft);
  const color = getBudgetColor(percentage);
  const symbol = getCurrencySymbol(budget.currency);
  const isLow = percentage >= 75;

  const todaySpent = transactions
    .filter((t) => new Date(t.created_at).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10))
    .reduce((s, t) => s + t.amount, 0);

  return (
    <div className="px-5 pt-5 pb-3">
      {/* Remaining hero */}
      <div className="text-center mb-4">
        <p className="text-[#9ca3af] text-[11px] font-bold uppercase tracking-widest mb-1">Remaining</p>
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-2xl font-bold text-[#9ca3af]">{symbol}</span>
          <NumberCounter
            value={remaining}
            className="text-[56px] font-black text-white leading-none tracking-tight"
            decimals={0}
          />
        </div>
        <p className="text-sm mt-1 font-semibold" style={{ color }}>
          {formatCurrency(spent, budget.currency)} spent
          {isLow && (
            <span className="ml-2 text-xs font-bold text-[#eab308]">
              · {percentage.toFixed(0)}% used
            </span>
          )}
        </p>
      </div>

      {/* Progress bar */}
      <BudgetProgressBar percentage={percentage} color={color} />

      {/* Stats row */}
      <div className="flex justify-between mt-3 bg-[#13131a] rounded-2xl border border-[#1f1f2e] px-2 py-3">
        <StatCard
          label="Daily left"
          value={formatCurrency(dailyBudget, budget.currency)}
          sub="per day"
        />
        <div className="w-px bg-[#1f1f2e]" />
        <StatCard
          label="Days left"
          value={daysLeft === 0 ? 'Last!' : String(daysLeft)}
          sub="remaining"
          warn={daysLeft <= 3}
        />
        <div className="w-px bg-[#1f1f2e]" />
        <StatCard
          label="Today"
          value={formatCurrency(todaySpent, budget.currency)}
          sub="spent"
        />
      </div>

      {/* Top-up button — shown when budget is getting low (>75%) */}
      {isLow && (
        <button
          onClick={() => setShowTopUp(true)}
          className="mt-3 w-full h-10 rounded-xl border border-[#22c55e]/30 bg-[#22c55e]/8 text-[#22c55e] text-sm font-bold flex items-center justify-center gap-1.5 active:bg-[#22c55e]/15 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add to Budget
        </button>
      )}

      <AddToBudgetSheet isOpen={showTopUp} onClose={() => setShowTopUp(false)} />
    </div>
  );
});

function StatCard({
  label, value, sub, warn = false,
}: { label: string; value: string; sub: string; warn?: boolean }) {
  return (
    <div className="flex-1 text-center px-1">
      <p className="text-[9px] font-bold text-[#9ca3af] uppercase tracking-widest leading-none">{label}</p>
      <p className={`text-sm font-black mt-1 leading-none ${warn ? 'text-[#ef4444]' : 'text-white'}`}>
        {value}
      </p>
      <p className="text-[10px] text-[#4b5563] mt-0.5">{sub}</p>
    </div>
  );
}

function BudgetProgressBar({ percentage, color }: { percentage: number; color: string }) {
  const springWidth = useSpring(0, { stiffness: 60, damping: 20 });
  const width = useTransform(springWidth, (v) => `${Math.min(100, v)}%`);

  useEffect(() => {
    const t = setTimeout(() => springWidth.set(percentage), 150);
    return () => clearTimeout(t);
  }, [percentage, springWidth]);

  return (
    <div className="w-full h-2.5 bg-[#1a1a24] rounded-full overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{
          width,
          background: `linear-gradient(90deg, ${color}80, ${color})`,
        }}
      />
    </div>
  );
}
