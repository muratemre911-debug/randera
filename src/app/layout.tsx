import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/context/LanguageContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import PwaManager from "@/components/pwa/PwaManager";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Randera",
  description: "Randera - Akıllı İşletme Yönetim Sistemi",
  applicationName: "Randera",
  // iOS ana ekrana eklendiğinde tam ekran (standalone) açılsın.
  // `mobile-web-app-capable` Next tarafından eklenir; eski iOS sürümleri için
  // `other` ile klasik Apple meta etiketi de yazılır.
  appleWebApp: {
    capable: true,
    title: "Randera",
    statusBarStyle: "default",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  formatDetection: { telephone: false, address: false, email: false },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

/**
 * Mobil davranışı belirleyen viewport ayarları.
 * `viewportFit: "cover"` olmadan iOS/Android'de `env(safe-area-inset-*)`
 * değerleri 0 kalır ve çentik / home bar altında içerik kalır.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0d14" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/*
          Tema ilk boyamadan ÖNCE uygulanmalı, aksi halde koyu tema kullanan
          biri her açılışta beyaz bir parlama görür. Bu yüzden senkron script
          bilinçli olarak kullanılıyor: içerik statiktir (bkz. public/theme-init.js),
          service worker tarafından önceden önbelleğe alınır.
        */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/theme-init.js" />
      </head>
      <body className="min-h-full flex flex-col bg-white dark:bg-slate-950">
        <LanguageProvider>
          <ThemeProvider>
            <ErrorBoundary>{children}</ErrorBoundary>
            <PwaManager />
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
