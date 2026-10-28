/**
 * src/lib/cache.ts
 *
 * Account-isolated IndexedDB cache for FireFleet budget and transaction data.
 *
 * Design principles:
 * - Each user's data is stored in a separate object store keyed by userId.
 * - TTL-based invalidation: budget 5 min, transactions 2 min.
 * - Cache version embedded in DB name — bump CACHE_VERSION to wipe all old caches.
 * - Graceful fallback: if IndexedDB is unavailable, all reads return null and
 *   writes are silently skipped. The app continues to work via Supabase fetches.
 * - No financial data is written to localStorage — only this module's IndexedDB.
 * - Sign-out MUST call clearUserCache(userId) to prevent data leaking across sessions.
 */

// Bump this when the stored object shape changes incompatibly.
const CACHE_VERSION = 'v1';
const DB_NAME = `firefleet-cache-${CACHE_VERSION}`;
const DB_VERSION = 1;

/** TTL constants in milliseconds */
export const TTL = {
  BUDGET: 5 * 60 * 1000,       // 5 minutes
  TRANSACTIONS: 2 * 60 * 1000, // 2 minutes
} as const;

interface CacheEntry<T> {
  data: T;
  storedAt: number; // Date.now() epoch ms
}

// ─── IndexedDB plumbing ───────────────────────────────────────────────────────

let _db: IDBDatabase | null = null;
let _dbPromise: Promise<IDBDatabase | null> | null = null;

function openDB(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (_db) return Promise.resolve(_db);
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        // One store per data type; userId is the record key.
        if (!db.objectStoreNames.contains('budgets')) {
          db.createObjectStore('budgets'); // keyPath not used; key is userId
        }
        if (!db.objectStoreNames.contains('transactions')) {
          db.createObjectStore('transactions');
        }
      };

      req.onsuccess = (e) => {
        _db = (e.target as IDBOpenDBRequest).result;
        // If the DB is force-closed (e.g., version bump from another tab),
        // reset so the next call re-opens.
        _db.onversionchange = () => {
          _db?.close();
          _db = null;
          _dbPromise = null;
        };
        resolve(_db);
      };

      req.onerror = () => {
        _dbPromise = null;
        resolve(null); // fallback — no cache
      };

      req.onblocked = () => {
        _dbPromise = null;
        resolve(null);
      };
    } catch {
      _dbPromise = null;
      resolve(null);
    }
  });

  return _dbPromise;
}

/** Generic read from an object store by string key. Returns null on any failure. */
async function idbGet<T>(store: string, key: string): Promise<T | null> {
  const db = await openDB();
  if (!db) return null;
  return new Promise<T | null>((resolve) => {
    try {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** Generic write to an object store. Silently swallows failures. */
async function idbPut<T>(store: string, key: string, value: T): Promise<void> {
  const db = await openDB();
  if (!db) return;
  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve(); // best-effort
    } catch {
      resolve();
    }
  });
}

/** Delete a key from an object store. */
async function idbDelete(store: string, key: string): Promise<void> {
  const db = await openDB();
  if (!db) return;
  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

// ─── TTL helpers ─────────────────────────────────────────────────────────────

function isFresh(entry: CacheEntry<unknown>, ttlMs: number): boolean {
  return Date.now() - entry.storedAt < ttlMs;
}

// ─── Public API ──────────────────────────────────────────────────────────────

import type { Budget, Transaction } from './store';

/**
 * Retrieve a cached budget for the given user.
 * Returns null if not cached, expired, or IndexedDB is unavailable.
 */
export async function getCachedBudget(userId: string): Promise<Budget | null> {
  if (!userId) return null;
  try {
    const entry = await idbGet<CacheEntry<Budget | null>>('budgets', userId);
    if (!entry || !isFresh(entry, TTL.BUDGET)) return null;
    return entry.data;
  } catch {
    return null;
  }
}

/**
 * Store a budget in the cache.
 * Passing null explicitly caches the "no active budget" result so we avoid
 * re-fetching on every render when the user has no budget.
 */
export async function setCachedBudget(userId: string, budget: Budget | null): Promise<void> {
  if (!userId) return;
  try {
    const entry: CacheEntry<Budget | null> = { data: budget, storedAt: Date.now() };
    await idbPut('budgets', userId, entry);
  } catch {
    // best-effort
  }
}

/**
 * Retrieve cached transactions for a user+budget combination.
 * Returns null if not cached, expired, or IndexedDB is unavailable.
 */
export async function getCachedTransactions(
  userId: string,
  budgetId: string
): Promise<Transaction[] | null> {
  if (!userId || !budgetId) return null;
  const key = `${userId}:${budgetId}`;
  try {
    const entry = await idbGet<CacheEntry<Transaction[]>>('transactions', key);
    if (!entry || !isFresh(entry, TTL.TRANSACTIONS)) return null;
    return entry.data;
  } catch {
    return null;
  }
}

/**
 * Store transactions in the cache for a user+budget combination.
 */
export async function setCachedTransactions(
  userId: string,
  budgetId: string,
  transactions: Transaction[]
): Promise<void> {
  if (!userId || !budgetId) return;
  const key = `${userId}:${budgetId}`;
  try {
    const entry: CacheEntry<Transaction[]> = { data: transactions, storedAt: Date.now() };
    await idbPut('transactions', key, entry);
  } catch {
    // best-effort
  }
}

/**
 * Clear all cached data for a specific user.
 * MUST be called on sign-out to prevent data leaking to the next user on the
 * same device.
 *
 * Also invalidates any cached "no budget" null entry.
 */
export async function clearUserCache(userId: string): Promise<void> {
  if (!userId) return;
  try {
    // We cannot enumerate all budgetId keys without scanning the store,
    // so we delete the budget entry (keyed by userId) and scan transactions
    // store for keys that start with userId.
    await idbDelete('budgets', userId);

    const db = await openDB();
    if (!db) return;

    // Collect transaction keys belonging to this user
    const keysToDelete = await new Promise<string[]>((resolve) => {
      try {
        const tx = db.transaction('transactions', 'readonly');
        const req = tx.objectStore('transactions').getAllKeys();
        req.onsuccess = () => {
          const keys = (req.result as IDBValidKey[])
            .filter((k): k is string => typeof k === 'string' && k.startsWith(`${userId}:`));
          resolve(keys);
        };
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });

    await Promise.all(keysToDelete.map((k) => idbDelete('transactions', k)));
  } catch {
    // best-effort — sign-out still proceeds
  }
}
