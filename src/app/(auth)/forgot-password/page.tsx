/**
 * @file src/app/(auth)/forgot-password/page.tsx
 * @description Forgot password page — user enters email to receive a reset link.
 */
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { requestPasswordReset } from "@/actions/password-reset";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const t = useTranslations("auth");
  const tc = useTranslations("common");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await requestPasswordReset(email);
    setSent(true);
    setLoading(false);
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: "var(--color-primary-bg, #f9fafb)" }}
    >
      <div
        className="fixed top-0 left-0 right-0 h-1"
        style={{ backgroundColor: "var(--nav-accent, #F5C800)" }}
      />
      <div className="w-full max-w-sm space-y-6">
        {/* Brand */}
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
            className="text-2xl font-bold tracking-wide"
            style={{
              color: "var(--color-primary, #111010)",
              fontFamily: "var(--font-oswald, sans-serif)",
              letterSpacing: "0.08em",
            }}
          >
            {t("forgotPasswordTitle")}
          </h1>
          <p className="text-sm text-gray-500">{t("forgotPasswordSubtitle")}</p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
            <p className="text-sm text-gray-600">{t("resetEmailSent")}</p>
            <p className="text-xs text-gray-400">{t("resetEmailHint")}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider"
                style={{ fontFamily: "var(--font-barlow-condensed, sans-serif)" }}
              >
                {t("emailAddress")}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("emailPlaceholder")}
                  className="w-full p-3 pl-10 border-2 text-base outline-none transition-colors"
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
              }}
            >
              {loading ? t("sending") : t("sendResetLink")}
            </button>
          </form>
        )}

        <div className="text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-3 h-3" />
            {t("backToLogin")}
          </Link>
        </div>
      </div>
    </div>
  );
}
