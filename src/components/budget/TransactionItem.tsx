'use client';

import { memo } from 'react';
import { getCategoryById } from './CategoryPicker';
import { formatCurrency, formatTime } from '@/lib/utils';
import { type Transaction, type Currency } from '@/lib/store';
import { Trash2 } from 'lucide-react';

interface TransactionItemProps {
  transaction: Transaction;
  currency: Currency;
  onDelete: (id: string) => void;
}

// memo prevents re-render when parent re-renders for unrelated reasons
export const TransactionItem = memo(function TransactionItem({
  transaction,
  currency,
  onDelete,
}: TransactionItemProps) {
  const cat = getCategoryById(transaction.category);

  // No motion drag on list items — too expensive with many items.
  // Use a simple CSS-class swipe instead via a touch approach,
  // OR keep a lightweight tap-to-confirm delete (no drag physics).
  // For now: tap the trash icon to delete. Prevents lag with 20+ items.

  return (
    <div
      className="transaction-item flex items-center gap-3 p-4 bg-[#13131a] border border-[#1f1f2e] rounded-2xl"
    >
      {/* Category icon */}
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
        style={{ background: `${cat.color}20`, border: `1px solid ${cat.color}30` }}
      >
        {cat.emoji}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white text-sm truncate">
          {transaction.comment || cat.name}
        </p>
        <p className="text-[11px] text-[#9ca3af] mt-0.5">
          {cat.name} · {formatTime(transaction.created_at)}
        </p>
      </div>

      {/* Amount + delete */}
      <div className="flex items-center gap-3 shrink-0">
        <p className="font-bold text-white">
          -{formatCurrency(transaction.amount, currency)}
        </p>
        <button
          onClick={() => {
            if (confirm('Delete this expense?')) {
              navigator?.vibrate?.(10);
              onDelete(transaction.id);
            }
          }}
          className="w-10 h-10 rounded-xl bg-[#ef4444]/10 border border-[#ef4444]/20 flex items-center justify-center active:bg-[#ef4444]/25 transition-colors"
          aria-label="Delete expense"
        >
          <Trash2 className="w-4 h-4 text-[#ef4444]" />
        </button>
      </div>
    </div>
  );
});
