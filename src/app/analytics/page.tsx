'use client';

import { motion } from 'motion/react';
import { Navigation } from '@/components/ui/Navigation';
import { StaggerChildren, StaggerItem } from '@/components/animations/StaggerChildren';
import { useStore } from '@/lib/store';
import { formatCurrency, getSpentAmount, getDaysLeft } from '@/lib/utils';
import { CATEGORIES, getCategoryById } from '@/components/budget/CategoryPicker';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useBudget } from '@/hooks/useBudget';
import { useTransactions } from '@/hooks/useTransactions';

export default function AnalyticsPage() {
  useBudget();
  useTransactions(); // ensures data is fetched

  const budget = useStore((s) => s.budget);
  const transactions = useStore((s) => s.transactions);

  const spent = getSpentAmount(transactions);
  const remaining = budget ? Math.max(0, budget.amount - spent) : 0;

  // ── Category breakdown (Bug #14: don't mutate original with sort) ──
  const catData = [...CATEGORIES]
    .map((cat) => {
      const total = transactions
        .filter((t) => t.category === cat.id)
        .reduce((s, t) => s + t.amount, 0);
      return { id: cat.id, name: cat.name, value: total, color: cat.color, emoji: cat.emoji };
    })
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  // ── Daily spending (last 7 days) ──
  const dailyData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const label = d.toLocaleDateString('en-IN', { weekday: 'short' });
    const total = transactions
      .filter((t) => new Date(t.created_at).toDateString() === d.toDateString())
      .reduce((s, t) => s + t.amount, 0);
    return { label, total, isToday: i === 6 };
  });

  const hasAnyData = spent > 0;
  const biggestExpense = transactions.reduce(
    (max, t) => (!max || t.amount > max.amount ? t : max),
    null as typeof transactions[0] | null
  );
  const topCat = catData[0];

  if (!budget) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center pb-24">
        <p className="text-5xl mb-4">📊</p>
        <p className="text-white font-bold text-lg">No budget set yet</p>
        <p className="text-[#9ca3af] text-sm mt-1">Set a budget to see analytics</p>
        <Navigation />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]" style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom) + 16px)' }}>
      {/* Header */}
      <div
        className="px-5 pb-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}
      >
        <h1 className="text-xl font-black text-white">Analytics</h1>
        <p className="text-sm text-[#9ca3af] mt-0.5">
          {getDaysLeft(budget.endDate)} days left · {budget.periodType}
        </p>
      </div>

      <div className="px-5 flex flex-col gap-4">
        <StaggerChildren>
          {/* Summary cards */}
          <StaggerItem>
            <div className="grid grid-cols-2 gap-3">
              <SummaryCard
                label="Spent"
                value={formatCurrency(spent, budget.currency)}
                color="#ef4444"
                emoji="💸"
              />
              <SummaryCard
                label="Remaining"
                value={formatCurrency(remaining, budget.currency)}
                color="#22c55e"
                emoji="🎯"
              />
            </div>
          </StaggerItem>

          {/* Budget progress bar */}
          <StaggerItem>
            <div className="bg-[#13131a] border border-[#1f1f2e] rounded-2xl p-4">
              <div className="flex justify-between items-center mb-3">
                <p className="text-sm font-bold text-white">Budget used</p>
                <p className="text-sm font-bold" style={{ color: budget.amount > 0 && spent / budget.amount > 0.9 ? '#ef4444' : '#22c55e' }}>
                  {budget.amount > 0 ? ((spent / budget.amount) * 100).toFixed(1) : 0}%
                </p>
              </div>
              <div className="w-full h-3 bg-[#1a1a24] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, budget.amount > 0 ? (spent / budget.amount) * 100 : 0)}%` }}
                  transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
                  className="h-full rounded-full bg-gradient-to-r from-[#f97316] to-[#ea580c]"
                />
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-xs text-[#9ca3af]">{formatCurrency(0, budget.currency)}</span>
                <span className="text-xs text-[#9ca3af]">{formatCurrency(budget.amount, budget.currency)}</span>
              </div>
            </div>
          </StaggerItem>

          {/* Daily bar chart */}
          {hasAnyData && (
            <StaggerItem>
              <div className="bg-[#13131a] border border-[#1f1f2e] rounded-2xl p-4">
                <p className="text-sm font-bold text-white mb-4">7-Day Spending</p>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={dailyData} barSize={30} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 600 }}
                    />
                    <YAxis hide />
                    <Tooltip
                      cursor={{ fill: 'rgba(249,115,22,0.05)' }}
                      contentStyle={{
                        background: '#13131a',
                        border: '1px solid #1f1f2e',
                        borderRadius: 12,
                        color: '#fff',
                        fontSize: 12,
                      }}
                      formatter={(v) => [formatCurrency(Number(v ?? 0), budget.currency), 'Spent']}
                    />
                    <Bar
                      dataKey="total"
                      radius={[6, 6, 0, 0]}
                    >
                      {dailyData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.isToday ? '#f97316' : '#1f1f2e'}
                          stroke={entry.total > 0 ? '#f97316' : 'transparent'}
                          strokeWidth={entry.isToday ? 0 : entry.total > 0 ? 1 : 0}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-xs text-center text-[#4b5563] mt-1">
                  Orange = today · Outlined = past spending
                </p>
              </div>
            </StaggerItem>
          )}

          {/* Category donut */}
          {catData.length > 0 && (
            <StaggerItem>
              <div className="bg-[#13131a] border border-[#1f1f2e] rounded-2xl p-4">
                <p className="text-sm font-bold text-white mb-4">By Category</p>
                <div className="flex items-center gap-4">
                  <div className="shrink-0">
                    <ResponsiveContainer width={120} height={120}>
                      <PieChart>
                        <Pie
                          data={catData}
                          cx="50%"
                          cy="50%"
                          innerRadius={34}
                          outerRadius={56}
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
                    {catData.map((cat) => (
                      <div key={cat.id} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cat.color }} />
                          <span className="text-xs text-[#9ca3af] truncate">{cat.emoji} {cat.name}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-bold text-white">{formatCurrency(cat.value, budget.currency)}</span>
                          <span className="text-[10px] text-[#4b5563] ml-1">
                            {budget.amount > 0 ? `${((cat.value / budget.amount) * 100).toFixed(0)}%` : ''}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </StaggerItem>
          )}

          {/* Insights */}
          {hasAnyData && (
            <StaggerItem>
              <div className="flex flex-col gap-3">
                {biggestExpense && (
                  <InsightCard
                    emoji="💸"
                    label="Biggest single expense"
                    value={formatCurrency(biggestExpense.amount, budget.currency)}
                    sub={biggestExpense.comment || getCategoryById(biggestExpense.category).name}
                  />
                )}
                {topCat && (
                  <InsightCard
                    emoji={topCat.emoji}
                    label="Highest spend category"
                    value={topCat.name}
                    sub={`${formatCurrency(topCat.value, budget.currency)} · ${budget.amount > 0 ? ((topCat.value / budget.amount) * 100).toFixed(1) : 0}% of budget`}
                  />
                )}
                {transactions.length > 0 && (
                  <InsightCard
                    emoji="📈"
                    label="Average per transaction"
                    value={formatCurrency(spent / transactions.length, budget.currency)}
                    sub={`${transactions.length} transactions total`}
                  />
                )}
              </div>
            </StaggerItem>
          )}

          {!hasAnyData && (
            <StaggerItem>
              <div className="text-center py-12">
                <p className="text-5xl mb-3">📊</p>
                <p className="text-white font-semibold">No data yet</p>
                <p className="text-[#9ca3af] text-sm mt-1">Add expenses to see your analytics</p>
              </div>
            </StaggerItem>
          )}
        </StaggerChildren>
      </div>

      <Navigation />
    </div>
  );
}

function SummaryCard({ label, value, color, emoji }: { label: string; value: string; color: string; emoji: string }) {
  return (
    <div className="bg-[#13131a] border border-[#1f1f2e] rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{emoji}</span>
        <p className="text-xs text-[#9ca3af] font-semibold uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-xl font-black" style={{ color }}>{value}</p>
    </div>
  );
}

function InsightCard({ emoji, label, value, sub }: { emoji: string; label: string; value: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 bg-[#13131a] border border-[#1f1f2e] rounded-2xl p-4">
      <div className="text-2xl shrink-0">{emoji}</div>
      <div className="min-w-0">
        <p className="text-[10px] text-[#9ca3af] font-semibold uppercase tracking-wider">{label}</p>
        <p className="font-bold text-white truncate">{value}</p>
        <p className="text-xs text-[#9ca3af] truncate">{sub}</p>
      </div>
    </div>
  );
}
