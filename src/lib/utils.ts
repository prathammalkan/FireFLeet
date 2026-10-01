import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { type Transaction, type Budget, type Currency } from './store';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Currency Formatting ─────────────────────────────────────────────────────

const CURRENCY_CONFIG: Record<Currency, { locale: string; symbol: string }> = {
  INR: { locale: 'en-IN', symbol: '₹' },
  USD: { locale: 'en-US', symbol: '$' },
  EUR: { locale: 'de-DE', symbol: '€' },
  GBP: { locale: 'en-GB', symbol: '£' },
  JPY: { locale: 'ja-JP', symbol: '¥' },
  AUD: { locale: 'en-AU', symbol: 'A$' },
  CAD: { locale: 'en-CA', symbol: 'C$' },
};

export function formatCurrency(amount: number, currency: Currency = 'INR'): string {
  const { locale } = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.INR;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getCurrencySymbol(currency: Currency = 'INR'): string {
  return CURRENCY_CONFIG[currency]?.symbol || '₹';
}

// ─── Date Utilities ───────────────────────────────────────────────────────────

export function getDaysLeft(endDate: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  const diff = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

export function isToday(date: string | Date): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
}

export function isYesterday(date: string | Date): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear()
  );
}

export function getRelativeDate(date: string | Date): string {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return formatDate(date);
}

// ─── Budget Calculations ──────────────────────────────────────────────────────

export function getSpentAmount(transactions: Transaction[]): number {
  return transactions.reduce((sum, t) => sum + t.amount, 0);
}

export function getRemainingAmount(budget: Budget, transactions: Transaction[]): number {
  const spent = getSpentAmount(transactions);
  return Math.max(0, budget.amount - spent);
}

export function getSpentPercentage(budget: Budget, transactions: Transaction[]): number {
  if (!budget.amount) return 0;
  const spent = getSpentAmount(transactions);
  return Math.min(100, (spent / budget.amount) * 100);
}

export function calculateDailyBudget(remaining: number, daysLeft: number): number {
  if (daysLeft <= 0) return 0;
  return remaining / daysLeft;
}

export function getBudgetStatus(percentage: number): 'safe' | 'warning' | 'danger' {
  if (percentage < 70) return 'safe';
  if (percentage < 90) return 'warning';
  return 'danger';
}

export function getBudgetColor(percentage: number): string {
  if (percentage < 70) return '#22c55e';
  if (percentage < 90) return '#eab308';
  return '#ef4444';
}

// ─── Transaction Grouping ─────────────────────────────────────────────────────

export interface TransactionGroup {
  date: string;
  label: string;
  total: number;
  transactions: Transaction[];
}

export function groupTransactionsByDate(transactions: Transaction[]): TransactionGroup[] {
  const groups: Map<string, Transaction[]> = new Map();

  for (const t of transactions) {
    const date = new Date(t.created_at).toDateString();
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date)!.push(t);
  }

  return Array.from(groups.entries()).map(([date, txns]) => ({
    date,
    label: getRelativeDate(new Date(date)),
    total: txns.reduce((sum, t) => sum + t.amount, 0),
    transactions: txns,
  }));
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

export function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
