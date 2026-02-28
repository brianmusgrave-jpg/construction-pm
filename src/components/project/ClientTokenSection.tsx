"use client";

/**
 * @file components/project/ClientTokenSection.tsx
 * @description Read-only client portal link management for a project.
 *
 * Each token generates a public URL at `${origin}/client/[token]` that gives
 * unauthenticated visitors a read-only view of project status, phases, and progress.
 *
 * Key behaviours:
 *   - Create: form accepts a required `label` and optional `expiresAt` date.
 *     On success `newToken` state is set, showing a green banner with the full URL
 *     and a clipboard copy button (2-second "copied" confirmation state).
 *   - Token list: each row shows label, expiry date, and status badges:
 *       "Revoked" (bg-gray-100)  when `!token.active`
 *       "Expired" (bg-red-50)    when `token.expiresAt < new Date()`
 *     Active, non-expired tokens show Copy / ExternalLink / Revoke (ToggleRight) icons.
 *   - Revoke: calls `revokeClientToken(token.id, projectId)` — sets `active = false`.
 *   - Delete: permanent; requires confirm() dialog.
 *   - `actionId` prevents concurrent actions on the same token row.
 *
 * Server actions: `createClientToken`, `revokeClientToken`, `deleteClientToken`.
 */

import { useState } from "react";
import {
  Eye,
  Plus,
  Loader2,
  AlertCircle,
  X,
  Copy,
  Check,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Calendar,
  ExternalLink,
} from "lucide-react";
import { createClientToken, revokeClientToken, deleteClientToken } from "@/actions/client-tokens";
import type { ClientToken } from "@/lib/db-types";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";

interface ClientTokenSectionProps {
  projectId: string;
  tokens: ClientToken[];
}

export function ClientTokenSection({ projectId, tokens }: ClientTokenSectionProps) {
  const confirm = useConfirmDialog();
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ label: "", expiresAt: "" });

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.label.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const ct = await createClientToken({
        projectId,
        label: form.label.trim(),
        expiresAt: form.expiresAt || undefined,
      });
      setNewToken(ct.token);
      setForm({ label: "", expiresAt: "" });
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create link");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleRevoke = async (token: ClientToken) => {
    setActionId(token.id);
    try {
      await revokeClientToken(token.id, projectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke");
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (tokenId: string) => {
    if (!await confirm("Delete this client link permanently?", { danger: true })) return;
    setActionId(tokenId);
    try {
      await deleteClientToken(tokenId, projectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2">
          <Eye className="w-4 h-4 text-[var(--color-primary)]" />
          Client Portal Links
          <span className="text-xs font-normal text-gray-400 normal-case">
            ({tokens.filter((t) => t.active).length} active)
          </span>
        </h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-dark)]"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Link</span>
        </button>
      </div>

      {error && (
        <div className="mb-3 flex items-center gap-2 p-2.5 bg-red-50 text-red-700 text-sm rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* New token created — show URL */}
      {newToken && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs font-medium text-green-800 mb-1.5">✓ Client portal link created! Copy and share it:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-white border border-green-200 rounded px-2 py-1.5 truncate">
              {`${baseUrl}/client/${newToken}`}
            </code>
            <button
              onClick={() => handleCopy(`${baseUrl}/client/${newToken}`)}
              className="shrink-0 p-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <button
            onClick={() => setNewToken(null)}
            className="text-xs text-green-600 hover:text-green-800 mt-1.5"
          >
            Dismiss
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">Label *</label>
              <input
                required
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Client – Smith Family"
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                <Calendar className="w-3 h-3 inline mr-1" />Expires (optional)
              </label>
              <input
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            The link gives read-only access to project status, phases, and progress. No login required.
          </p>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] rounded-md disabled:opacity-60 inline-flex items-center gap-1.5"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Generate Link
            </button>
          </div>
        </form>
      )}

      {tokens.length === 0 && !showForm ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
          <Eye className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No client links yet</p>
          <p className="text-xs text-gray-400 mt-1">Generate a link to share a read-only project view with clients</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tokens.map((token) => {
            const url = `${baseUrl}/client/${token.token}`;
            const expired = token.expiresAt && new Date(token.expiresAt) < new Date();
            return (
              <div
                key={token.id}
                className={`flex items-center gap-3 p-3 border rounded-lg ${
                  !token.active || expired ? "border-gray-100 opacity-60" : "border-gray-200"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{token.label}</span>
                    {!token.active && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">Revoked</span>
                    )}
                    {expired && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-500">Expired</span>
                    )}
                  </div>
                  {token.expiresAt && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Expires {new Date(token.expiresAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {token.active && !expired && (
                    <>
                      <button
                        onClick={() => handleCopy(url)}
                        title="Copy link"
                        className="p-1.5 text-gray-400 hover:text-[var(--color-primary)] hover:bg-gray-100 rounded"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open portal"
                        className="p-1.5 text-gray-400 hover:text-[var(--color-primary)] hover:bg-gray-100 rounded"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => handleRevoke(token)}
                        disabled={actionId === token.id}
                        title="Revoke access"
                        className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded"
                      >
                        {actionId === token.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ToggleRight className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleDelete(token.id)}
                    disabled={actionId === token.id}
                    className="p-1.5 text-gray-300 hover:text-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
