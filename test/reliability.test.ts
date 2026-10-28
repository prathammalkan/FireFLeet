import { clearPendingDeleteTracking, flushPendingDeletes, pendingDeletes } from '../src/lib/pendingDeletes';
import { escapeCsvCell } from '../src/lib/utils';
import type { Transaction } from '../src/lib/store';

const tx: Transaction = {
  id: 'tx-1',
  amount: 12.34,
  category: 'food',
  comment: null,
  created_at: '2026-10-27T00:00:00.000Z',
  userId: 'user-1',
  budgetId: 'budget-1',
};

afterEach(() => clearPendingDeleteTracking());

describe('pending delete reliability', () => {
  it('retains pending rows when the database delete fails', async () => {
    pendingDeletes.set(tx.id, tx);

    await expect(flushPendingDeletes(async () => ({ error: new Error('offline') }))).resolves.toBe(false);
    expect(pendingDeletes.has(tx.id)).toBe(true);
  });

  it('clears pending rows after a confirmed database delete', async () => {
    pendingDeletes.set(tx.id, tx);

    await expect(flushPendingDeletes(async (ids) => {
      expect(ids).toEqual([tx.id]);
      return { error: null };
    })).resolves.toBe(true);
    expect(pendingDeletes.has(tx.id)).toBe(false);
  });
});

describe('CSV export safety', () => {
  it('quotes cells, escapes quotes, and neutralises formulas', () => {
    expect(escapeCsvCell('Dinner, "late"')).toBe('"Dinner, ""late"""');
    expect(escapeCsvCell('=SUM(A1:A2)')).toBe('"\'=SUM(A1:A2)"');
  });
});
