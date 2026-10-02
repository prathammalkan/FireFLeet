'use client';

import { useState, useCallback } from 'react';
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

export function AddExpenseSheet({ isOpen, onClose }: AddExpenseSheetProps) {
  const [display, setDisplay] = useState('0');
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // Bug #7: prevent double-submit
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('food');
  const [comment, setComment] = useState('');
  const { addTransaction } = useTransactions();
  const budget = useStore((s) => s.budget);

  // Bug #5: full reset when sheet closes
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
    setError(null); // clear error on any input
    setDisplay((prev) => {
      if (key === '⌫') {
        return prev.length > 1 ? prev.slice(0, -1) : '0';
      }
      // Only one decimal point allowed
      if (key === '.' && prev.includes('.')) return prev;
      // Replace leading zero unless adding decimal
      if (prev === '0' && key !== '.') return key;
      // Max 10 chars (handles e.g. "99999.99")
      if (prev.length >= 10) return prev;
      return prev + key;
    });
  }, []);

  // Bug #6: parse safely — "." alone returns 0, not NaN
  const rawAmount = display === '.' ? 0 : parseFloat(display) || 0;
  // Round to 2 decimal places to prevent floating point drift in calculations
  const amount = Math.round(rawAmount * 100) / 100;

  const symbol = getCurrencySymbol(budget?.currency ?? 'INR'); // Bug #3: use budget currency

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
      setTimeout(() => {
        handleClose();
      }, 1100);
    } catch {
      setError('Failed to save. Please try again.');
      setIsSubmitting(false);
    }
  }

  // Amount as % of budget for visual hint
  const budgetPercent = budget && amount > 0
    ? Math.min(100, (amount / budget.amount) * 100)
    : 0;
  const cat = getCategoryById(selectedCategory);

  return (
    <BottomSheet isOpen={isOpen} onClose={handleClose} title="Add Expense">
      <div className="px-5 pb-6 flex flex-col gap-4">

        {/* Amount display */}
        <div className="text-center py-3 relative">
          <motion.div
            key={display}
            initial={{ scale: 1.06, opacity: 0.7 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 28 }}
            className="text-5xl font-black text-white tracking-tight"
          >
            {symbol}{amount > 0 ? amount.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '0'}
          </motion.div>

          {/* % of budget hint */}
          <AnimatePresence>
            {amount > 0 && budget && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-sm text-[#9ca3af] mt-1"
              >
                {budgetPercent.toFixed(1)}% of your budget
                {budgetPercent > 50 && ' ⚠️'}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Category picker */}
        <div>
          <p className="text-xs font-semibold text-[#9ca3af] uppercase tracking-widest mb-3">Category</p>
          <CategoryPicker selected={selectedCategory} onSelect={setSelectedCategory} />
        </div>

        {/* Comment input */}
        <input
          type="text"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={`e.g. ${cat.emoji} ${cat.name} expense`}
          maxLength={80}
          className="w-full bg-[#1a1a24] border border-[#1f1f2e] rounded-2xl px-4 py-3
                     text-white placeholder:text-[#4b5563] text-sm outline-none
                     focus:border-[#f97316] focus:shadow-[0_0_0_3px_rgba(249,115,22,0.12)]
                     transition-all duration-200"
        />

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-2">
          {NUMPAD_KEYS.map((key) => (
            <motion.button
              key={key}
              whileTap={{ scale: 0.86, backgroundColor: 'rgba(249,115,22,0.15)' }}
              transition={{ type: 'spring', stiffness: 600, damping: 32 }}
              onClick={() => handleKey(key)}
              className={cn(
                'h-14 rounded-2xl text-xl font-semibold select-none',
                'bg-[#1a1a24] border border-[#1f1f2e]',
                'flex items-center justify-center',
                key === '⌫' ? 'text-[#f97316]' : 'text-white'
              )}
            >
              {key === '⌫' ? <Delete className="w-5 h-5" /> : key}
            </motion.button>
          ))}
        </div>

        {/* Error message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-[#ef4444] text-sm bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-xl px-3 py-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit / Success button */}
        <AnimatePresence mode="wait">
          {showSuccess ? (
            <motion.div
              key="success"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              className="h-14 rounded-2xl bg-[#22c55e]/15 border border-[#22c55e]/30
                         flex items-center justify-center gap-2 text-[#22c55e] font-bold text-lg"
            >
              <CheckCircle className="w-5 h-5" />
              Added!
            </motion.div>
          ) : (
            <motion.button
              key="submit"
              whileTap={amount > 0 && !isSubmitting ? { scale: 0.97 } : {}}
              onClick={handleSubmit}
              disabled={amount <= 0 || isSubmitting} // Bug #7: disabled while submitting
              className={cn(
                'h-14 rounded-2xl font-bold text-lg w-full',
                'bg-gradient-to-r from-[#f97316] to-[#ea580c] text-white',
                'shadow-lg shadow-orange-500/20',
                'transition-opacity duration-200',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                'flex items-center justify-center gap-2'
              )}
            >
              {isSubmitting ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    className="w-5 h-5 rounded-full border-2 border-white border-t-transparent"
                  />
                  Saving…
                </>
              ) : (
                `Add ${symbol}${amount > 0 ? amount.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '0'}`
              )}
            </motion.button>
          )}
        </AnimatePresence>

      </div>
    </BottomSheet>
  );
}
