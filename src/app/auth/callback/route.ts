import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { safeNextPath, isTrustedHost } from '@/lib/safe-redirect';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  // SEC: sanitize redirect target — blocks open redirects via ?next=//evil.com
  const next = safeNextPath(requestUrl.searchParams.get('next'), '/');
  const origin = requestUrl.origin;

  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.redirect(new URL('/auth?error=configuration', origin));
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
        return NextResponse.redirect(new URL(next, origin));
      } else if (forwardedHost && isTrustedHost(forwardedHost)) {
        // Only build URLs from hosts we explicitly trust (never raw headers)
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(new URL(next, origin));
      }
    }
  }

  return NextResponse.redirect(new URL('/auth?error=auth_failed', origin));
}
