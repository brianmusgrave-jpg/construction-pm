"use client";

import { useState, useTransition } from "react";
import { UserPlus, Users, ChevronDown, Loader2, Trash2 } from "lucide-react";
import { InviteModal } from "./InviteModal";
import { updateMemberRole, removeMember } from "@/actions/invitations";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

interface Member {
  id: string;
  role: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    role: string;
    image: string | null;
  };
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  expiresAt: Date;
  createdAt: Date;
}

interface Props {
  projectId: string;
  members: Member[];
  invitations: Invitation[];
  canInvite: boolean;
  currentUserId?: string;
}

const ROLE_OPTIONS = ["OWNER", "MANAGER", "CONTRACTOR", "STAKEHOLDER", "VIEWER"] as const;

export function TeamSection({ projectId, members, invitations, canInvite, currentUserId }: Props) {
  const t = useTranslations("team");
  const ti = useTranslations("common");
  const tr = useTranslations("invitations");
  const [showInvite, setShowInvite] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null);

  function handleRoleChange(memberId: string, newRole: string) {
    setPendingMemberId(memberId);
    startTransition(async () => {
      try {
        await updateMemberRole(
          memberId,
          projectId,
          newRole as "OWNER" | "MANAGER" | "CONTRACTOR" | "STAKEHOLDER" | "VIEWER"
        );
        toast.success(t("roleUpdated"));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to update role";
        toast.error(msg);
      } finally {
        setPendingMemberId(null);
      }
    });
  }

  function handleRemove(memberId: string, memberName: string) {
    if (!confirm(t("confirmRemove", { name: memberName }))) return;
    setPendingMemberId(memberId);
    startTransition(async () => {
      try {
        await removeMember(memberId, projectId);
        toast.success(t("memberRemoved"));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to remove member";
        toast.error(msg);
      } finally {
        setPendingMemberId(null);
      }
    });
  }

  function roleLabel(role: string): string {
    const key = role.toLowerCase();
    try {
      return tr(key);
    } catch {
      return role.charAt(0) + role.slice(1).toLowerCase();
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
          {t("title", { count: members.length })}
        </h2>
        {canInvite && (
          <button
            onClick={() => setShowInvite(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            {ti("invite")}
          </button>
        )}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {members.length === 0 ? (
          <div className="p-6 text-center">
            <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">{t("noTeamMembers")}</p>
          </div>
        ) : (
          members.map((member) => {
            const isCurrentUser = member.user.id === currentUserId;
            const isBusy = isPending && pendingMemberId === member.id;
            return (
              <div key={member.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-[var(--color-primary-bg)] text-[var(--color-primary)] flex items-center justify-center text-sm font-semibold shrink-0">
                  {(member.user.name || member.user.email)[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {member.user.name || member.user.email}
                    {isCurrentUser && (
                      <span className="ml-1 text-xs text-gray-400">({t("you")})</span>
                    )}
                  </p>
                  {canInvite ? (
                    <div className="flex items-center gap-1 mt-0.5">
                      {isBusy ? (
                        <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
                      ) : (
                        <div className="relative inline-block">
                          <select
                            value={member.role}
                            onChange={(e) => handleRoleChange(member.id, e.target.value)}
                            disabled={isPending}
                            className="appearance-none text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded px-2 py-0.5 pr-5 cursor-pointer transition-colors focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                          >
                            {ROLE_OPTIONS.map((r) => (
                              <option key={r} value={r}>
                                {roleLabel(r)}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">
                      {roleLabel(member.role)}
                    </p>
                  )}
                </div>
                {canInvite && !isCurrentUser && (
                  <button
                    onClick={() => handleRemove(member.id, member.user.name || member.user.email)}
                    disabled={isPending}
                    className="p-1 text-gray-300 hover:text-red-500 transition-colors shrink-0"
                    title={t("removeMember")}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {showInvite && (
        <InviteModal
          projectId={projectId}
          invitations={invitations}
          onClose={() => setShowInvite(false)}
        />
      )}
    </div>
  );
}
