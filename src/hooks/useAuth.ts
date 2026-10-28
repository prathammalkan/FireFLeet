'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import { clearPendingDeleteTracking, flushPendingDeletes } from '@/lib/pendingDeletes';
import { clearUserCache } from '@/lib/cache';
import type { Session, AuthChangeEvent } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';

// Stable singleton — same reference on every render so it never triggers re-renders
const supabase = getSupabaseBrowserClient();

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const setCurrentUser = useStore((s) => s.setCurrentUser);
  const reset = useStore((s) => s.reset);
  // Track current user in a ref so signOut callback always has the latest value
  const userRef = useRef<User | null>(null);

  useEffect(() => {
    let active = true;

    const applySession = (session: Session | null) => {
      if (!active) return;
      const u = session?.user ?? null;
      setUser(u);
      userRef.current = u;
      setCurrentUser(u
        ? { id: u.id, email: u.email ?? '', name: u.user_metadata?.full_name }
        : null);
    };

    void supabase.auth.getSession()
      .then(({ data }: { data: { session: Session | null } }) => applySession(data.session))
      .catch(() => applySession(null))
      .finally(() => {
        if (active) setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        applySession(session);
        if (active) setLoading(false);
      }
    );

    return () => {
      active = false;
      void subscription.unsubscribe();
    };
  // supabase is a stable module-level singleton — safe to omit from deps
  }, [setCurrentUser]);

  const signIn = useCallback(async (email: string) => {
    // Basic email format guard before hitting network
    if (!email || !email.includes('@')) throw new Error('Invalid email address');
    const origin = typeof window !== 'undefined'
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL || '');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${origin}/auth/callback` },
    });
    if (error) throw error;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const origin = typeof window !== 'undefined'
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL || '');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${origin}/auth/callback` },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    // Commit any delete still inside its undo window *before* the session
    // is torn down (otherwise RLS would reject it and the row would survive).
    try {
      const uid = userRef.current?.id;
      if (uid) {
        await flushPendingDeletes((ids) =>
          supabase.from('transactions').delete().in('id', ids).eq('user_id', uid)
        );
        // Clear account-isolated IndexedDB cache before tearing down the session
        await clearUserCache(uid);
      }
    } catch { /* best effort */ }
    clearPendingDeleteTracking();

    // SEC-07 FIX: Clear all in-memory financial data before signing out.
    // Prevents the next user on the same device from seeing stale budget data.
    reset();
    // Explicitly clear the persisted storage key so no residual data remains
    try { localStorage.removeItem('firefleet-storage'); } catch { /* SSR */ }
    // Clear the local session even when the network is unavailable. This keeps
    // private data out of the next browser session; the remote session can be
    // revoked again when the user signs in from a connected device.
    try { await supabase.auth.signOut(); } catch (e) {
      console.warn('signOut: Supabase signOut failed', e);
      try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* best effort */ }
    }
  }, [reset]);

  return { user, loading, signIn, signInWithGoogle, signOut };
}
