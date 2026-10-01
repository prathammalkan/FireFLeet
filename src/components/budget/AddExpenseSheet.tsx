'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Delete, CheckCircle } from 'lucide-react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { CategoryPicker } from './CategoryPicker';
import { useTransactions } from '@/hooks/useTransactions';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';

const NUMPAD_KEYS = ['1','2','3','4','5','6','7','8','9','.','0','⌫'];

const schema = z.object({
  amount: z.number().min(0.01, 'Enter an amount').max(1000000),
  category: z.string().min(1, 'Pick a category'),
  comment: z.string().max(100).optional(),
});

type FormData = z.infer<typeof schema>;

interface AddExpenseSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddExpenseSheet({ isOpen, onClose }: AddExpenseSheetProps) {
  const [display, setDisplay] = useState('0');
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('food');
  const [comment, setComment] = useState('');
  const { addTransaction } = useTransactions();
  const budget = useStore((s) => s.budget);

  const handleKey = useCallback((key: string) => {
    setDisplay((prev) => {
      if (key === '⌫') {
        const next = prev.length > 1 ? prev.slice(0, -1) : '0';
        return next;
      }
      if (key === '.' && prev.includes('.')) return prev;
      if (prev === '0' && key !== '.') return key;
      if (prev.length >= 10) return prev;
      return prev + key;
    });
  }, []);

  const amount = parseFloat(display) || 0;

  async function handleSubmit() {
    if (!amount || !budget) return;
    try {
      await addTransaction({
        amount,
        category: selectedCategory,
        comment: comment || null,
      });
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setDisplay('0');
        setComment('');
        setSelectedCategory('food');
        onClose();
      }, 1200);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Add Expense">
      <div className="px-5 pb-6 flex flex-col gap-5">
        {/* Amount Display */}
        <div className="text-center py-4">
          <motion.div
            key={display}
            initial={{ scale: 1.08 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className="text-5xl font-black text-white tracking-tight"
          >
            ₹{parseFloat(display).toLocaleString('en-IN')}
          </motion.div>
          {amount > 0 && budget && (
            <p className="text-sm text-[#9ca3af] mt-1">
              {((amount / budget.amount) * 100).toFixed(1)}% of budget
            </p>
          )}
        </div>

        {/* Category Picker */}
        <div>
          <p className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wider mb-3">Category</p>
          <CategoryPicker selected={selectedCategory} onSelect={setSelectedCategory} />
        </div>

        {/* Comment */}
        <div>
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a note (optional)"
            maxLength={80}
            className="w-full bg-[#1a1a24] border border-[#1f1f2e] rounded-2xl px-4 py-3
                       text-white placeholder:text-[#4b5563] text-sm outline-none
                       focus:border-[#f97316] focus:shadow-[0_0_0_3px_rgba(249,115,22,0.12)]
                       transition-all duration-200"
          />
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-2.5">
          {NUMPAD_KEYS.map((key) => (
            <motion.button
              key={key}
              whileTap={{ scale: 0.88, backgroundColor: 'rgba(249,115,22,0.15)' }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              onClick={() => handleKey(key)}
              className={cn(
                'h-14 rounded-2xl text-xl font-semibold',
                'bg-[#1a1a24] text-white border border-[#1f1f2e]',
                'flex items-center justify-center',
                'transition-colors duration-100',
                key === '⌫' && 'text-[#f97316]'
              )}
            >
              {key === '⌫' ? <Delete className="w-5 h-5" /> : key}
            </motion.button>
          ))}
        </div>

        {/* Submit */}
        <AnimatePresence mode="wait">
          {showSuccess ? (
            <motion.div
              key="success"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="h-14 rounded-2xl bg-[#22c55e]/20 border border-[#22c55e]/30
                         flex items-center justify-center gap-2 text-[#22c55e] font-bold"
            >
              <CheckCircle className="w-5 h-5" />
              Added!
            </motion.div>
          ) : (
            <motion.button
              key="submit"
              whileTap={{ scale: 0.97 }}
              onClick={handleSubmit}
              disabled={amount <= 0}
              className={cn(
                'h-14 rounded-2xl font-bold text-lg w-full',
                'bg-gradient-to-r from-[#f97316] to-[#ea580c] text-white',
                'shadow-lg shadow-orange-500/20',
                'transition-opacity duration-200',
                'disabled:opacity-40 disabled:cursor-not-allowed'
              )}
            >
              Add ₹{amount > 0 ? amount.toLocaleString('en-IN') : '0'}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </BottomSheet>
  );
}
