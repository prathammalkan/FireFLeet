'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import type { Session, AuthChangeEvent } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = getSupabaseBrowserClient();
  const setCurrentUser = useStore((s) => s.setCurrentUser);
  const reset = useStore((s) => s.reset);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      if (u) {
        setCurrentUser({ id: u.id, email: u.email ?? '', name: u.user_metadata?.full_name });
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        const u = session?.user ?? null;
        setUser(u);
        if (u) {
          setCurrentUser({ id: u.id, email: u.email ?? '', name: u.user_metadata?.full_name });
        } else {
          setCurrentUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase, setCurrentUser]);

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
  }, [supabase]);

  const signInWithGoogle = useCallback(async () => {
    const origin = typeof window !== 'undefined'
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL || '');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${origin}/auth/callback` },
    });
    if (error) throw error;
  }, [supabase]);

  const signOut = useCallback(async () => {
    // SEC-07 FIX: Clear all in-memory financial data before signing out.
    // Prevents the next user on the same device from seeing stale budget data.
    reset();
    // Explicitly clear the persisted storage key so no residual data remains
    try { localStorage.removeItem('firefleet-storage'); } catch { /* SSR */ }
    await supabase.auth.signOut();
  }, [supabase, reset]);

  return { user, loading, signIn, signInWithGoogle, signOut };
}
