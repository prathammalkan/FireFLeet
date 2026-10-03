'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, Delete } from 'lucide-react';
import { useBudget } from '@/hooks/useBudget';
import { cn } from '@/lib/utils';
import { type Currency, type PeriodType } from '@/lib/store';

const NUMPAD = ['1','2','3','4','5','6','7','8','9','.','0','⌫'];
const CURRENCIES: { code: Currency; name: string; symbol: string }[] = [
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
];
const PERIODS: { type: PeriodType; label: string; desc: string }[] = [
  { type: 'weekly', label: 'Weekly', desc: 'Resets every 7 days' },
  { type: 'monthly', label: 'Monthly', desc: 'Resets every month' },
];
type Step = 'amount' | 'currency' | 'period';
const STEPS: Step[] = ['amount', 'currency', 'period'];

export function BudgetSetup() {
  const [step, setStep] = useState<Step>('amount');
  const [display, setDisplay] = useState('0');
  const [currency, setCurrency] = useState<Currency>('INR');
  const [period, setPeriod] = useState<PeriodType>('monthly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { createBudget } = useBudget();
  const router = useRouter();

  function handleKey(key: string) {
    setDisplay((prev) => {
      if (key === '⌫') return prev.length > 1 ? prev.slice(0, -1) : '0';
      if (key === '.' && prev.includes('.')) return prev;
      if (prev === '0' && key !== '.') return key;
      if (prev.length >= 8) return prev;
      return prev + key;
    });
  }

  async function handleCreate() {
    const amount = parseFloat(display);
    if (!amount) return;
    setLoading(true);
    setError('');
    try {
      const now = new Date();
      const endDate = new Date(now);
      if (period === 'weekly') endDate.setDate(now.getDate() + 7);
      else endDate.setMonth(now.getMonth() + 1);

      await createBudget({
        amount,
        currency,
        periodType: period,
        startDate: now.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      });
      router.replace('/');
    } catch {
      setError('Failed to create budget. Please try again.');
      setLoading(false);
    }
  }

  const stepIndex = STEPS.indexOf(step);
  const amount = parseFloat(display) || 0;
  // Find symbol of selected currency
  const sym = CURRENCIES.find((c) => c.code === currency)?.symbol ?? '₹';

  return (
    <div
      className="page-root flex flex-col px-5"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 32px)' }}
    >
      {/* Progress */}
      <div className="flex gap-2 mb-6">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className="flex-1 h-1 rounded-full transition-colors duration-300"
            style={{ background: i <= stepIndex ? '#f97316' : '#1f1f2e' }}
          />
        ))}
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
      <div className="flex-1 overflow-hidden">
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
                  {sym}{amount.toLocaleString('en-IN')}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {NUMPAD.map((key) => (
                  <button
                    key={key}
                    onPointerDown={() => handleKey(key)}
                    className="h-16 rounded-2xl bg-[#13131a] border border-[#1f1f2e] text-xl font-semibold text-white flex items-center justify-center active:bg-[#f97316]/12 active:scale-[0.93] transition-all duration-75"
                  >
                    {key === '⌫' ? <Delete className="w-5 h-5 text-[#f97316]" /> : key}
                  </button>
                ))}
              </div>
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

              {error && (
                <p className="text-[#ef4444] text-sm text-center mt-2">{error}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* CTA */}
      <div className="py-6" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))' }}>
        <button
          disabled={step === 'amount' && amount <= 0}
          onPointerDown={() => {
            if (step === 'amount') setStep('currency');
            else if (step === 'currency') setStep('period');
            else handleCreate();
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
