import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { safeNextPath, isTrustedHost } from '@/lib/safe-redirect';
import { checkAuthCallbackRateLimit } from '@/lib/server-rate-limit';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
};

function isValidAuthCode(code: string | null): code is string {
  return (
    typeof code === 'string' &&
    code.length >= 8 &&
    code.length <= 512 &&
    /^[\x21-\x7e]+$/.test(code)
  );
}

function noStoreRedirect(target: string | URL) {
  return NextResponse.redirect(target, { headers: NO_STORE_HEADERS });
}

export async function GET(request: Request) {
  const rateLimit = checkAuthCallbackRateLimit(request);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many authentication attempts. Please try again shortly.' },
      {
        status: 429,
        headers: {
          ...NO_STORE_HEADERS,
          'Retry-After': String(rateLimit.retryAfterSec),
        },
      }
    );
  }

  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  // SEC: sanitize redirect target — blocks open redirects via ?next=//evil.com
  const next = safeNextPath(requestUrl.searchParams.get('next'), '/');
  const origin = requestUrl.origin;

  if (isValidAuthCode(code)) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return noStoreRedirect(new URL('/auth?error=configuration', origin));
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Server component / read-only context catch
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host');
      const isLocalEnv = process.env.NODE_ENV === 'development';
      if (isLocalEnv) {
        return noStoreRedirect(new URL(next, origin));
      } else if (forwardedHost && isTrustedHost(forwardedHost)) {
        // Only build URLs from hosts we explicitly trust (never raw headers)
        return noStoreRedirect(`https://${forwardedHost}${next}`);
      } else {
        return noStoreRedirect(new URL(next, origin));
      }
    }
  }

  return noStoreRedirect(new URL('/auth?error=auth_failed', origin));
}
