"use client";

import { useState } from "react";
import {
  Mail,
  Plus,
  Loader2,
  AlertCircle,
  X,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Clock,
  Calendar,
} from "lucide-react";
import {
  createReportSchedule,
  toggleReportSchedule,
  deleteReportSchedule,
} from "@/actions/report-schedules";
import type { ReportSchedule, ReportFrequency } from "@/lib/db-types";

interface ReportScheduleSectionProps {
  schedules: ReportSchedule[];
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i % 12 === 0 ? 12 : i % 12;
  const ampm = i < 12 ? "AM" : "PM";
  return { value: i, label: `${h}:00 ${ampm} UTC` };
});

export function ReportScheduleSection({ schedules }: ReportScheduleSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recipientInput, setRecipientInput] = useState("");
  const [form, setForm] = useState({
    frequency: "WEEKLY" as ReportFrequency,
    dayOfWeek: 1,
    dayOfMonth: 1,
    sendHour: 8,
    recipients: [] as string[],
  });

  const addRecipient = () => {
    const email = recipientInput.trim().toLowerCase();
    if (!email || !email.includes("@")) return;
    if (!form.recipients.includes(email)) {
      setForm((f) => ({ ...f, recipients: [...f.recipients, email] }));
    }
    setRecipientInput("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.recipients.length === 0) {
      setError("Add at least one recipient email");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createReportSchedule({
        frequency: form.frequency,
        dayOfWeek: form.frequency === "WEEKLY" ? form.dayOfWeek : undefined,
        dayOfMonth: form.frequency === "MONTHLY" ? form.dayOfMonth : undefined,
        sendHour: form.sendHour,
        recipients: form.recipients,
      });
      setForm({ frequency: "WEEKLY", dayOfWeek: 1, dayOfMonth: 1, sendHour: 8, recipients: [] });
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create schedule");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (schedule: ReportSchedule) => {
    setActionId(schedule.id);
    try {
      await toggleReportSchedule(schedule.id, !schedule.active);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this report schedule?")) return;
    setActionId(id);
    try {
      await deleteReportSchedule(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setActionId(null);
    }
  };

  function describeSchedule(s: ReportSchedule) {
    const hour = HOURS[s.sendHour]?.label ?? `${s.sendHour}:00 UTC`;
    if (s.frequency === "WEEKLY") {
      return `Every ${DAYS[s.dayOfWeek ?? 1]} at ${hour}`;
    }
    return `Monthly on day ${s.dayOfMonth ?? 1} at ${hour}`;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2">
          <Mail className="w-4 h-4 text-[var(--color-primary)]" />
          Automated Reports
          <span className="text-xs font-normal text-gray-400 normal-case">
            ({schedules.filter((s) => s.active).length} active)
          </span>
        </h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-dark)]"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Schedule</span>
        </button>
      </div>

      {error && (
        <div className="mb-3 flex items-center gap-2 p-2.5 bg-red-50 text-red-700 text-sm rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3 text-sm">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Frequency</label>
              <select
                value={form.frequency}
                onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value as ReportFrequency }))}
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)]"
              >
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </div>
            {form.frequency === "WEEKLY" ? (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Day of Week</label>
                <select
                  value={form.dayOfWeek}
                  onChange={(e) => setForm((f) => ({ ...f, dayOfWeek: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)]"
                >
                  {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Day of Month</label>
                <input
                  type="number"
                  min="1"
                  max="28"
                  value={form.dayOfMonth}
                  onChange={(e) => setForm((f) => ({ ...f, dayOfMonth: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)]"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Send Time</label>
              <select
                value={form.sendHour}
                onChange={(e) => setForm((f) => ({ ...f, sendHour: Number(e.target.value) }))}
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)]"
              >
                {HOURS.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Recipients</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRecipient(); } }}
                placeholder="email@example.com"
                className="flex-1 border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)]"
              />
              <button
                type="button"
                onClick={addRecipient}
                className="px-3 py-1.5 text-sm text-[var(--color-primary)] border border-[var(--color-primary)] rounded-md hover:bg-[var(--color-primary-bg)]"
              >
                Add
              </button>
            </div>
            {form.recipients.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.recipients.map((r) => (
                  <span key={r} className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                    {r}
                    <button type="button" onClick={() => setForm((f) => ({ ...f, recipients: f.recipients.filter((x) => x !== r) }))}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-md">Cancel</button>
            <button type="submit" disabled={submitting}
              className="px-4 py-1.5 text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] rounded-md disabled:opacity-60 inline-flex items-center gap-1.5">
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Schedule
            </button>
          </div>
        </form>
      )}

      {schedules.length === 0 && !showForm ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
          <Mail className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No automated reports configured</p>
        </div>
      ) : (
        <div className="space-y-2">
          {schedules.map((s) => (
            <div key={s.id} className={`flex items-center gap-3 p-3 border rounded-lg ${!s.active ? "opacity-60 border-gray-100" : "border-gray-200"}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className="text-sm font-medium text-gray-900">{describeSchedule(s)}</span>
                  {!s.active && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Paused</span>}
                </div>
                <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-3">
                  <span>{s.recipients.length} recipient{s.recipients.length !== 1 ? "s" : ""}: {s.recipients.slice(0, 2).join(", ")}{s.recipients.length > 2 ? ` +${s.recipients.length - 2}` : ""}</span>
                  {s.lastSentAt && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Last sent {new Date(s.lastSentAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleToggle(s)}
                  disabled={actionId === s.id}
                  title={s.active ? "Pause" : "Resume"}
                  className="p-1.5 text-gray-400 hover:text-[var(--color-primary)]"
                >
                  {actionId === s.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : s.active ? (
                    <ToggleRight className="w-4 h-4 text-green-500" />
                  ) : (
                    <ToggleLeft className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  disabled={actionId === s.id}
                  className="p-1.5 text-gray-300 hover:text-red-500"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
