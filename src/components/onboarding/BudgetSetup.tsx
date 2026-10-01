'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, Delete } from 'lucide-react';
import { useStore } from '@/lib/store';
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

export function BudgetSetup() {
  const [step, setStep] = useState<Step>('amount');
  const [display, setDisplay] = useState('0');
  const [currency, setCurrency] = useState<Currency>('INR');
  const [period, setPeriod] = useState<PeriodType>('monthly');
  const [loading, setLoading] = useState(false);
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
      router.push('/');
    } catch {
      setLoading(false);
    }
  }

  const STEPS: Step[] = ['amount', 'currency', 'period'];
  const stepIndex = STEPS.indexOf(step);

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col px-5 pt-safe">
      {/* Header */}
      <div className="pt-8 pb-6">
        <div className="flex gap-2 mb-6">
          {STEPS.map((s, i) => (
            <motion.div
              key={s}
              animate={{ backgroundColor: i <= stepIndex ? '#f97316' : '#1f1f2e' }}
              className="flex-1 h-1 rounded-full"
              transition={{ duration: 0.3 }}
            />
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
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
      </div>

      {/* Step content */}
      <div className="flex-1">
        <AnimatePresence mode="wait">
          {step === 'amount' && (
            <motion.div key="amount" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
              <div className="text-center py-8">
                <p className="text-5xl font-black text-white">
                  ₹{parseFloat(display).toLocaleString('en-IN')}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {NUMPAD.map((key) => (
                  <motion.button
                    key={key}
                    whileTap={{ scale: 0.88, backgroundColor: 'rgba(249,115,22,0.15)' }}
                    onClick={() => handleKey(key)}
                    className="h-16 rounded-2xl bg-[#13131a] border border-[#1f1f2e] text-xl font-semibold text-white flex items-center justify-center"
                  >
                    {key === '⌫' ? <Delete className="w-5 h-5 text-[#f97316]" /> : key}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 'currency' && (
            <motion.div key="currency" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="flex flex-col gap-3">
              {CURRENCIES.map((c) => (
                <motion.button
                  key={c.code}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setCurrency(c.code)}
                  className={cn(
                    'flex items-center justify-between p-4 rounded-2xl border',
                    'transition-all duration-200',
                    currency === c.code
                      ? 'bg-[#f97316]/10 border-[#f97316]/40'
                      : 'bg-[#13131a] border-[#1f1f2e]'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold" style={{ color: currency === c.code ? '#f97316' : '#fff' }}>{c.symbol}</span>
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
                </motion.button>
              ))}
            </motion.div>
          )}

          {step === 'period' && (
            <motion.div key="period" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="flex flex-col gap-3">
              {PERIODS.map((p) => (
                <motion.button
                  key={p.type}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setPeriod(p.type)}
                  className={cn(
                    'flex items-center justify-between p-5 rounded-2xl border',
                    period === p.type ? 'bg-[#f97316]/10 border-[#f97316]/40' : 'bg-[#13131a] border-[#1f1f2e]'
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
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* CTA */}
      <div className="py-6 pb-safe">
        <motion.button
          whileTap={{ scale: 0.97 }}
          disabled={step === 'amount' && parseFloat(display) <= 0}
          onClick={() => {
            if (step === 'amount') setStep('currency');
            else if (step === 'currency') setStep('period');
            else handleCreate();
          }}
          className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#f97316] to-[#ea580c] text-white font-bold text-lg shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 disabled:opacity-40"
        >
          {step === 'period' ? (loading ? 'Creating...' : 'Create Budget') : 'Continue'}
          <ChevronRight className="w-5 h-5" />
        </motion.button>
      </div>
    </div>
  );
}
