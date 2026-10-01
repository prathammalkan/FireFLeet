'use client';

import { motion } from 'motion/react';
import { Navigation } from '@/components/ui/Navigation';
import { StaggerChildren, StaggerItem } from '@/components/animations/StaggerChildren';
import { useStore } from '@/lib/store';
import { formatCurrency, getSpentAmount, getDaysLeft } from '@/lib/utils';
import { CATEGORIES, getCategoryById } from '@/components/budget/CategoryPicker';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer,
} from 'recharts';

export default function AnalyticsPage() {
  const budget = useStore((s) => s.budget);
  const transactions = useStore((s) => s.transactions);

  const spent = getSpentAmount(transactions);
  const remaining = budget ? Math.max(0, budget.amount - spent) : 0;

  // Category breakdown
  const catData = CATEGORIES.map((cat) => {
    const total = transactions
      .filter((t) => t.category === cat.id)
      .reduce((s, t) => s + t.amount, 0);
    return { name: cat.name, value: total, color: cat.color, emoji: cat.emoji };
  }).filter((d) => d.value > 0);

  // Daily spending (last 7 days)
  const dailyData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const label = d.toLocaleDateString('en-IN', { weekday: 'short' });
    const total = transactions
      .filter((t) => new Date(t.created_at).toDateString() === d.toDateString())
      .reduce((s, t) => s + t.amount, 0);
    return { label, total };
  });

  const biggestExpense = transactions.reduce((max, t) => (!max || t.amount > max.amount ? t : max), null as typeof transactions[0] | null);
  const mostFreqCat = catData.sort((a, b) => b.value - a.value)[0];

  return (
    <div className="min-h-screen bg-[#0a0a0f] pb-24">
      <div className="pt-safe px-5 pt-4 pb-3">
        <h1 className="text-xl font-black text-white">Analytics</h1>
        {budget && (
          <p className="text-sm text-[#9ca3af] mt-0.5">
            {getDaysLeft(budget.endDate)} days left in period
          </p>
        )}
      </div>

      <div className="px-5 flex flex-col gap-4">
        <StaggerChildren>
          {/* Summary cards */}
          <StaggerItem>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#13131a] border border-[#1f1f2e] rounded-2xl p-4">
                <p className="text-xs text-[#9ca3af] font-semibold uppercase tracking-wider">Spent</p>
                <p className="text-2xl font-black text-[#ef4444] mt-1">
                  {formatCurrency(spent, budget?.currency ?? 'INR')}
                </p>
              </div>
              <div className="bg-[#13131a] border border-[#1f1f2e] rounded-2xl p-4">
                <p className="text-xs text-[#9ca3af] font-semibold uppercase tracking-wider">Remaining</p>
                <p className="text-2xl font-black text-[#22c55e] mt-1">
                  {formatCurrency(remaining, budget?.currency ?? 'INR')}
                </p>
              </div>
            </div>
          </StaggerItem>

          {/* Daily bar chart */}
          {dailyData.some((d) => d.total > 0) && (
            <StaggerItem>
              <div className="bg-[#13131a] border border-[#1f1f2e] rounded-2xl p-4">
                <p className="text-sm font-bold text-white mb-4">Daily Spending</p>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={dailyData} barSize={28}>
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#9ca3af', fontSize: 11 }}
                    />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{ background: '#13131a', border: '1px solid #1f1f2e', borderRadius: 12, color: '#fff', fontSize: 12 }}
                    formatter={(v) => [formatCurrency(Number(v ?? 0), budget?.currency ?? 'INR'), 'Spent']}
                    />
                    <Bar dataKey="total" fill="#f97316" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </StaggerItem>
          )}

          {/* Category donut */}
          {catData.length > 0 && (
            <StaggerItem>
              <div className="bg-[#13131a] border border-[#1f1f2e] rounded-2xl p-4">
                <p className="text-sm font-bold text-white mb-4">By Category</p>
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={130} height={130}>
                    <PieChart>
                      <Pie
                        data={catData}
                        cx="50%"
                        cy="50%"
                        innerRadius={38}
                        outerRadius={58}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {catData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 flex flex-col gap-2">
                    {catData.map((cat) => (
                      <div key={cat.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: cat.color }} />
                          <span className="text-xs text-[#9ca3af]">{cat.name}</span>
                        </div>
                        <span className="text-xs font-semibold text-white">
                          {formatCurrency(cat.value, budget?.currency ?? 'INR')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </StaggerItem>
          )}

          {/* Insights */}
          {(biggestExpense || mostFreqCat) && (
            <StaggerItem>
              <div className="flex flex-col gap-3">
                {biggestExpense && (
                  <InsightCard
                    emoji="💸"
                    label="Biggest expense"
                    value={formatCurrency(biggestExpense.amount, budget?.currency ?? 'INR')}
                    sub={biggestExpense.comment || getCategoryById(biggestExpense.category).name}
                  />
                )}
                {mostFreqCat && (
                  <InsightCard
                    emoji={mostFreqCat.emoji}
                    label="Most spent on"
                    value={mostFreqCat.name}
                    sub={formatCurrency(mostFreqCat.value, budget?.currency ?? 'INR')}
                  />
                )}
              </div>
            </StaggerItem>
          )}
        </StaggerChildren>
      </div>

      <Navigation />
    </div>
  );
}

function InsightCard({ emoji, label, value, sub }: { emoji: string; label: string; value: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 bg-[#13131a] border border-[#1f1f2e] rounded-2xl p-4">
      <div className="text-2xl">{emoji}</div>
      <div>
        <p className="text-xs text-[#9ca3af] font-semibold uppercase tracking-wider">{label}</p>
        <p className="font-bold text-white">{value}</p>
        <p className="text-xs text-[#9ca3af]">{sub}</p>
      </div>
    </div>
  );
}
