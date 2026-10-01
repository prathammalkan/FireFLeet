import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Transpile motion package for correct bundling
  transpilePackages: ["motion"],

  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
  },

  // Force all pages to be dynamic — no static prerendering
  // This is needed because Supabase client requires env vars at runtime
  output: undefined,

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
