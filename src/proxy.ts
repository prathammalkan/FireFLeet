import { NextResponse, type NextRequest } from 'next/server';

/**
 * Server-side route protection (Next 16 `proxy` — formerly middleware).
 *
 * This app renders static HTML shells and reads all data client-side under
 * Supabase RLS, so this gate exists for correct UX on direct URL access:
 * - Cookie-less visitors to protected pages are redirected to /auth immediately.
 * - Logged-in users visiting /auth are redirected straight to / (no login flash).
 *
 * It is intentionally a *presence* check only (no network round-trips, no
 * lock-out risk if Supabase is briefly unreachable). Session validity is
 * enforced by the client `useRequireAuth` hook and, most importantly, by
 * Row Level Security on every query.
 */

const PROTECTED_PATHS = ['/history', '/analytics', '/settings', '/setup'];

const AUTH_COOKIE = /^sb-.+-auth-token(\.\d+)?$/;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = request.cookies.getAll().some((c) => AUTH_COOKIE.test(c.name));

  // If already logged in and visiting /auth, bounce straight to home
  if (pathname === '/auth') {
    if (hasSessionCookie) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      url.search = '';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  const isProtected = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  if (!isProtected) return NextResponse.next();

  if (hasSessionCookie) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = '/auth';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    '/history', '/history/:path*',
    '/analytics', '/analytics/:path*',
    '/settings', '/settings/:path*',
    '/setup', '/setup/:path*',
    '/auth',
  ],
};
