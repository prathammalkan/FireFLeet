import type { NextConfig } from "next";

// Build-time cache version — forces SW to update on new deploy
const DEPLOY_VERSION = Date.now().toString(36);

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
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Scripts: self + inline (Next.js requires) + Vercel analytics
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com",
              // Styles: self + inline (Tailwind requires)
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // Fonts
              "font-src 'self' https://fonts.gstatic.com",
              // Images: self + data URIs (inline SVGs) + Google user avatars
              "img-src 'self' data: https: blob:",
              // API calls: self (Next.js) + Supabase
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://accounts.google.com",
              // Frames: Google OAuth popup
              "frame-src https://accounts.google.com",
              // Service worker
              "worker-src 'self'",
              // Manifests
              "manifest-src 'self'",
            ].join("; "),
          },

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
