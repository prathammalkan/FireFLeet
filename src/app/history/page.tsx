'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, X } from 'lucide-react';
import { Navigation } from '@/components/ui/Navigation';
import { TransactionItem } from '@/components/budget/TransactionItem';
import { useStore } from '@/lib/store';
import { useTransactions } from '@/hooks/useTransactions';
import { useBudget } from '@/hooks/useBudget';
import { groupTransactionsByDate, formatCurrency } from '@/lib/utils';
import { CATEGORIES } from '@/components/budget/CategoryPicker';

export default function HistoryPage() {
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const transactions = useStore((s) => s.transactions);
  const budget = useStore((s) => s.budget);
  const { deleteTransaction } = useTransactions();
  useBudget();

  const filtered = transactions.filter((t) => {
    const matchSearch = search
      ? t.comment?.toLowerCase().includes(search.toLowerCase()) ||
        t.category.toLowerCase().includes(search.toLowerCase())
      : true;
    const matchCat = filterCat ? t.category === filterCat : true;
    return matchSearch && matchCat;
  });

  const groups = groupTransactionsByDate(filtered);
  const total = filtered.reduce((s, t) => s + t.amount, 0);

  const navBottom = 'calc(64px + env(safe-area-inset-bottom, 0px))';

  return (
    <div
      className="page-root overflow-y-auto scroll-container"
      style={{ paddingBottom: `calc(${navBottom} + 16px)` }}
    >
      {/* Sticky header — no backdrop-blur, solid bg */}
      <div
        className="sticky-header px-5 pb-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-black text-white">History</h1>
          <button
            onClick={() => {
              setSearchOpen((v) => !v);
              if (searchOpen) setSearch('');
            }}
            aria-label={searchOpen ? 'Close search' : 'Search expenses'}
            className="w-9 h-9 rounded-xl bg-[#13131a] border border-[#1f1f2e] flex items-center justify-center text-[#9ca3af] active:bg-[#1a1a24] transition-colors"
          >
            {searchOpen ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
          </button>
        </div>

        {/* Search */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden mb-3"
            >
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
                <input
                  autoFocus
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search expenses…"
                  className="w-full h-10 bg-[#13131a] border border-[#1f1f2e] rounded-xl pl-10 pr-4 text-white placeholder:text-[#4b5563] outline-none focus:border-[#f97316] transition-colors"
                  style={{ fontSize: 16 }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Category filters — horizontal scroll, pure CSS buttons */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => setFilterCat(null)}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              !filterCat ? 'bg-[#f97316] text-white' : 'bg-[#13131a] text-[#9ca3af] border border-[#1f1f2e]'
            }`}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterCat(filterCat === cat.id ? null : cat.id)}
              className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1"
              style={
                filterCat === cat.id
                  ? { background: cat.color + '22', border: `1px solid ${cat.color}50`, color: '#fff' }
                  : { background: '#13131a', border: '1px solid #1f1f2e', color: '#9ca3af' }
              }
            >
              {cat.emoji} {cat.name}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 pt-4">
        {filtered.length > 0 && (
          <div className="mb-4 p-4 rounded-2xl bg-[#13131a] border border-[#1f1f2e]">
            <p className="text-xs text-[#9ca3af] font-semibold uppercase tracking-wider">
              {filtered.length} transaction{filtered.length !== 1 ? 's' : ''}
            </p>
            <p className="text-xl font-bold text-white mt-0.5">
              {formatCurrency(total, budget?.currency ?? 'INR')} total
            </p>
          </div>
        )}

        {groups.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-white font-semibold">No transactions found</p>
            <p className="text-[#9ca3af] text-sm mt-1">Try a different search or filter</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {groups.map((group) => (
              <div key={group.date}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wider">{group.label}</p>
                  <p className="text-xs text-[#9ca3af]">
                    {formatCurrency(group.total, budget?.currency ?? 'INR')}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {group.transactions.map((t) => (
                    <TransactionItem
                      key={t.id}
                      transaction={t}
                      currency={budget?.currency ?? 'INR'}
                      onDelete={deleteTransaction}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Navigation />
    </div>
  );
}
