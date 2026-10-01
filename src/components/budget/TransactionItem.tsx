'use client';

import { motion, PanInfo, useMotionValue, useTransform } from 'motion/react';
import { Trash2 } from 'lucide-react';
import { getCategoryById } from './CategoryPicker';
import { formatCurrency, formatTime } from '@/lib/utils';
import { type Transaction, type Currency } from '@/lib/store';

interface TransactionItemProps {
  transaction: Transaction;
  currency: Currency;
  onDelete: (id: string) => void;
}

export function TransactionItem({ transaction, currency, onDelete }: TransactionItemProps) {
  const x = useMotionValue(0);
  const deleteOpacity = useTransform(x, [-100, -60], [1, 0]);
  const deleteScale = useTransform(x, [-100, -40], [1, 0.8]);
  const bgOpacity = useTransform(x, [0, -80], [0, 1]);

  const cat = getCategoryById(transaction.category);

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x < -80) {
      onDelete(transaction.id);
    } else {
      x.set(0);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Delete background */}
      <motion.div
        className="absolute inset-0 flex items-center justify-end pr-5 rounded-2xl bg-[#ef4444]/15"
        style={{ opacity: bgOpacity }}
      >
        <motion.div style={{ opacity: deleteOpacity, scale: deleteScale }}>
          <Trash2 className="w-5 h-5 text-[#ef4444]" />
        </motion.div>
      </motion.div>

      {/* Transaction card */}
      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: -110, right: 0 }}
        dragElastic={{ left: 0.1, right: 0 }}
        onDragEnd={handleDragEnd}
        className="relative flex items-center gap-3 p-4 bg-[#13131a] border border-[#1f1f2e] rounded-2xl cursor-grab active:cursor-grabbing"
        whileTap={{ scale: 0.99 }}
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

        {/* Amount */}
        <div className="text-right shrink-0">
          <p className="font-bold text-white">
            -{formatCurrency(transaction.amount, currency)}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
