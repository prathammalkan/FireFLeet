import type { Transaction } from './store';

/**
 * Transactions removed from the UI but not yet deleted in the DB
 * (the 5.5s undo window). Kept at module level so every hook instance,
 * component, and sign-out path sees the same state — a refetch during the
 * window must not resurrect a pending row ("zombie" transactions).
 */
export const pendingDeletes = new Map<string, Transaction>();

export const pendingDeleteTimers = new Map<string, ReturnType<typeof setTimeout>>();

function hasDatabaseError(value: unknown): value is { error: unknown } {
  return typeof value === 'object' && value !== null && 'error' in value && Boolean(value.error);
}

/**
 * Deletes every row still pending at sign-out time. Called before the
 * session is torn down so the DB delete can still pass RLS.
 */
export async function flushPendingDeletes(
  deleteRows: (ids: string[]) => Promise<unknown>
): Promise<boolean> {
  const ids = [...pendingDeletes.keys()];
  if (ids.length === 0) return true;
  try {
    const result = await deleteRows(ids);
    if (hasDatabaseError(result)) throw result.error;
    for (const id of ids) pendingDeletes.delete(id);
    return true;
  } catch {
    // Best effort: keep them tracked; the scheduled timeout will retry once
    // more and RLS still protects the rows either way.
    return false;
  }
}

/** Drop client-only undo tracking after a session is cleared. */
export function clearPendingDeleteTracking(): void {
  for (const timer of pendingDeleteTimers.values()) clearTimeout(timer);
  pendingDeleteTimers.clear();
  pendingDeletes.clear();
}
