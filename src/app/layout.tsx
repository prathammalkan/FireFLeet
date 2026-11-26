import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { ThemeSync } from "@/components/ui/ThemeSync";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: "FireFleet — Plan Your Wealth",
  description: "Track expenses, manage your budget, and stay on track. A beautiful personal finance tracker.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FireFleet",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "format-detection": "telephone=no,date=no,address=no,email=no", // prevent iOS auto-linking
  },
  icons: {
    apple: [{ url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" }],
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#f97316",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // NOTE: no maximumScale or userScalable — accessibility requirement
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geist.variable} suppressHydrationWarning>
      <body className="bg-[#0a0a0f] text-white antialiased overscroll-none">
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}
