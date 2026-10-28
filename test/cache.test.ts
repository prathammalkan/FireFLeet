/**
 * test/cache.test.ts
 *
 * Tests for src/lib/cache.ts — account-isolated IndexedDB budget and transaction cache.
 *
 * Strategy: We inject a fully controlled in-memory indexedDB mock into globalThis
 * before importing the cache module. The mock implements just enough of the IDBRequest
 * / IDBTransaction / IDBDatabase / IDBObjectStore / IDBFactory interface surface for
 * the cache module's internal openDB, idbGet, idbPut, idbDelete helpers to work.
 *
 * No real browser or fake-indexeddb package is needed.
 */

// ─── In-memory IDB mock ───────────────────────────────────────────────────────

// Storage shared across all mock object-store handles
const mockStores: Record<string, Map<string, unknown>> = {
  budgets: new Map(),
  transactions: new Map(),
};

/** Build a mock IDBRequest that resolves asynchronously with a value or error. */
function makeReq<T>(getValue: () => T, shouldError = false) {
  let _onsuccess: ((e: { target: { result: T } }) => void) | null = null;
  let _onerror: ((e: unknown) => void) | null = null;

  const req = {
    get result() { return shouldError ? undefined : getValue(); },
    error: shouldError ? new DOMException('mock error') : null,
    set onsuccess(fn: ((e: { target: { result: T } }) => void) | null) {
      _onsuccess = fn;
      if (fn && !shouldError) {
        // Fire asynchronously so callers can attach onerror too
        Promise.resolve().then(() => fn({ target: { result: getValue() } }));
      }
    },
    get onsuccess() { return _onsuccess; },
    set onerror(fn: ((e: unknown) => void) | null) {
      _onerror = fn;
      if (fn && shouldError) {
        Promise.resolve().then(() => fn(new Event('error')));
      }
    },
    get onerror() { return _onerror; },
  };
  return req;
}

/** Build a mock IDBObjectStore backed by a Map. */
function makeObjectStore(name: string): IDBObjectStore {
  const map = mockStores[name];
  return {
    get: (key: IDBValidKey) => makeReq(() => map.get(String(key))),
    put: (value: unknown, key: IDBValidKey) => {
      map.set(String(key), value);
      return makeReq(() => undefined);
    },
    delete: (key: IDBValidKey) => {
      map.delete(String(key));
      return makeReq(() => undefined);
    },
    getAllKeys: () => makeReq(() => [...map.keys()] as IDBValidKey[]),
  } as unknown as IDBObjectStore;
}

/** Build a mock IDBTransaction that fires oncomplete asynchronously. */
function makeTx(storeNames: string | string[]): IDBTransaction {
  const names = Array.isArray(storeNames) ? storeNames : [storeNames];
  let _oncomplete: ((e: Event) => void) | null = null;
  let _onerror: ((e: Event) => void) | null = null;

  const tx = {
    objectStore: (name: string) => makeObjectStore(name),
    get oncomplete() { return _oncomplete; },
    set oncomplete(fn: ((e: Event) => void) | null) {
      _oncomplete = fn;
      if (fn) Promise.resolve().then(() => fn(new Event('complete')));
    },
    get onerror() { return _onerror; },
    set onerror(fn: ((e: Event) => void) | null) { _onerror = fn; },
  };

  void names; // used for type compat
  return tx as unknown as IDBTransaction;
}

/** Build the mock IDBDatabase. */
function makeMockDB(): IDBDatabase {
  return {
    objectStoreNames: {
      contains: () => true,
    } as unknown as DOMStringList,
    onversionchange: null,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    transaction: (storeNames: string | string[], _mode: IDBTransactionMode) =>
      makeTx(storeNames),
    close: () => {},
  } as unknown as IDBDatabase;
}

const mockDB = makeMockDB();

/** Install the mock IDBFactory into globalThis before any imports use it. */
function installMockIndexedDB() {
  const openReq = {
    get result() { return mockDB; },
    error: null,
    onupgradeneeded: null as unknown,
    onblocked: null as unknown,
    _onsuccess: null as ((e: { target: { result: IDBDatabase } }) => void) | null,
    _onerror: null as ((e: unknown) => void) | null,
    set onsuccess(fn: ((e: { target: { result: IDBDatabase } }) => void) | null) {
      this._onsuccess = fn;
      if (fn) Promise.resolve().then(() => fn({ target: { result: mockDB } }));
    },
    get onsuccess() { return this._onsuccess; },
    set onerror(fn: ((e: unknown) => void) | null) { this._onerror = fn; },
    get onerror() { return this._onerror; },
  };

  Object.defineProperty(globalThis, 'indexedDB', {
    value: { open: () => openReq },
    configurable: true,
    writable: true,
  });
}

// Install BEFORE importing the cache module so openDB sees indexedDB
installMockIndexedDB();

// ─── NOW import cache (after mock is installed) ───────────────────────────────
// We use dynamic require inside beforeAll to ensure the mock is in place.
// Jest module registry is reset per describe via jest.resetModules() in beforeEach,
// so we use module-level imports and rely on the mock being installed at load time.

import {
  getCachedBudget,
  setCachedBudget,
  getCachedTransactions,
  setCachedTransactions,
  clearUserCache,
  TTL,
} from '../src/lib/cache';
import type { Budget, Transaction } from '../src/lib/store';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const makeBudget = (userId = 'user-a'): Budget => ({
  id: 'budget-1',
  amount: 5000,
  currency: 'INR',
  periodType: 'monthly',
  startDate: '2026-10-01',
  endDate: '2026-10-31',
  userId,
});

const makeTxFixture = (id = 'tx-1', userId = 'user-a'): Transaction => ({
  id,
  amount: 100,
  category: 'food',
  comment: null,
  created_at: '2026-10-27T00:00:00.000Z',
  userId,
  budgetId: 'budget-1',
});

// ─── Test setup ──────────────────────────────────────────────────────────────

beforeEach(() => {
  mockStores.budgets.clear();
  mockStores.transactions.clear();
});

// ─── TTL constants ────────────────────────────────────────────────────────────

describe('TTL constants', () => {
  it('exposes BUDGET and TRANSACTIONS TTL values', () => {
    expect(TTL.BUDGET).toBeGreaterThan(0);
    expect(TTL.TRANSACTIONS).toBeGreaterThan(0);
    expect(TTL.BUDGET).toBeGreaterThanOrEqual(TTL.TRANSACTIONS);
  });
});

// ─── Budget cache ─────────────────────────────────────────────────────────────

describe('budget cache', () => {
  it('returns null when nothing is cached', async () => {
    const result = await getCachedBudget('user-a');
    expect(result).toBeNull();
  });

  it('returns the stored budget when fresh', async () => {
    const budget = makeBudget();
    await setCachedBudget('user-a', budget);
    const result = await getCachedBudget('user-a');
    expect(result).toEqual(budget);
  });

  it('returns null for an expired entry', async () => {
    const budget = makeBudget();
    // Directly write a stale entry with an old storedAt timestamp
    const staleEntry = { data: budget, storedAt: Date.now() - TTL.BUDGET - 1000 };
    mockStores.budgets.set('user-a', staleEntry);
    const result = await getCachedBudget('user-a');
    expect(result).toBeNull();
  });

  it('caches a null budget (no active budget result)', async () => {
    await setCachedBudget('user-a', null);
    // Fresh null entry — should return null (no active budget is a valid cache hit)
    const result = await getCachedBudget('user-a');
    expect(result).toBeNull();
  });

  it('returns null for an empty userId', async () => {
    expect(await getCachedBudget('')).toBeNull();
  });
});

// ─── Account isolation — budget ───────────────────────────────────────────────

describe('account isolation — budget', () => {
  it('user A budget is not visible to user B', async () => {
    await setCachedBudget('user-a', makeBudget('user-a'));
    const result = await getCachedBudget('user-b');
    expect(result).toBeNull();
  });

  it('user B write does not overwrite user A data', async () => {
    await setCachedBudget('user-a', makeBudget('user-a'));
    await setCachedBudget('user-b', makeBudget('user-b'));
    const resultA = await getCachedBudget('user-a');
    expect(resultA?.userId).toBe('user-a');
  });
});

// ─── Transaction cache ────────────────────────────────────────────────────────

describe('transaction cache', () => {
  it('returns null when nothing is cached', async () => {
    expect(await getCachedTransactions('user-a', 'budget-1')).toBeNull();
  });

  it('returns stored transactions when fresh', async () => {
    const txs = [makeTxFixture('tx-1'), makeTxFixture('tx-2')];
    await setCachedTransactions('user-a', 'budget-1', txs);
    const result = await getCachedTransactions('user-a', 'budget-1');
    expect(result).toEqual(txs);
  });

  it('returns null for an expired entry', async () => {
    const txs = [makeTxFixture()];
    const staleEntry = { data: txs, storedAt: Date.now() - TTL.TRANSACTIONS - 1000 };
    mockStores.transactions.set('user-a:budget-1', staleEntry);
    expect(await getCachedTransactions('user-a', 'budget-1')).toBeNull();
  });

  it('different budget IDs are isolated', async () => {
    await setCachedTransactions('user-a', 'budget-1', [makeTxFixture('tx-1')]);
    const result = await getCachedTransactions('user-a', 'budget-2');
    expect(result).toBeNull();
  });

  it('returns null for empty userId or budgetId', async () => {
    expect(await getCachedTransactions('', 'budget-1')).toBeNull();
    expect(await getCachedTransactions('user-a', '')).toBeNull();
  });
});

// ─── Account isolation — transactions ─────────────────────────────────────────

describe('account isolation — transactions', () => {
  it('user A transactions not visible to user B for same budget ID', async () => {
    await setCachedTransactions('user-a', 'budget-1', [makeTxFixture('tx-1', 'user-a')]);
    const result = await getCachedTransactions('user-b', 'budget-1');
    expect(result).toBeNull();
  });
});

// ─── clearUserCache ───────────────────────────────────────────────────────────

describe('clearUserCache', () => {
  it('removes the budget entry for the user', async () => {
    await setCachedBudget('user-a', makeBudget());
    await clearUserCache('user-a');
    expect(mockStores.budgets.has('user-a')).toBe(false);
  });

  it('removes transaction entries for the user', async () => {
    await setCachedTransactions('user-a', 'budget-1', [makeTxFixture()]);
    await setCachedTransactions('user-a', 'budget-2', [makeTxFixture('tx-2')]);
    await clearUserCache('user-a');
    expect(mockStores.transactions.has('user-a:budget-1')).toBe(false);
    expect(mockStores.transactions.has('user-a:budget-2')).toBe(false);
  });

  it('does not remove other users cache entries', async () => {
    await setCachedBudget('user-a', makeBudget('user-a'));
    await setCachedBudget('user-b', makeBudget('user-b'));
    await clearUserCache('user-a');
    expect(mockStores.budgets.has('user-b')).toBe(true);
  });

  it('does nothing for an empty userId', async () => {
    await expect(clearUserCache('')).resolves.toBeUndefined();
  });
});

// ─── Corrupt cache entries ────────────────────────────────────────────────────

describe('corrupt cache entries', () => {
  it('returns null when stored entry has no storedAt field (treated as epoch 0 → expired)', async () => {
    // storedAt defaults to undefined → Date.now() - undefined = NaN → not < TTL → expired
    mockStores.budgets.set('user-a', { data: makeBudget() });
    const result = await getCachedBudget('user-a');
    expect(result).toBeNull();
  });
});
