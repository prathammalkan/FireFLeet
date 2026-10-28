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

/** Escape a value for a CSV cell and neutralise spreadsheet formulas. */
export function escapeCsvCell(value: unknown): string {
  const text = String(value ?? '');
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

export function getCurrencySymbol(currency: Currency = 'INR'): string {
  return CURRENCY_CONFIG[isValidCurrency(currency) ? currency : 'INR']?.symbol || '₹';
}

// ─── Date Utilities ───────────────────────────────────────────────────────────

/**
 * Local calendar-date key (YYYY-MM-DD) for a Date or ISO string.
 * Grouping/labels must use the *user's* calendar date — a transaction made
 * at 2am local time is "Today" even when its UTC date is still yesterday.
 */
export function localDateKey(date: string | Date): string {
  // Bare date strings are already calendar dates — never re-parse them
  // (parsing 'YYYY-MM-DD' yields UTC midnight, which shifts a day in
  // negative-UTC-offset timezones).
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function shiftDaysKey(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return localDateKey(d);
}

function parseDateOnly(date: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d;
  }
  const [y, m, day] = date.split('-').map(Number);
  const d = new Date(y, m - 1, day);
  return isNaN(d.getTime()) ? null : d;
}

/** Format a Date as YYYY-MM-DD using *local* calendar components. */
export function toDateInputValue(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getDaysLeft(endDate: string): number {
  const end = parseDateOnly(endDate);
  if (!end) return 0;
  const todayLocal = new Date();
  todayLocal.setHours(0, 0, 0, 0);
  // Math.round absorbs DST days that are 23h/25h long
  const diffDays = Math.round((end.getTime() - todayLocal.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

export function formatDate(date: string | Date): string {
  let d: Date | null;
  if (typeof date === 'string') {
    // Construct from components so the calendar date is preserved exactly
    d = parseDateOnly(date);
  } else {
    d = date;
  }
  if (!d || isNaN(d.getTime())) return '—';
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
  const key = localDateKey(date);
  return key !== '' && key === localDateKey(new Date());
}

export function isYesterday(date: string | Date): boolean {
  const key = localDateKey(date);
  return key !== '' && key === shiftDaysKey(new Date(), -1);
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

// ─── Transaction Grouping — local calendar dates avoid timezone grouping bugs ─

export interface TransactionGroup {
  date: string;      // YYYY-MM-DD in UTC
  label: string;
  total: number;
  transactions: Transaction[];
}

export function groupTransactionsByDate(transactions: Transaction[]): TransactionGroup[] {
  const groups: Map<string, Transaction[]> = new Map();

  for (const t of transactions) {
    // Group by the *user's local* calendar date so entries logged at 2am
    // don't land under "Yesterday".
    const key = localDateKey(t.created_at);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  return Array.from(groups.entries()).map(([date, txns]) => ({
    date,
    label: getRelativeDate(date),
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
