"use client";

import { useState } from "react";
import { UserPlus, Users } from "lucide-react";
import { InviteModal } from "./InviteModal";
import { useTranslations } from "next-intl";

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
}

export function TeamSection({ projectId, members, invitations, canInvite }: Props) {
  const t = useTranslations("team");
  const ti = useTranslations("common");
  const [showInvite, setShowInvite] = useState(false);

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
          members.map((member) => (
            <div key={member.id} className="flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-[var(--color-primary-bg)] text-[var(--color-primary)] flex items-center justify-center text-sm font-semibold shrink-0">
                {(member.user.name || member.user.email)[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {member.user.name || member.user.email}
                </p>
                <p className="text-xs text-gray-500">
                  {member.role.charAt(0) + member.role.slice(1).toLowerCase()}
                </p>
              </div>
            </div>
          ))
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
