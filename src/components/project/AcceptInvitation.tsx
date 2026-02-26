"use client";

/**
 * @file components/project/AcceptInvitation.tsx
 * @description Page-level component that handles team invitation acceptance from a
 *   tokenised invite URL (`/invite/[token]`).
 *
 * Render branches (mutually exclusive, rendered in priority order):
 *   1. `invite.expired === true` — red XCircle panel with "Go to Login" link.
 *   2. `result.success === true`  — green CheckCircle2 panel; shows "Already a member"
 *      message when `result.alreadyMember` is set, otherwise "Welcome to the team".
 *      Button navigates to `/dashboard/projects/[result.projectId]`.
 *   3. `result.error` set        — red XCircle error panel with "Go to Login" link.
 *   4. Default                   — HardHat welcome panel showing project name, role,
 *      invited email, and expiry date, with either:
 *        - Accept button (`isLoggedIn === true`) → calls `acceptInvitation(token)`
 *          via `useTransition`; sets `result` state on resolution.
 *        - "Sign in to accept" link (`isLoggedIn === false`) → navigates to
 *          `/login?callbackUrl=/invite/${token}`.
 *
 * @param token     Invitation token string from the URL.
 * @param invite    Invitation details including project name, role, email, expiry.
 * @param isLoggedIn Whether the current visitor has an active session.
 *
 * Server action: `acceptInvitation`.
 * i18n namespaces: `invitations`, `common`.
 */

import { useState, useTransition } from "react";
import { acceptInvitation } from "@/actions/invitations";
import { CheckCircle2, XCircle, Loader2, HardHat } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface InviteDetails {
  id: string;
  email: string;
  role: string;
  projectName: string;
  projectAddress: string | null;
  expiresAt: Date;
  expired: boolean;
}

interface Props {
  token: string;
  invite: InviteDetails;
  isLoggedIn: boolean;
}

export function AcceptInvitation({ token, invite, isLoggedIn }: Props) {
  const t = useTranslations("invitations");
  const tc = useTranslations("common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    success: boolean;
    projectId?: string;
    projectName?: string;
    alreadyMember?: boolean;
    error?: string;
  } | null>(null);

  if (invite.expired) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">{t("expired")}</h1>
        <p className="text-sm text-gray-500 mb-6">{t("expiredMessage")}</p>
        <a
          href="/login"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          {t("goToLogin")}
        </a>
      </div>
    );
  }

  if (result?.success) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          {result.alreadyMember ? t("alreadyMember") : t("welcomeToTeam")}
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          {result.alreadyMember
            ? t("alreadyMemberMessage", { project: result.projectName ?? "" })
            : t("joinedMessage", { project: result.projectName ?? "" })}
        </p>
        <button
          onClick={() => router.push(`/dashboard/projects/${result.projectId}`)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          {t("goToProject")}
        </button>
      </div>
    );
  }

  if (result?.error) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">{t("somethingWentWrong")}</h1>
        <p className="text-sm text-gray-500 mb-6">{result.error}</p>
        <a
          href="/login"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          {t("goToLogin")}
        </a>
      </div>
    );
  }

  function handleAccept() {
    startTransition(async () => {
      try {
        const res = await acceptInvitation(token);
        setResult(res);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to accept invitation";
        setResult({ success: false, error: msg });
      }
    });
  }

  return (
    <div className="text-center">
      <div className="w-16 h-16 rounded-full bg-[var(--color-primary-bg)] flex items-center justify-center mx-auto mb-4">
        <HardHat className="w-8 h-8 text-[var(--color-primary)]" />
      </div>
      <h1 className="text-xl font-bold text-gray-900 mb-1">{t("youreInvited")}</h1>
      <p className="text-sm text-gray-500 mb-6">
        {t("invitedToJoin")}{" "}
        <span className="font-semibold text-gray-700">{invite.projectName}</span>
        {invite.projectAddress && (
          <span className="block text-xs text-gray-400 mt-1">{invite.projectAddress}</span>
        )}
      </p>

      <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">{t("role")}</span>
          <span className="font-medium text-gray-900">
            {invite.role.charAt(0) + invite.role.slice(1).toLowerCase()}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">{t("invitedAs")}</span>
          <span className="font-medium text-gray-900">{invite.email}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">{tc("expires")}</span>
          <span className="font-medium text-gray-900">
            {new Date(invite.expiresAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
      </div>

      {isLoggedIn ? (
        <button
          onClick={handleAccept}
          disabled={isPending}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t("joining")}
            </>
          ) : (
            t("acceptInvitation")
          )}
        </button>
      ) : (
        <a
          href={`/login?callbackUrl=/invite/${token}`}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          {t("signInToAccept")}
        </a>
      )}
    </div>
  );
}
