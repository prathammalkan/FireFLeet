'use client';

import { useState, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Delete, CheckCircle, AlertCircle, Plus, Wallet } from 'lucide-react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useStore } from '@/lib/store';
import { useBudget } from '@/hooks/useBudget';
import { validateAmount, getCurrencySymbol, formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';

const NUMPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];
const QUICK_AMOUNTS = [500, 1000, 2000, 5000];

interface AddToBudgetSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddToBudgetSheet = memo(function AddToBudgetSheet({
  isOpen,
  onClose,
}: AddToBudgetSheetProps) {
  const [display, setDisplay] = useState('0');
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const budget = useStore((s) => s.budget);
  const { updateBudgetAmount } = useBudget();

  const symbol = getCurrencySymbol(budget?.currency ?? 'INR');
  const addAmount = Math.round((parseFloat(display) || 0) * 100) / 100;
  const newTotal = budget ? Math.round((budget.amount + addAmount) * 100) / 100 : addAmount;

  function handleClose() {
    setDisplay('0');
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

  async function handleSubmit() {
    if (!budget || isSubmitting) return;
    const err = validateAmount(addAmount);
    if (err) { setError(err); return; }
    if (newTotal > 9_999_999) { setError('New total would exceed the maximum allowed amount.'); return; }

    setIsSubmitting(true);
    setError(null);

    try {
      await updateBudgetAmount(newTotal);
      setShowSuccess(true);
      setTimeout(handleClose, 900);
    } catch (e) {
      setError('Could not update budget. Please try again.');
      setIsSubmitting(false);
    }
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={handleClose} title="Top-up Budget">
      <div className="px-5 pb-4 flex flex-col gap-4">

        {/* Context */}
        {budget && (
          <div className="flex items-center justify-between bg-[#1a1a24] rounded-2xl px-4 py-3 border border-[#1f1f2e]">
            <div>
              <p className="text-[10px] text-[#9ca3af] font-bold uppercase tracking-widest">Current</p>
              <p className="text-white font-black text-lg">{formatCurrency(budget.amount, budget.currency)}</p>
            </div>
            {addAmount > 0 && (
              <div className="text-right">
                <p className="text-[10px] text-[#9ca3af] font-bold uppercase tracking-widest">After</p>
                <p className="font-black text-lg text-[#22c55e]">
                  {formatCurrency(newTotal, budget.currency)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Amount display */}
        <div className="text-center pt-1">
          <p className="text-[10px] text-[#9ca3af] font-bold uppercase tracking-widest mb-1">Adding</p>
          <div className="text-5xl font-black text-white tracking-tight">
            {symbol}{addAmount > 0
              ? addAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })
              : '0'}
          </div>
        </div>

        {/* Quick amounts */}
        <div className="flex gap-2">
          {QUICK_AMOUNTS.map((qa) => (
            <button
              key={qa}
              onPointerDown={() => { setError(null); setDisplay(String(qa)); }}
              className={cn(
                'flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors duration-100',
                addAmount === qa
                  ? 'bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/40'
                  : 'bg-[#1a1a24] text-[#9ca3af] border border-[#1f1f2e] active:bg-[#22c55e]/10',
              )}
            >
              +{symbol}{qa >= 1000 ? `${qa / 1000}k` : qa}
            </button>
          ))}
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-2">
          {NUMPAD_KEYS.map((key) => (
            <button
              key={key}
              onPointerDown={() => handleKey(key)}
              className={cn(
                'h-14 rounded-2xl text-xl font-semibold select-none',
                'bg-[#1a1a24] border border-[#1f1f2e] flex items-center justify-center',
                'active:bg-[#22c55e]/15 active:scale-[0.94] transition-all duration-75',
                key === '⌫' ? 'text-[#22c55e]' : 'text-white',
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

        {/* Submit */}
        <AnimatePresence mode="wait">
          {showSuccess ? (
            <motion.div
              key="ok"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.18 }}
              className="h-14 rounded-2xl bg-[#22c55e]/15 border border-[#22c55e]/30 flex items-center justify-center gap-2 text-[#22c55e] font-bold"
            >
              <CheckCircle className="w-5 h-5" />
              Budget Updated!
            </motion.div>
          ) : (
            <button
              key="submit"
              onPointerDown={handleSubmit}
              disabled={addAmount <= 0 || isSubmitting}
              className="h-14 rounded-2xl font-bold text-lg w-full bg-gradient-to-r from-[#22c55e] to-[#16a34a] text-white active:opacity-80 transition-opacity flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin-slow" />
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  Add {addAmount > 0 ? formatCurrency(addAmount, budget?.currency ?? 'INR') : 'to Budget'}
                </>
              )}
            </button>
          )}
        </AnimatePresence>
      </div>
    </BottomSheet>
  );
});
