"use client";

/**
 * @file src/app/providers.tsx
 * @description Client-side provider tree. Wraps children with NextAuth
 * SessionProvider and Sonner Toaster for global toast notifications.
 */

import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <Toaster position="top-right" richColors />
    </SessionProvider>
  );
}
