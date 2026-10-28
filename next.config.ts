import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Build once so the CSP string is stable across requests
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  // 'unsafe-inline' is required for Next.js hydration bootstrap scripts (no nonce/SSR
  // headers available for statically prerendered pages). 'unsafe-eval' is only needed
  // in development (React debugging) and is intentionally omitted in production.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://accounts.google.com`,
  // Inline style attributes are set by React/Tailwind; no external stylesheets are used
  // (fonts are self-hosted via next/font).
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  // No remote images are rendered; data: covers inline SVGs, blob: covers export previews
  "img-src 'self' data: blob:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://accounts.google.com",
  "frame-src https://accounts.google.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // Never upgrade localhost dev requests to https
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
]
  .join("; ")
  .trim();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["motion"],

  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "motion"],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // ── Clickjacking protection ──────────────────────────────────
          { key: "X-Frame-Options", value: "DENY" },

          // ── MIME-type sniffing protection ────────────────────────────
          { key: "X-Content-Type-Options", value: "nosniff" },

          // ── Referrer — don't leak URL to third parties ───────────────
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

          // ── HSTS — force HTTPS for 1 year, include subdomains ────────
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },

          // ── Permissions — disable unused browser APIs ─────────────────
          {
            key: "Permissions-Policy",
            value: [
              "camera=()",           // no camera
              "microphone=()",       // no microphone
              "geolocation=()",      // no location
              "payment=()",          // no payment API
              "usb=()",              // no USB
              "interest-cohort=()",  // no FLoC tracking
            ].join(", "),
          },

          // ── Content Security Policy ───────────────────────────────────
          // Only allows resources from our own origin + Supabase + Google Auth
          { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },

          // ── Cross-origin isolation (enables SharedArrayBuffer) ───────
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" }, // allow-popups needed for Google OAuth
          { key: "Cross-Origin-Embedder-Policy", value: "unsafe-none" }, // required for Supabase realtime
        ],
      },

      // ── Service worker: never cache ──────────────────────────────────
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },

      // ── PWA manifest: short cache ────────────────────────────────────
      {
        source: "/manifest.json",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600" }],
      },

      // ── Icons: long cache (content-addressed SVGs) ───────────────────
      {
        source: "/icons/(.*)",
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
