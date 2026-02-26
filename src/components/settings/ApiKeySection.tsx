"use client";

/**
 * @file ApiKeySection.tsx
 * @description API key management panel for the settings page. Allows users to create
 * named API keys with optional expiry dates. New key values are shown once in an amber
 * one-time banner with a clipboard copy button (Check/Copy toggle). Existing keys
 * display their prefix, creation date, last-used date, expiry, and Revoked/Expired
 * status badges. Individual keys can be revoked (ToggleRight) or permanently deleted.
 * Server actions: createApiKey, revokeApiKey, deleteApiKey.
 */

import { useState } from "react";
import {
  Key,
  Plus,
  Loader2,
  AlertCircle,
  X,
  Copy,
  Check,
  Trash2,
  ToggleRight,
  Clock,
  Eye,
  EyeOff,
} from "lucide-react";
import { createApiKey, revokeApiKey, deleteApiKey } from "@/actions/api-keys";
import type { ApiKey } from "@/lib/db-types";

interface ApiKeySectionProps {
  apiKeys: ApiKey[];
}

export function ApiKeySection({ apiKeys }: ApiKeySectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ name: "", expiresAt: "" });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await createApiKey(form.name.trim(), form.expiresAt || undefined);
      setNewKey(res.key);
      setForm({ name: "", expiresAt: "" });
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create key");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleRevoke = async (id: string) => {
    setActionId(id);
    try { await revokeApiKey(id); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setActionId(null); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Permanently delete this API key?")) return;
    setActionId(id);
    try { await deleteApiKey(id); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setActionId(null); }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2">
          <Key className="w-4 h-4 text-[var(--color-primary)]" />
          API Keys
          <span className="text-xs font-normal text-gray-400 normal-case">
            ({apiKeys.filter((k) => k.active).length} active)
          </span>
        </h2>
        <button onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-dark)]">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Key</span>
        </button>
      </div>

      {error && (
        <div className="mb-3 flex items-center gap-2 p-2.5 bg-red-50 text-red-700 text-sm rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" /><span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {newKey && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs font-semibold text-amber-800 mb-1.5">⚠ Copy this key now — it will not be shown again:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-white border border-amber-200 rounded px-2 py-1.5 truncate font-mono">{newKey}</code>
            <button onClick={() => handleCopy(newKey)} className="shrink-0 p-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <button onClick={() => setNewKey(null)} className="text-xs text-amber-700 mt-1.5 hover:text-amber-900">Dismiss</button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">Key Name *</label>
              <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Production Integration"
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Expiry (optional)</label>
              <input type="date" value={form.expiresAt} onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)]" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-md">Cancel</button>
            <button type="submit" disabled={submitting}
              className="px-4 py-1.5 text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] rounded-md disabled:opacity-60 inline-flex items-center gap-1.5">
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Generate Key
            </button>
          </div>
        </form>
      )}

      {apiKeys.length === 0 && !showForm ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
          <Key className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No API keys yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {apiKeys.map((key) => {
            const expired = key.expiresAt && new Date(key.expiresAt) < new Date();
            return (
              <div key={key.id} className={`flex items-center gap-3 p-3 border rounded-lg ${!key.active || expired ? "opacity-60 border-gray-100" : "border-gray-200"}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{key.name}</span>
                    <code className="text-xs text-gray-400 font-mono">{key.prefix}…</code>
                    {!key.active && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Revoked</span>}
                    {expired && <span className="text-xs bg-red-50 text-red-500 px-1.5 py-0.5 rounded">Expired</span>}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-3">
                    <span>Created {new Date(key.createdAt).toLocaleDateString()}</span>
                    {key.lastUsedAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Used {new Date(key.lastUsedAt).toLocaleDateString()}
                      </span>
                    )}
                    {key.expiresAt && !expired && (
                      <span>Expires {new Date(key.expiresAt).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {key.active && !expired && (
                    <button onClick={() => handleRevoke(key.id)} disabled={actionId === key.id}
                      title="Revoke" className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded">
                      {actionId === key.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ToggleRight className="w-3.5 h-3.5" />}
                    </button>
                  )}
                  <button onClick={() => handleDelete(key.id)} disabled={actionId === key.id}
                    className="p-1.5 text-gray-300 hover:text-red-500">
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
