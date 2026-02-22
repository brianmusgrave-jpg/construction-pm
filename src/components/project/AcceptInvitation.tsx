"use client";

import { useState, useTransition } from "react";
import { acceptInvitation } from "@/actions/invitations";
import { CheckCircle2, XCircle, Loader2, HardHat } from "lucide-react";
import { useRouter } from "next/navigation";

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
        <h1 className="text-xl font-bold text-gray-900 mb-2">Invitation Expired</h1>
        <p className="text-sm text-gray-500 mb-6">
          This invitation has expired. Please ask the project owner to send a new one.
        </p>
        <a
          href="/login"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          Go to Login
        </a>
      </div>
    );
  }

  if (result?.success) {
    const dest = result.alreadyMember
      ? `/dashboard/projects/${result.projectId}`
      : `/dashboard/projects/${result.projectId}`;

    return (
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          {result.alreadyMember ? "Already a Member" : "Welcome to the Team!"}
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          {result.alreadyMember
            ? `You're already a member of ${result.projectName}.`
            : `You've joined ${result.projectName} successfully.`}
        </p>
        <button
          onClick={() => router.push(dest)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          Go to Project
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
        <h1 className="text-xl font-bold text-gray-900 mb-2">Something Went Wrong</h1>
        <p className="text-sm text-gray-500 mb-6">{result.error}</p>
        <a
          href="/login"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          Go to Login
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
      <h1 className="text-xl font-bold text-gray-900 mb-1">
        You&apos;re Invited
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        You&apos;ve been invited to join <span className="font-semibold text-gray-700">{invite.projectName}</span>
        {invite.projectAddress && (
          <span className="block text-xs text-gray-400 mt-1">{invite.projectAddress}</span>
        )}
      </p>

      <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Role</span>
          <span className="font-medium text-gray-900">
            {invite.role.charAt(0) + invite.role.slice(1).toLowerCase()}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Invited as</span>
          <span className="font-medium text-gray-900">{invite.email}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Expires</span>
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
              Joining...
            </>
          ) : (
            "Accept Invitation"
          )}
        </button>
      ) : (
        <a
          href={`/login?callbackUrl=/invite/${token}`}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          Sign In to Accept
        </a>
      )}
    </div>
  );
}
