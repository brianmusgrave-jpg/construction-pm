"use client";

/**
 * @file src/components/auth/ActivateAccountForm.tsx
 * @description Account activation form for new users arriving from an admin invite.
 * Collects name + password, calls activateAccount server action, then auto-signs in.
 */

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { activateAccount } from "@/actions/userInvitations";
import { CheckCircle2, Eye, EyeOff, UserPlus } from "lucide-react";

interface InviteData {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
}

interface Props {
  token: string;
  invite: InviteData;
}

const roleLabels: Record<string, string> = {
  ADMIN: "Admin",
  PROJECT_MANAGER: "Project Manager",
  CONTRACTOR: "Contractor",
  STAKEHOLDER: "Stakeholder",
  VIEWER: "Viewer",
};

export function ActivateAccountForm({ token, invite }: Props) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const t = useTranslations("activate");
  const tc = useTranslations("common");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t("passwordMismatch"));
      return;
    }
    if (password.length < 8) {
      setError(t("passwordTooShort"));
      return;
    }

    setLoading(true);
    const result = await activateAccount(token, name, password);
    if (!result.success) {
      setError(result.error || t("genericError"));
      setLoading(false);
      return;
    }

    // Account created — auto sign-in
    setDone(true);
    await signIn("credentials", {
      email: result.email,
      password,
      callbackUrl: "/dashboard",
    });
  }

  if (done) {
    return (
      <div className="text-center space-y-4">
        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
        <h2 className="text-xl font-bold text-gray-900">{t("successTitle")}</h2>
        <p className="text-sm text-gray-500">{t("successMessage")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
          <UserPlus className="w-7 h-7 text-blue-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{tc("appName")}</h1>
        <p className="mt-1 text-sm text-gray-500">{t("subtitle")}</p>
      </div>

      {/* Invite info */}
      <div className="bg-blue-50 rounded-lg p-4 text-sm">
        <p className="text-blue-800">
          {t("invitedAs")}{" "}
          <span className="font-semibold">{invite.email}</span>
        </p>
        <p className="text-blue-600 mt-0.5">
          {t("role")}: {roleLabels[invite.role] || invite.role}
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            {t("fullName")}
          </label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("fullNamePlaceholder")}
            className="w-full p-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            {t("choosePassword")}
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("passwordPlaceholder")}
              className="w-full p-3 pr-10 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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

        {/* Confirm password */}
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
            {t("confirmPassword")}
          </label>
          <input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t("confirmPasswordPlaceholder")}
            className="w-full p-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full p-3 bg-blue-600 text-white rounded-lg text-base font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? t("activating") : t("activateButton")}
        </button>
      </form>
    </div>
  );
}
