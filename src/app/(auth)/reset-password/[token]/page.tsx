/**
 * @file src/app/(auth)/reset-password/[token]/page.tsx
 * @description Reset password page — user sets a new password using a valid token.
 */
"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { resetPassword } from "@/actions/password-reset";
import { Eye, EyeOff, CheckCircle2, AlertTriangle } from "lucide-react";

export default function ResetPasswordPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const t = useTranslations("auth");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError(t("passwordMinLength"));
      return;
    }
    if (password !== confirm) {
      setError(t("passwordMismatch"));
      return;
    }

    setLoading(true);
    const result = await resetPassword(token, password);
    setLoading(false);

    if (result.success) {
      setSuccess(true);
      setTimeout(() => router.push("/login"), 3000);
    } else {
      setError(result.error || t("genericError"));
    }
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
            {t("resetPasswordTitle")}
          </h1>
        </div>

        {success ? (
          <div className="text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
            <p className="text-sm text-gray-600">{t("passwordResetSuccess")}</p>
            <p className="text-xs text-gray-400">{t("redirectingToLogin")}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider"
                style={{ fontFamily: "var(--font-barlow-condensed, sans-serif)" }}
              >
                {t("newPassword")}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("newPasswordPlaceholder")}
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
            </div>

            <div>
              <label
                htmlFor="confirm"
                className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider"
                style={{ fontFamily: "var(--font-barlow-condensed, sans-serif)" }}
              >
                {t("confirmPassword")}
              </label>
              <input
                id="confirm"
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={t("confirmPasswordPlaceholder")}
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
              {loading ? t("resetting") : t("resetPassword")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
