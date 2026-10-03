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

export const VALID_CURRENCIES: Currency[] = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD'];

export function isValidCurrency(c: unknown): c is Currency {
  return typeof c === 'string' && (VALID_CURRENCIES as string[]).includes(c);
}

export function formatCurrency(amount: number, currency: Currency = 'INR'): string {
  const safeAmount = isFinite(amount) ? amount : 0;
  const safeCurrency = isValidCurrency(currency) ? currency : 'INR';
  const { locale } = CURRENCY_CONFIG[safeCurrency];
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: safeCurrency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safeAmount);
}

export function getCurrencySymbol(currency: Currency = 'INR'): string {
  return CURRENCY_CONFIG[isValidCurrency(currency) ? currency : 'INR']?.symbol || '₹';
}

// ─── Date Utilities ───────────────────────────────────────────────────────────

export function getDaysLeft(endDate: string): number {
  // Use UTC midnight comparison to avoid timezone drift
  const todayUTC = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);
  const endUTC = new Date(endDate + 'T00:00:00Z');
  const diff = endUTC.getTime() - todayUTC.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
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
    d.getUTCFullYear() === today.getUTCFullYear() &&
    d.getUTCMonth() === today.getUTCMonth() &&
    d.getUTCDate() === today.getUTCDate()
  );
}

export function isYesterday(date: string | Date): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return (
    d.getUTCFullYear() === yesterday.getUTCFullYear() &&
    d.getUTCMonth() === yesterday.getUTCMonth() &&
    d.getUTCDate() === yesterday.getUTCDate()
  );
}

export function getRelativeDate(date: string | Date): string {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return formatDate(date);
}

// ─── Budget Calculations — integer-cent arithmetic to avoid float drift ──────

/**
 * Sum all transaction amounts using integer arithmetic.
 * Avoids IEEE 754 errors like 0.1 + 0.2 = 0.30000000000000004.
 */
export function getSpentAmount(transactions: Transaction[]): number {
  const totalCents = transactions.reduce((sum, t) => {
    const cents = Math.round((isFinite(t.amount) ? t.amount : 0) * 100);
    return sum + cents;
  }, 0);
  return totalCents / 100;
}

export function getRemainingAmount(budget: Budget, transactions: Transaction[]): number {
  const spent = getSpentAmount(transactions);
  const budgetCents = Math.round(budget.amount * 100);
  const spentCents = Math.round(spent * 100);
  return Math.max(0, (budgetCents - spentCents) / 100);
}

export function getSpentPercentage(budget: Budget, transactions: Transaction[]): number {
  if (!budget.amount || budget.amount <= 0) return 0;
  const spent = getSpentAmount(transactions);
  return Math.min(100, (spent / budget.amount) * 100);
}

export function calculateDailyBudget(remaining: number, daysLeft: number): number {
  if (daysLeft <= 0 || !isFinite(remaining)) return 0;
  // Round to 2 decimal places
  return Math.round((remaining / daysLeft) * 100) / 100;
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

// ─── Transaction Grouping — UTC-based to avoid timezone grouping bugs ─────────

export interface TransactionGroup {
  date: string;      // YYYY-MM-DD in UTC
  label: string;
  total: number;
  transactions: Transaction[];
}

export function groupTransactionsByDate(transactions: Transaction[]): TransactionGroup[] {
  const groups: Map<string, Transaction[]> = new Map();

  for (const t of transactions) {
    // Use UTC date string (first 10 chars of ISO) — prevents timezone date-drift
    const utcDate = typeof t.created_at === 'string'
      ? t.created_at.slice(0, 10)           // "2025-01-15" from "2025-01-15T18:30:00Z"
      : new Date(t.created_at).toISOString().slice(0, 10);
    if (!groups.has(utcDate)) groups.set(utcDate, []);
    groups.get(utcDate)!.push(t);
  }

  return Array.from(groups.entries()).map(([date, txns]) => ({
    date,
    label: getRelativeDate(date + 'T00:00:00Z'),
    total: getSpentAmount(txns),     // use integer-safe sum
    transactions: txns,
  }));
}

// ─── Amount Validation ───────────────────────────────────────────────────────

export const MAX_TRANSACTION_AMOUNT = 9_999_999; // ₹9.9M — DB allows DECIMAL(12,2)

export function validateAmount(amount: number): string | null {
  if (!isFinite(amount) || isNaN(amount)) return 'Please enter a valid amount';
  if (amount <= 0) return 'Amount must be greater than zero';
  if (amount > MAX_TRANSACTION_AMOUNT) return `Amount cannot exceed ${MAX_TRANSACTION_AMOUNT.toLocaleString()}`;
  return null; // valid
}

// ─── Secure ID Generation ────────────────────────────────────────────────────

/**
 * Generate a cryptographically random ID.
 * Uses crypto.randomUUID() — available in all modern browsers and Node 19+.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for very old environments
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
