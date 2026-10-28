'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './useAuth';

/**
 * Client-side session gate for protected pages.
 *
 * Layer 1: `src/proxy.ts` redirects cookie-less requests on the server.
 * Layer 2: this hook verifies the actual session (a cookie can exist but be
 * expired or revoked) and bounces users to /auth.
 * Layer 3 (authoritative): Supabase RLS on every query.
 */
export function useRequireAuth() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/auth');
  }, [user, loading, router]);

  return { user, loading };
}
