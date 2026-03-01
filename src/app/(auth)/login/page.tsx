"use client";

/**
 * @file src/app/(auth)/login/page.tsx
 * @description Credentials-based login form. Accepts email + optional password.
 * Backward compatible: accounts without a password (legacy/admin) can still log
 * in with email only. New invited users must provide the password they set during
 * account activation.
 * Supports callbackUrl from searchParams. Wrapped in Suspense for async access.
 */

import { signIn } from "next-auth/react";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Eye, EyeOff } from "lucide-react";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const error = searchParams.get("error");
  const t = useTranslations("auth");
  const tc = useTranslations("common");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await signIn("credentials", { email, password, callbackUrl });
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

      <form onSubmit={handleLogin} className="space-y-3">
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

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {t("password")}
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("passwordPlaceholder")}
              className="w-full p-3 pr-10 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-400">{t("passwordHint")}</p>
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
