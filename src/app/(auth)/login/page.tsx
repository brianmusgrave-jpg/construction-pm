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
      {/* Brand lockup */}
      <div className="text-center space-y-1">
        <div
          className="inline-flex items-center justify-center w-14 h-14 mb-3 border-3"
          style={{
            backgroundColor: "var(--color-primary, #111010)",
            borderColor: "var(--color-primary, #111010)",
            boxShadow: "4px 4px 0 var(--nav-accent, #F5C800)",
          }}
        >
          <span
            className="text-2xl font-bold"
            style={{
              color: "var(--nav-accent, #F5C800)",
              fontFamily: "var(--font-oswald, sans-serif)",
              letterSpacing: "0.05em",
            }}
          >
            AD
          </span>
        </div>
        <h1
          className="text-3xl font-bold tracking-wide"
          style={{
            color: "var(--color-primary, #111010)",
            fontFamily: "var(--font-oswald, sans-serif)",
            letterSpacing: "0.08em",
          }}
        >
          {tc("appName")}
        </h1>
        <p className="text-sm text-gray-500">{t("signInSubtitle")}</p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
          {error === "CredentialsSignin"
            ? t("invalidCredentials")
            : t("genericError")}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider"
            style={{ fontFamily: "var(--font-barlow-condensed, sans-serif)" }}
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
            className="w-full p-3 border-2 text-base outline-none transition-colors"
            style={{
              borderColor: "var(--color-primary, #111010)",
              fontFamily: "var(--font-barlow-condensed, sans-serif)",
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = "3px 3px 0 var(--nav-accent, #F5C800)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = "none";
            }}
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider"
            style={{ fontFamily: "var(--font-barlow-condensed, sans-serif)" }}
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
              className="w-full p-3 pr-10 border-2 text-base outline-none transition-colors"
              style={{
                borderColor: "var(--color-primary, #111010)",
                fontFamily: "var(--font-barlow-condensed, sans-serif)",
              }}
              onFocus={(e) => {
                e.currentTarget.style.boxShadow = "3px 3px 0 var(--nav-accent, #F5C800)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = "none";
              }}
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
          className="w-full p-3 text-base font-bold uppercase tracking-widest transition-all disabled:opacity-50"
          style={{
            backgroundColor: "var(--color-primary, #111010)",
            color: "var(--nav-accent, #F5C800)",
            fontFamily: "var(--font-oswald, sans-serif)",
            boxShadow: loading ? "none" : "4px 4px 0 var(--nav-accent, #F5C800)",
            transform: "translate(0, 0)",
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.currentTarget.style.transform = "translate(2px, 2px)";
              e.currentTarget.style.boxShadow = "2px 2px 0 var(--nav-accent, #F5C800)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translate(0, 0)";
            e.currentTarget.style.boxShadow = loading ? "none" : "4px 4px 0 var(--nav-accent, #F5C800)";
          }}
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
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: "var(--color-primary-bg, #f9fafb)" }}
    >
      {/* Accent stripe — top of screen */}
      <div
        className="fixed top-0 left-0 right-0 h-1"
        style={{ backgroundColor: "var(--nav-accent, #F5C800)" }}
      />
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
