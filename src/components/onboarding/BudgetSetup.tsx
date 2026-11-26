'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Delete } from 'lucide-react';
import { useBudget } from '@/hooks/useBudget';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { RateLimitError } from '@/lib/rateLimit';
import { cn, formatNumberForCurrency, toDateInputValue } from '@/lib/utils';
import { type Currency, type PeriodType } from '@/lib/store';

const NUMPAD = ['1','2','3','4','5','6','7','8','9','.','0','⌫'];
const CURRENCIES: { code: Currency; name: string; symbol: string }[] = [
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
];
const PERIODS: { type: PeriodType; label: string; desc: string }[] = [
  { type: 'weekly', label: 'Weekly', desc: 'Resets every 7 days' },
  { type: 'monthly', label: 'Monthly', desc: 'Resets every month' },
  { type: 'custom', label: 'Custom', desc: 'Choose your own end date' },
];
type Step = 'amount' | 'currency' | 'period';
const STEPS: Step[] = ['amount', 'currency', 'period'];

export function BudgetSetup() {
  const { user, loading: authLoading } = useRequireAuth();
  const [step, setStep] = useState<Step>('amount');
  const [display, setDisplay] = useState('0');
  const [currency, setCurrency] = useState<Currency>('INR');
  const [period, setPeriod] = useState<PeriodType>('monthly');
  const [customEndDate, setCustomEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return toDateInputValue(d);
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { createBudget } = useBudget();
  const router = useRouter();

  const handleKey = useCallback((key: string) => {
    navigator?.vibrate?.(8);
    setError('');
    setDisplay((prev) => {
      if (key === '⌫') return prev.length > 1 ? prev.slice(0, -1) : '0';
      if (key === '.' && prev.includes('.')) return prev;
      if (prev.includes('.')) {
        const [, dec] = prev.split('.');
        if (dec && dec.length >= 2) return prev;
      }
      if (prev === '0' && key !== '.') return key;
      if (prev.length >= 8) return prev;
      return prev + key;
    });
  }, []);

  useEffect(() => {
    if (step !== 'amount') return;
    function onKeyDown(e: KeyboardEvent) {
      if (/^[0-9.]$/.test(e.key)) {
        e.preventDefault();
        handleKey(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleKey('⌫');
      } else if (e.key === 'Enter' && (parseFloat(display) || 0) > 0) {
        e.preventDefault();
        setStep('currency');
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [step, display, handleKey]);

  if (authLoading || !user) {
    return (
      <div
        className="page-root flex flex-col px-5"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 32px)' }}
      >
        <div className="flex gap-2 mb-6">
          <div className="flex-1 h-1 rounded-full skeleton" />
          <div className="flex-1 h-1 rounded-full skeleton" />
          <div className="flex-1 h-1 rounded-full skeleton" />
        </div>
        <div className="skeleton w-48 h-8 mb-2" />
        <div className="skeleton w-64 h-4 mb-8" />
        <div className="skeleton w-40 h-16 mx-auto my-6" />
        <div className="grid grid-cols-3 gap-2.5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const sym = CURRENCIES.find((c) => c.code === currency)?.symbol ?? '₹';
  const todayStr = toDateInputValue();

  async function handleCreate() {
    if (loading) return;
    const amount = parseFloat(display);

    // DAT-03 FIX: Exhaustive client-side validation
    if (!isFinite(amount) || isNaN(amount)) { setError('Please enter a valid amount.'); return; }
    if (amount <= 0) { setError('Budget must be greater than zero.'); return; }
    if (amount > 9_999_999) { setError(`Budget cannot exceed ${sym}9,999,999.`); return; }

    const now = new Date();
    const startDate = toDateInputValue(now);
    let endDateStr: string;
    if (period === 'custom') {
      if (!customEndDate || customEndDate < startDate) {
        setError('End date must be today or later.');
        return;
      }
      endDateStr = customEndDate;
    } else {
      const endDate = new Date(now);
      if (period === 'weekly') endDate.setDate(now.getDate() + 7);
      else endDate.setMonth(now.getMonth() + 1);
      endDateStr = toDateInputValue(endDate);
    }

    setLoading(true);
    setError('');
    try {
      await createBudget({
        amount: Math.round(amount * 100) / 100, // normalize to 2dp
        currency,
        periodType: period,
        startDate,
        endDate: endDateStr,
      });
      router.replace('/');
    } catch (err: unknown) {
      if (err instanceof RateLimitError) {
        setError(err.message);
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to create budget.';
        setError(msg.includes('Invalid') ? msg : 'Failed to create budget. Please try again.');
      }
      setLoading(false);
    }
  }

  const stepIndex = STEPS.indexOf(step);
  const amount = parseFloat(display) || 0;

  return (
    <div
      className="page-root-full flex flex-col px-5"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 32px)' }}
    >
      {/* Progress */}
      <div className="flex items-center gap-3 mb-6">
        {stepIndex > 0 && (
          <button
            type="button"
            onClick={() => {
              setError('');
              setStep(STEPS[stepIndex - 1]);
            }}
            aria-label="Go back"
            className="w-8 h-8 rounded-xl bg-[#13131a] border border-[#1f1f2e] flex items-center justify-center text-[#9ca3af] shrink-0 active:opacity-70"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
        <div className="flex-1 flex gap-2">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className="flex-1 h-1 rounded-full transition-colors duration-300"
              style={{ background: i <= stepIndex ? '#f97316' : '#1f1f2e' }}
            />
          ))}
        </div>
      </div>

      {/* Title */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="mb-6"
        >
          <h1 className="text-2xl font-black text-white">
            {step === 'amount' && 'Set your budget'}
            {step === 'currency' && 'Choose currency'}
            {step === 'period' && 'Budget period'}
          </h1>
          <p className="text-[#9ca3af] mt-1 text-sm">
            {step === 'amount' && 'How much do you want to spend?'}
            {step === 'currency' && 'Which currency do you use?'}
            {step === 'period' && 'How often should it reset?'}
          </p>
        </motion.div>
      </AnimatePresence>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <AnimatePresence mode="wait">
          {step === 'amount' && (
            <motion.div
              key="amount"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.2 }}
            >
              <div className="text-center py-6">
                <p className="text-5xl font-black text-white">
                  {sym}{formatNumberForCurrency(amount, currency)}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {NUMPAD.map((key) => (
                  <button
                    type="button"
                    key={key}
                    onClick={() => handleKey(key)}
                    aria-label={key === '⌫' ? 'Backspace' : key}
                    className="h-16 rounded-2xl bg-[#13131a] border border-[#1f1f2e] text-xl font-semibold text-white flex items-center justify-center numpad-key active:bg-[#f97316]/12 active:scale-[0.93] transition-all duration-75"
                  >
                    {key === '⌫' ? <Delete className="w-5 h-5 text-[#f97316]" /> : key}
                  </button>
                ))}
              </div>
              {error && (
                <p className="text-[#ef4444] text-sm text-center mt-2">{error}</p>
              )}
            </motion.div>
          )}

          {step === 'currency' && (
            <motion.div
              key="currency"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-3"
            >
              {CURRENCIES.map((c) => (
                <button
                  type="button"
                  key={c.code}
                  onClick={() => setCurrency(c.code)}
                  className={cn(
                    'flex items-center justify-between p-4 rounded-2xl border transition-colors duration-150',
                    currency === c.code
                      ? 'bg-[#f97316]/10 border-[#f97316]/40'
                      : 'bg-[#13131a] border-[#1f1f2e] active:bg-[#1a1a24]',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold" style={{ color: currency === c.code ? '#f97316' : '#fff' }}>
                      {c.symbol}
                    </span>
                    <div className="text-left">
                      <p className="font-semibold text-white">{c.code}</p>
                      <p className="text-xs text-[#9ca3af]">{c.name}</p>
                    </div>
                  </div>
                  {currency === c.code && (
                    <div className="w-5 h-5 rounded-full bg-[#f97316] flex items-center justify-center">
                      <span className="text-[10px] text-white font-bold">✓</span>
                    </div>
                  )}
                </button>
              ))}
            </motion.div>
          )}

          {step === 'period' && (
            <motion.div
              key="period"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-3"
            >
              {PERIODS.map((p) => (
                <button
                  type="button"
                  key={p.type}
                  onClick={() => setPeriod(p.type)}
                  className={cn(
                    'flex items-center justify-between p-5 rounded-2xl border transition-colors duration-150',
                    period === p.type
                      ? 'bg-[#f97316]/10 border-[#f97316]/40'
                      : 'bg-[#13131a] border-[#1f1f2e] active:bg-[#1a1a24]',
                  )}
                >
                  <div className="text-left">
                    <p className="font-bold text-white text-lg">{p.label}</p>
                    <p className="text-sm text-[#9ca3af]">{p.desc}</p>
                  </div>
                  {period === p.type && (
                    <div className="w-6 h-6 rounded-full bg-[#f97316] flex items-center justify-center">
                      <span className="text-xs text-white font-bold">✓</span>
                    </div>
                  )}
                </button>
              ))}

              {period === 'custom' && (
                <div className="bg-[#13131a] border border-[#1f1f2e] rounded-2xl p-4 mt-1">
                  <label htmlFor="custom-end-date" className="block text-xs font-bold text-[#9ca3af] uppercase tracking-wider mb-2">
                    End Date
                  </label>
                  <input
                    id="custom-end-date"
                    type="date"
                    min={todayStr}
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full h-11 bg-[#1a1a24] border border-[#1f1f2e] rounded-xl px-3 text-white outline-none focus:border-[#f97316]"
                    style={{ fontSize: 16 }}
                  />
                </div>
              )}

              {error && (
                <p role="alert" className="text-[#ef4444] text-sm text-center mt-2">{error}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* CTA */}
      <div className="py-6" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))' }}>
        <button
          type="button"
          disabled={(step === 'amount' && amount <= 0) || loading}
          onClick={() => {
            if (step === 'amount') setStep('currency');
            else if (step === 'currency') setStep('period');
            else void handleCreate();
          }}
          className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#f97316] to-[#ea580c] text-white font-bold text-lg flex items-center justify-center gap-2 active:opacity-80 transition-opacity disabled:opacity-40"
        >
          {step === 'period' ? (loading ? 'Creating…' : 'Create Budget') : 'Continue'}
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
