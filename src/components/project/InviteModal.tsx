"use client";

import { useState, useTransition } from "react";
import { createInvitation, cancelInvitation } from "@/actions/invitations";
import {
  X,
  Mail,
  UserPlus,
  Loader2,
  Copy,
  Check,
  Clock,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

interface Invitation {
  id: string;
  email: string;
  role: string;
  expiresAt: Date;
  createdAt: Date;
}

interface Props {
  projectId: string;
  invitations: Invitation[];
  onClose: () => void;
}

const ROLES = [
  { value: "MANAGER", label: "Manager", desc: "Can manage phases, team, and settings" },
  { value: "CONTRACTOR", label: "Contractor", desc: "Can update assigned phases and upload files" },
  { value: "STAKEHOLDER", label: "Stakeholder", desc: "Read-only access to project progress" },
  { value: "VIEWER", label: "Viewer", desc: "View-only access" },
] as const;

export function InviteModal({ projectId, invitations: initialInvitations, onClose }: Props) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("CONTRACTOR");
  const [invitations, setInvitations] = useState(initialInvitations);
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState<string | null>(null);

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    startTransition(async () => {
      try {
        const result = await createInvitation(
          projectId,
          email.trim(),
          role as "OWNER" | "MANAGER" | "CONTRACTOR" | "STAKEHOLDER" | "VIEWER"
        );
        toast.success(`Invitation sent to ${email.trim()}`);
        setInvitations((prev) => [
          { id: result.id, email: result.email, role: result.role, expiresAt: result.expiresAt, createdAt: new Date() },
          ...prev,
        ]);
        setEmail("");

        // Copy invite link
        const link = `${window.location.origin}/invite/${result.token}`;
        await navigator.clipboard.writeText(link);
        toast.success("Invite link copied to clipboard");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to send invitation";
        toast.error(msg);
      }
    });
  }

  function handleCancel(invitationId: string) {
    startTransition(async () => {
      try {
        await cancelInvitation(invitationId);
        setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
        toast.success("Invitation cancelled");
      } catch {
        toast.error("Failed to cancel invitation");
      }
    });
  }

  function copyLink(token: string) {
    const link = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(link);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  }

  const pendingInvitations = invitations.filter(
    (i) => new Date(i.expiresAt) > new Date()
  );
  const expiredInvitations = invitations.filter(
    (i) => new Date(i.expiresAt) <= new Date()
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-[var(--color-primary)]" />
            Invite Team Member
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleInvite} className="px-6 py-4 border-b border-gray-100">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email address
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="colleague@example.com"
                    className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                    required
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={isPending || !email.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50 shrink-0"
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  Invite
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                      role === r.value
                        ? "border-[var(--color-primary)] bg-[var(--color-primary-bg)] text-[var(--color-primary-dark)]"
                        : "border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <p className="font-medium">{r.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{r.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </form>

        {/* Pending invitations */}
        {pendingInvitations.length > 0 && (
          <div className="px-6 py-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Pending Invitations ({pendingInvitations.length})
            </h3>
            <div className="space-y-2">
              {pendingInvitations.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                >
                  <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">{inv.email}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Expires{" "}
                      {new Date(inv.expiresAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                      {" · "}
                      {inv.role.charAt(0) + inv.role.slice(1).toLowerCase()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCancel(inv.id)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    title="Cancel invitation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Note */}
        <div className="px-6 py-3 bg-gray-50 rounded-b-2xl">
          <p className="text-xs text-gray-500">
            The invite link will be copied to your clipboard. Share it with the person you&apos;re inviting. Links expire after 7 days.
          </p>
        </div>
      </div>
    </div>
  );
}
