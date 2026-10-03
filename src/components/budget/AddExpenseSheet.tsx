'use client';

import { useState, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Delete, CheckCircle, AlertCircle } from 'lucide-react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { CategoryPicker } from './CategoryPicker';
import { getCategoryById } from './CategoryPicker';
import { useTransactions } from '@/hooks/useTransactions';
import { useStore } from '@/lib/store';
import { cn, getCurrencySymbol } from '@/lib/utils';

const NUMPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

interface AddExpenseSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddExpenseSheet = memo(function AddExpenseSheet({
  isOpen,
  onClose,
}: AddExpenseSheetProps) {
  const [display, setDisplay] = useState('0');
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('food');
  const [comment, setComment] = useState('');
  const { addTransaction } = useTransactions();
  const budget = useStore((s) => s.budget);

  function handleClose() {
    setDisplay('0');
    setComment('');
    setSelectedCategory('food');
    setError(null);
    setShowSuccess(false);
    setIsSubmitting(false);
    onClose();
  }

  const handleKey = useCallback((key: string) => {
    setError(null);
    setDisplay((prev) => {
      if (key === '⌫') return prev.length > 1 ? prev.slice(0, -1) : '0';
      if (key === '.' && prev.includes('.')) return prev;
      if (prev === '0' && key !== '.') return key;
      if (prev.length >= 9) return prev;
      return prev + key;
    });
  }, []);

  const amount = Math.round((display === '.' ? 0 : parseFloat(display) || 0) * 100) / 100;
  const symbol = getCurrencySymbol(budget?.currency ?? 'INR');
  const cat = getCategoryById(selectedCategory);

  async function handleSubmit() {
    if (amount <= 0 || !budget || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await addTransaction({
        amount,
        category: selectedCategory,
        comment: comment.trim() || null,
      });
      setShowSuccess(true);
      setTimeout(handleClose, 900);
    } catch {
      setError('Could not save. Please try again.');
      setIsSubmitting(false);
    }
  }

  const budgetPct = budget && amount > 0
    ? Math.min(100, (amount / budget.amount) * 100)
    : 0;

  return (
    <BottomSheet isOpen={isOpen} onClose={handleClose} title="Add Expense">
      <div className="px-5 pb-4 flex flex-col gap-4">

        {/* Amount display */}
        <div className="text-center pt-3">
          <div className="text-5xl font-black text-white tracking-tight">
            {symbol}{amount > 0
              ? amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })
              : '0'}
          </div>
          {amount > 0 && budget && (
            <p className="text-sm text-[#9ca3af] mt-1">
              {budgetPct.toFixed(1)}% of budget
              {budgetPct > 50 ? ' ⚠️' : ''}
            </p>
          )}
        </div>

        {/* Category picker */}
        <div>
          <p className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-widest mb-3">Category</p>
          <CategoryPicker selected={selectedCategory} onSelect={setSelectedCategory} />
        </div>

        {/* Comment */}
        <input
          type="text"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={`${cat.emoji} Add a note…`}
          maxLength={80}
          className="w-full bg-[#1a1a24] border border-[#1f1f2e] rounded-2xl px-4 py-3
                     text-white placeholder:text-[#4b5563] outline-none
                     focus:border-[#f97316] transition-colors duration-150"
          style={{ fontSize: 16 }}
        />

        {/* Numpad — plain buttons, CSS tap feedback */}
        <div className="grid grid-cols-3 gap-2">
          {NUMPAD_KEYS.map((key) => (
            <button
              key={key}
              onPointerDown={() => handleKey(key)}  // pointerDown = faster than onClick on mobile
              className={cn(
                'h-14 rounded-2xl text-xl font-semibold select-none',
                'bg-[#1a1a24] border border-[#1f1f2e]',
                'flex items-center justify-center',
                'active:bg-[#f97316]/15 active:scale-[0.94] transition-all duration-75',
                key === '⌫' ? 'text-[#f97316]' : 'text-white',
              )}
            >
              {key === '⌫' ? <Delete className="w-5 h-5" /> : key}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-[#ef4444] text-sm bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-xl px-3 py-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Submit / Success */}
        <AnimatePresence mode="wait">
          {showSuccess ? (
            <motion.div
              key="ok"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="h-14 rounded-2xl bg-[#22c55e]/15 border border-[#22c55e]/30
                         flex items-center justify-center gap-2 text-[#22c55e] font-bold"
            >
              <CheckCircle className="w-5 h-5" />
              Added!
            </motion.div>
          ) : (
            <button
              key="submit"
              onPointerDown={handleSubmit}
              disabled={amount <= 0 || isSubmitting}
              className={cn(
                'h-14 rounded-2xl font-bold text-lg w-full',
                'bg-gradient-to-r from-[#f97316] to-[#ea580c] text-white',
                'active:opacity-80 transition-opacity duration-100',
                'flex items-center justify-center gap-2',
                'disabled:opacity-40 disabled:cursor-not-allowed',
              )}
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin-slow" />
                  Saving…
                </>
              ) : (
                `Add ${symbol}${amount > 0
                  ? amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })
                  : '0'}`
              )}
            </button>
          )}
        </AnimatePresence>
      </div>
    </BottomSheet>
  );
});
