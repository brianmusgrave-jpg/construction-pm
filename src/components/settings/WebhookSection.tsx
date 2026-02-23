"use client";

import { useState } from "react";
import {
  Zap,
  Plus,
  Loader2,
  AlertCircle,
  X,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { createWebhook, toggleWebhook, deleteWebhook } from "@/actions/webhooks";
import { WEBHOOK_EVENTS } from "@/lib/webhook-events";
import type { Webhook } from "@/lib/db-types";

interface WebhookSectionProps {
  webhooks: Webhook[];
}

export function WebhookSection({ webhooks }: WebhookSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", url: "", events: [] as string[] });

  const toggleEvent = (ev: string) => {
    setForm((f) => ({
      ...f,
      events: f.events.includes(ev) ? f.events.filter((e) => e !== ev) : [...f.events, ev],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.url || form.events.length === 0) {
      setError("Fill in all fields and select at least one event");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createWebhook({ name: form.name.trim(), url: form.url, events: form.events });
      setForm({ name: "", url: "", events: [] });
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create webhook");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (wh: Webhook) => {
    setActionId(wh.id);
    try { await toggleWebhook(wh.id, !wh.active); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setActionId(null); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this webhook?")) return;
    setActionId(id);
    try { await deleteWebhook(id); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setActionId(null); }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2">
          <Zap className="w-4 h-4 text-[var(--color-primary)]" />
          Webhooks
          <span className="text-xs font-normal text-gray-400 normal-case">
            ({webhooks.filter((w) => w.active).length} active)
          </span>
        </h2>
        <button onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-dark)]">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Webhook</span>
        </button>
      </div>

      {error && (
        <div className="mb-3 flex items-center gap-2 p-2.5 bg-red-50 text-red-700 text-sm rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" /><span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
              <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Slack notifications"
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">HTTPS URL *</label>
              <input required type="url" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://hooks.example.com/..."
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)]" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Events *</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {WEBHOOK_EVENTS.map((ev) => (
                <label key={ev} className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer text-xs border ${form.events.includes(ev) ? "bg-[var(--color-primary-bg)] border-[var(--color-primary)] text-[var(--color-primary)]" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                  <input type="checkbox" checked={form.events.includes(ev)} onChange={() => toggleEvent(ev)} className="sr-only" />
                  {ev}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-md">Cancel</button>
            <button type="submit" disabled={submitting}
              className="px-4 py-1.5 text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] rounded-md disabled:opacity-60 inline-flex items-center gap-1.5">
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Create Webhook
            </button>
          </div>
        </form>
      )}

      {webhooks.length === 0 && !showForm ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
          <Zap className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No webhooks configured</p>
        </div>
      ) : (
        <div className="space-y-2">
          {webhooks.map((wh) => (
            <div key={wh.id} className={`border rounded-lg p-3 ${!wh.active ? "opacity-60 border-gray-100" : "border-gray-200"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{wh.name}</span>
                    {!wh.active && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Paused</span>}
                    {wh.lastStatusCode != null && (
                      wh.lastStatusCode >= 200 && wh.lastStatusCode < 300
                        ? <span title={`Last: ${wh.lastStatusCode}`}><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /></span>
                        : <span title={`Last: ${wh.lastStatusCode}`}><XCircle className="w-3.5 h-3.5 text-red-500" /></span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 font-mono mt-0.5 truncate max-w-xs">{wh.url}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex flex-wrap gap-1">
                      {wh.events.slice(0, 3).map((ev) => (
                        <span key={ev} className="text-[10px] bg-gray-100 text-gray-500 px-1 py-0.5 rounded">{ev}</span>
                      ))}
                      {wh.events.length > 3 && <span className="text-[10px] text-gray-400">+{wh.events.length - 3} more</span>}
                    </div>
                  </div>
                  {wh.lastTriggeredAt && (
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Triggered {new Date(wh.lastTriggeredAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => handleToggle(wh)} disabled={actionId === wh.id}
                    title={wh.active ? "Pause" : "Resume"}
                    className="p-1.5 text-gray-400 hover:text-[var(--color-primary)]">
                    {actionId === wh.id ? <Loader2 className="w-4 h-4 animate-spin" /> :
                      wh.active ? <ToggleRight className="w-4 h-4 text-green-500" /> : <ToggleLeft className="w-4 h-4" />}
                  </button>
                  <button onClick={() => handleDelete(wh.id)} disabled={actionId === wh.id}
                    className="p-1.5 text-gray-300 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
