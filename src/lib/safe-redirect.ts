/**
 * Validates the post-authentication redirect target.
 *
 * Only same-origin, single-slash application paths are allowed.
 * Rejects protocol-relative URLs ("//evil.com"), backslash variants
 * ("\\/evil.com"), absolute URLs, and anything that is not a plain
 * path, to prevent open-redirect phishing after login.
 */
export function safeNextPath(raw: string | null | undefined, fallback = "/"): string {
  if (!raw) return fallback;

  // Must be a single leading slash, followed by a path that never
  // starts with another slash or a backslash.
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return fallback;
  }

  // No encoded scheme smuggling or control characters.
  if (/[\u0000-\u001f\u007f]/.test(raw)) return fallback;

  try {
    const url = new URL(raw, "https://internal.example");
    // Path-only URLs resolve on our origin; anything with a host or
    // protocol in the parsed result is an attempt to escape.
    if (url.host !== "internal.example" || url.protocol !== "https:") return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}

/**
 * Validates an inbound Host / X-Forwarded-Host value before using it to
 * build a redirect URL. Only the configured app host (or localhost in
 * development) is trusted.
 */
export function isTrustedHost(host: string | null | undefined): boolean {
  if (!host) return false;
  // Strip port for comparison
  const hostname = host.replace(/:\d+$/, "").toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]") {
    return process.env.NODE_ENV === "development";
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try {
      const expected = new URL(appUrl).hostname.toLowerCase();
      return hostname === expected;
    } catch {
      return false;
    }
  }
  return false;
}
