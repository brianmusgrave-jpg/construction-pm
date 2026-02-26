"use client";

/**
 * @file src/app/(auth)/login/page.tsx
 * @description Credentials-based login form. Calls signIn("credentials") with
 * email and password; supports callbackUrl from searchParams. Wrapped in Suspense
 * for async searchParams access.
 */

import { signIn } from "next-auth/react";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const error = searchParams.get("error");
  const t = useTranslations("auth");
  const tc = useTranslations("common");

  async function handleDevLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await signIn("credentials", { email, callbackUrl });
    setLoading(false);
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">{tc("appName")}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("signInSubtitle")}
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">
          {error === "CredentialsSignin"
            ? t("invalidCredentials")
            : t("genericError")}
        </div>
      )}

      <form onSubmit={handleDevLogin} className="space-y-3">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {t("emailAddress")}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            className="w-full p-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full p-3 bg-[var(--color-primary)] text-white rounded-lg text-base font-medium hover:bg-[var(--color-primary-dark)] disabled:opacity-50 transition-colors"
        >
          {loading ? t("signingIn") : t("signIn")}
        </button>
      </form>

      <p
        className="text-xs text-center text-gray-400"
        dangerouslySetInnerHTML={{ __html: t("demoAccess") }}
      />
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Suspense
        fallback={
          <div className="w-full max-w-sm text-center text-gray-500 text-sm">
            Loading...
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
