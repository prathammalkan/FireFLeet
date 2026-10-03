import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type PeriodType = 'weekly' | 'monthly' | 'custom';

export type Currency = 'INR' | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AUD' | 'CAD';

export interface Budget {
  id: string;
  amount: number;
  currency: Currency;
  periodType: PeriodType;
  startDate: string;
  endDate: string;
  userId: string;
}

export interface Category {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

export interface Transaction {
  id: string;
  amount: number;
  category: string;
  comment: string | null;
  created_at: string;
  userId: string;
  budgetId: string;
}

export interface StoreUser {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'food',          name: 'Food',          emoji: '🍔', color: '#f97316' },
  { id: 'transport',     name: 'Transport',     emoji: '🚗', color: '#3b82f6' },
  { id: 'shopping',      name: 'Shopping',      emoji: '🛍️', color: '#a855f7' },
  { id: 'entertainment', name: 'Entertainment', emoji: '🎬', color: '#ec4899' },
  { id: 'health',        name: 'Health',        emoji: '💊', color: '#22c55e' },
  { id: 'bills',         name: 'Bills',         emoji: '🧾', color: '#eab308' },
  { id: 'travel',        name: 'Travel',        emoji: '✈️', color: '#06b6d4' },
  { id: 'education',     name: 'Education',     emoji: '📚', color: '#8b5cf6' },
  { id: 'other',         name: 'Other',         emoji: '💸', color: '#9ca3af' },
];

interface FireFleetState {
  currentUser: StoreUser | null;
  isOnboarded: boolean;
  budget: Budget | null;
  transactions: Transaction[];
  categories: Category[];
  isLoading: boolean;
  theme: 'dark' | 'light';

  setCurrentUser: (user: StoreUser | null) => void;
  setIsOnboarded: (val: boolean) => void;
  setBudget: (budget: Budget | null) => void;
  addTransaction: (transaction: Transaction) => void;
  deleteTransaction: (id: string) => void;
  updateTransaction: (id: string, transaction: Partial<Transaction>) => void;
  setTransactions: (transactions: Transaction[]) => void;
  setCategories: (categories: Category[]) => void;
  setIsLoading: (loading: boolean) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  reset: () => void;
}

const initialState = {
  currentUser: null,
  isOnboarded: false,
  budget: null,
  transactions: [],
  categories: DEFAULT_CATEGORIES,
  isLoading: false,
  theme: 'dark' as const,
};

export const useStore = create<FireFleetState>()(
  persist(
    (set) => ({
      ...initialState,

      setCurrentUser: (user) => set({ currentUser: user }),
      setIsOnboarded: (val) => set({ isOnboarded: val }),
      setBudget: (budget) => set({ budget }),
      addTransaction: (transaction) =>
        set((state) => ({ transactions: [transaction, ...state.transactions] })),
      deleteTransaction: (id) =>
        set((state) => ({ transactions: state.transactions.filter((t) => t.id !== id) })),
      updateTransaction: (id, updated) =>
        set((state) => ({
          transactions: state.transactions.map((t) =>
            t.id === id ? { ...t, ...updated } : t
          ),
        })),
      setTransactions: (transactions) => set({ transactions }),
      setCategories: (categories) => set({ categories }),
      setIsLoading: (isLoading) => set({ isLoading }),
      setTheme: (theme) => set({ theme }),
      reset: () => set({ ...initialState, categories: DEFAULT_CATEGORIES }),
    }),
    {
      name: 'firefleet-storage',
      storage: createJSONStorage(() => localStorage),
      // SEC-01 FIX: Only persist non-sensitive UI state.
      // Budget is re-fetched from Supabase on every authenticated session.
      // DO NOT persist budget — it contains financial data readable by anyone
      // with localStorage access (e.g., shared devices, malicious extensions).
      partialize: (state) => ({
        isOnboarded: state.isOnboarded,
        theme: state.theme,
        // budget intentionally excluded
        // currentUser intentionally excluded
        // transactions intentionally excluded (always fetched fresh)
      }),
    }
  )
);
