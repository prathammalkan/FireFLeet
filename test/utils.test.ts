import { getRemainingAmount, getSpentAmount, localDateKey } from '../src/lib/utils';
import type { Budget, Transaction } from '../src/lib/store';

const transaction = (amount: number): Transaction => ({
  id: String(amount),
  amount,
  category: 'food',
  comment: null,
  created_at: '2026-10-27T00:00:00.000Z',
  userId: 'user-1',
  budgetId: 'budget-1',
});

describe('financial calculations', () => {
  it('sums decimal amounts in integer minor units', () => {
    expect(getSpentAmount([transaction(0.1), transaction(0.2)])).toBe(0.3);
  });

  it('never reports a negative remaining budget', () => {
    const budget: Budget = {
      id: 'budget-1', amount: 10, currency: 'INR', periodType: 'monthly',
      startDate: '2026-10-01', endDate: '2026-10-31', userId: 'user-1',
    };
    expect(getRemainingAmount(budget, [transaction(12)])).toBe(0);
  });
});

describe('localDateKey', () => {
  it('preserves date-only database values', () => {
    expect(localDateKey('2026-10-27')).toBe('2026-10-27');
  });
});
