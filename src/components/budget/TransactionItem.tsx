'use client';

import { memo, useState, useCallback, useRef } from 'react';
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
  // Swipe-to-delete state
  const [swiping, setSwiping] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const isHorizontalRef = useRef<boolean | null>(null);
  const hasVibratedRef = useRef(false);
  const SWIPE_THRESHOLD = 80;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    isHorizontalRef.current = null;
    hasVibratedRef.current = false;
    setSwiping(false);
    setSwipeX(0);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (startXRef.current === null || startYRef.current === null) return;
    const dx = e.touches[0].clientX - startXRef.current;
    const dy = e.touches[0].clientY - startYRef.current;

    // Detect gesture direction after small initial movement
    if (isHorizontalRef.current === null) {
      if (Math.hypot(dx, dy) < 8) return;
      isHorizontalRef.current = Math.abs(dx) > Math.abs(dy);
    }

    // Permit smooth vertical page scroll if user was scrolling vertically
    if (!isHorizontalRef.current) return;

    if (dx < 0) {
      setSwiping(true);
      // Clamped swipe with rubber band resistance
      const clamped = Math.max(dx, -130);
      setSwipeX(clamped);

      // Light haptic tick when crossing threshold
      if (clamped < -SWIPE_THRESHOLD && !hasVibratedRef.current) {
        hasVibratedRef.current = true;
        navigator?.vibrate?.(10);
      } else if (clamped >= -SWIPE_THRESHOLD && hasVibratedRef.current) {
        hasVibratedRef.current = false;
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (swipeX < -SWIPE_THRESHOLD) {
      navigator?.vibrate?.(15);
      onDelete(transaction.id);
    } else {
      // Snap back smoothly
      setSwiping(false);
      setSwipeX(0);
    }
    startXRef.current = null;
    startYRef.current = null;
    isHorizontalRef.current = null;
    hasVibratedRef.current = false;
  }, [swipeX, onDelete, transaction.id]);

  const isRevealed = swipeX < -SWIPE_THRESHOLD;

  return (
    <div
      className="transaction-item relative overflow-hidden rounded-2xl select-none"
      style={{ touchAction: 'pan-y' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Swipe delete background */}
      <div
        className="absolute inset-0 flex items-center justify-end pr-5 rounded-2xl transition-colors duration-150"
        style={{ background: isRevealed ? '#ef444435' : '#ef444415' }}
        aria-hidden="true"
      >
        <Trash2 className="w-5 h-5 text-[#ef4444]" />
      </div>

      {/* Card content — slides left */}
      <div
        className="flex items-center gap-3 p-4 bg-[#13131a] border border-[#1f1f2e] rounded-2xl"
        style={{
          transform: `translate3d(${swipeX}px, 0, 0)`,
          transition: swiping ? 'none' : 'transform 0.28s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        }}
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
              navigator?.vibrate?.(10);
              onDelete(transaction.id);
            }}
            className="w-10 h-10 rounded-xl bg-[#ef4444]/10 border border-[#ef4444]/20 flex items-center justify-center active:bg-[#ef4444]/25 transition-colors"
            aria-label="Delete expense"
          >
            <Trash2 className="w-4 h-4 text-[#ef4444]" />
          </button>
        </div>
      </div>
    </div>
  );
});
