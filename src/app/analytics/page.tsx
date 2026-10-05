'use client';

import { useBudget } from '@/hooks/useBudget';
import { useTransactions } from '@/hooks/useTransactions';
import { useStore } from '@/lib/store';
import { formatCurrency, getSpentAmount, getDaysLeft } from '@/lib/utils';
import { CATEGORIES, getCategoryById } from '@/components/budget/CategoryPicker';
import { Navigation } from '@/components/ui/Navigation';
import { memo } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer,
} from 'recharts';


export default function AnalyticsPage() {
  useBudget();
  useTransactions();

  const budget = useStore((s) => s.budget);
  const transactions = useStore((s) => s.transactions);

  const spent = getSpentAmount(transactions);
  const remaining = budget ? Math.max(0, budget.amount - spent) : 0;

  // Category breakdown
  const catData = [...CATEGORIES]
    .map((cat) => ({
      id: cat.id,
      name: cat.name,
      value: transactions.filter((t) => t.category === cat.id).reduce((s, t) => s + t.amount, 0),
      color: cat.color,
      emoji: cat.emoji,
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  // 7-day daily spending
  const dailyData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const label = d.toLocaleDateString('en-IN', { weekday: 'short' });
    const total = transactions
      .filter((t) => new Date(t.created_at).toDateString() === d.toDateString())
      .reduce((s, t) => s + t.amount, 0);
    return { label, total, isToday: i === 6 };
  });

  const hasData = spent > 0;
  const biggestExpense = transactions.length
    ? transactions.reduce((max, t) => (t.amount > max.amount ? t : max), transactions[0])
    : null;
  const topCat = catData[0];
  const avgExpense = transactions.length ? spent / transactions.length : 0;
  const spentPct = budget ? Math.min(100, (spent / budget.amount) * 100) : 0;

  const navBottom = 'calc(64px + env(safe-area-inset-bottom, 0px))';

  if (!budget) {
    return (
      <div className="page-root flex flex-col items-center justify-center" style={{ paddingBottom: navBottom }}>
        <p className="text-5xl mb-4">📊</p>
        <p className="text-white font-bold text-lg">No budget set yet</p>
        <p className="text-[#9ca3af] text-sm mt-1">Set a budget to see analytics</p>
        <Navigation />
      </div>
    );
  }

  return (
    <div
      className="page-root overflow-y-auto scroll-container"
      style={{ paddingBottom: `calc(${navBottom} + 16px)` }}
    >
      {/* Header */}
      <div className="px-5" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
        <h1 className="text-xl font-black text-white">Analytics</h1>
        <p className="text-sm text-[#9ca3af] mt-0.5">
          {getDaysLeft(budget.endDate)} days left · {budget.periodType}
        </p>
      </div>

      <div className="px-5 pt-4 flex flex-col gap-4">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-3">
          <SummaryCard label="Spent" value={formatCurrency(spent, budget.currency)} color="#ef4444" emoji="💸" />
          <SummaryCard label="Remaining" value={formatCurrency(remaining, budget.currency)} color="#22c55e" emoji="🎯" />
        </div>

        {/* Budget progress */}
        <div className="bg-[#13131a] border border-[#1f1f2e] rounded-2xl p-4">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm font-bold text-white">Budget used</p>
            <p className="text-sm font-bold" style={{ color: spentPct > 90 ? '#ef4444' : '#22c55e' }}>
              {spentPct.toFixed(1)}%
            </p>
          </div>
          <div className="w-full h-3 bg-[#1a1a24] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#f97316] to-[#ea580c] transition-all duration-700"
              style={{ width: `${spentPct}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-xs text-[#9ca3af]">{formatCurrency(0, budget.currency)}</span>
            <span className="text-xs text-[#9ca3af]">{formatCurrency(budget.amount, budget.currency)}</span>
          </div>
        </div>

        {/* 7-day bar chart */}
        {hasData && (
          <div className="bg-[#13131a] border border-[#1f1f2e] rounded-2xl p-4">
            <p className="text-sm font-bold text-white mb-4">Last 7 Days</p>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={dailyData} barSize={28} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 600 }}
                />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: 'rgba(249,115,22,0.05)' }}
                  contentStyle={{ background: '#13131a', border: '1px solid #1f1f2e', borderRadius: 10, color: '#fff', fontSize: 12 }}
                  formatter={(v) => [formatCurrency(Number(v ?? 0), budget.currency), 'Spent']}
                />
                <Bar dataKey="total" radius={[5, 5, 0, 0]}>
                  {dailyData.map((entry, i) => (
                    <Cell key={i} fill={entry.isToday ? '#f97316' : entry.total > 0 ? '#1f1f2e' : '#13131a'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Category breakdown */}
        {catData.length > 0 && (
          <div className="bg-[#13131a] border border-[#1f1f2e] rounded-2xl p-4">
            <p className="text-sm font-bold text-white mb-4">By Category</p>
            <div className="flex items-center gap-4">
              <div className="shrink-0">
                <ResponsiveContainer width={110} height={110}>
                  <PieChart>
                    <Pie
                      data={catData}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={52}
                      dataKey="value"
                      strokeWidth={0}
                      paddingAngle={2}
                    >
                      {catData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 flex flex-col gap-2 min-w-0">
                {catData.slice(0, 5).map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cat.color }} />
                      <span className="text-xs text-[#9ca3af] truncate">{cat.emoji} {cat.name}</span>
                    </div>
                    <span className="text-xs font-bold text-white shrink-0">
                      {formatCurrency(cat.value, budget.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Insights */}
        {hasData && (
          <div className="flex flex-col gap-3">
            {biggestExpense && (
              <InsightCard
                emoji="💸"
                label="Biggest expense"
                value={formatCurrency(biggestExpense.amount, budget.currency)}
                sub={biggestExpense.comment || getCategoryById(biggestExpense.category).name}
              />
            )}
            {topCat && (
              <InsightCard
                emoji={topCat.emoji}
                label="Top category"
                value={topCat.name}
                sub={`${formatCurrency(topCat.value, budget.currency)} · ${budget.amount > 0 ? ((topCat.value / budget.amount) * 100).toFixed(0) : 0}% of budget`}
              />
            )}
            {transactions.length > 0 && (
              <InsightCard
                emoji="📈"
                label="Avg per expense"
                value={formatCurrency(avgExpense, budget.currency)}
                sub={`${transactions.length} total transactions`}
              />
            )}
          </div>
        )}

        {!hasData && (
          <div className="text-center py-12">
            <p className="text-5xl mb-3">📊</p>
            <p className="text-white font-semibold">No data yet</p>
            <p className="text-[#9ca3af] text-sm mt-1">Add expenses to see analytics</p>
          </div>
        )}
      </div>

      <Navigation />
    </div>
  );
}

const SummaryCard = memo(function SummaryCard({
  label, value, color, emoji,
}: { label: string; value: string; color: string; emoji: string }) {
  return (
    <div className="bg-[#13131a] border border-[#1f1f2e] rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <span>{emoji}</span>
        <p className="text-[10px] text-[#9ca3af] font-bold uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-lg font-black" style={{ color }}>{value}</p>
    </div>
  );
});

function InsightCard({ emoji, label, value, sub }: { emoji: string; label: string; value: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 bg-[#13131a] border border-[#1f1f2e] rounded-2xl p-4">
      <div className="text-2xl shrink-0">{emoji}</div>
      <div className="min-w-0">
        <p className="text-[10px] text-[#9ca3af] font-bold uppercase tracking-wider">{label}</p>
        <p className="font-bold text-white truncate">{value}</p>
        <p className="text-xs text-[#9ca3af] truncate">{sub}</p>
      </div>
    </div>
  );
}
