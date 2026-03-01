/**
 * @file src/app/layout.tsx
 * @description Root application layout. Wraps all pages with NextIntlClientProvider
 * for i18n, Providers (SessionProvider + Toaster), OfflineSyncProvider,
 * OfflineIndicator, and ServiceWorkerRegister. Sets PWA metadata, viewport,
 * and manifest link.
 */
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { ServiceWorkerRegister } from "@/components/ui/ServiceWorkerRegister";
import { OfflineIndicator } from "@/components/ui/OfflineIndicator";
import { OfflineSyncProvider } from "@/components/ui/OfflineSyncProvider";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { getThemeCSS, getCustomColorCSS } from "@/lib/themes";
import { db } from "@/lib/db";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Construction PM",
  description: "Construction Project Management Tool",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Construction PM",
  },
  formatDetection: {
    telephone: true,
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#4F6DF5",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  // Resolve colour scheme: custom/logo colours override preset theme
  let themeStyle: Record<string, string> = {};
  try {
    const orgSettings = await db.orgSettings.findFirst();
    if (orgSettings) {
      if (
        (orgSettings.colorMode === "custom" || orgSettings.colorMode === "logo") &&
        orgSettings.colorPrimary
      ) {
        themeStyle = getCustomColorCSS(
          orgSettings.colorPrimary,
          orgSettings.colorSecondary,
          orgSettings.colorTertiary
        );
      } else {
        themeStyle = getThemeCSS(orgSettings.theme);
      }
    }
  } catch {
    // DB not ready (e.g. first deploy) — fall through with defaults
  }

  return (
    <html lang={locale} style={themeStyle}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NextIntlClientProvider messages={messages}>
          <Providers>
            <OfflineSyncProvider>{children}</OfflineSyncProvider>
          </Providers>
          <OfflineIndicator />
        </NextIntlClientProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
