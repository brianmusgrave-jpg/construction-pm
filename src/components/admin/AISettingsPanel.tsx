"use client";
/**
 * @file src/components/admin/AISettingsPanel.tsx
 * @description Admin panel tab for managing AI provider settings and viewing usage stats.
 *
 * Renders two sections:
 *   1. Configuration — provider selection, model, max tokens, daily budget, enable toggle
 *   2. Usage — last-7-day cost/token summary cards + a simple per-day table
 *
 * Props are fully serialised (no Dates) to satisfy RSC serialisation constraints.
 */

import { useState } from "react";
import { updateAISettings } from "@/actions/aiSettings";
import type { AISettingsData, AIUsageSummary } from "@/actions/aiSettings";

// ── Model catalogue ────────────────────────────────────────────────────────

/** Available models grouped by provider for the select dropdown. */
const MODEL_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  OPENAI: [
    { value: "gpt-4o-mini", label: "GPT-4o Mini (fast, cheap)" },
    { value: "gpt-4o", label: "GPT-4o (powerful)" },
    { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo (legacy)" },
  ],
  ANTHROPIC: [
    { value: "claude-3-haiku-20240307", label: "Claude 3 Haiku (fast, cheap)" },
    { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet (powerful)" },
    { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku (balanced)" },
  ],
};

// ── Props ──────────────────────────────────────────────────────────────────

interface AISettingsPanelProps {
  /** Current AI settings from the server. */
  settings: AISettingsData;
  /** Usage summary for the last 7 days. */
  usage: AIUsageSummary;
}

// ── Component ──────────────────────────────────────────────────────────────

/**
 * Admin panel tab for AI configuration and usage visibility.
 *
 * Handles optimistic UI — form fields update immediately while the server
 * action runs in the background. Errors are surfaced inline.
 */
export function AISettingsPanel({ settings, usage }: AISettingsPanelProps) {
  const [provider, setProvider] = useState<"OPENAI" | "ANTHROPIC">(settings.provider);
  const [model, setModel] = useState(settings.model);
  const [maxTokens, setMaxTokens] = useState(settings.maxTokens);
  const [dailyBudget, setDailyBudget] = useState(settings.dailyBudgetUsd);
  const [enabled, setEnabled] = useState(settings.enabled);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  /** When the provider changes, reset model to the first option for that provider. */
  function handleProviderChange(newProvider: "OPENAI" | "ANTHROPIC") {
    setProvider(newProvider);
    setModel(MODEL_OPTIONS[newProvider][0].value);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await updateAISettings(settings.id, {
        provider,
        model,
        maxTokens,
        dailyBudgetUsd: dailyBudget,
        enabled,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  const modelOptions = MODEL_OPTIONS[provider] ?? [];
  const successRatePct = Math.round(usage.successRate * 100);

  return (
    <div className="space-y-8">
      {/* ── Configuration ─────────────────────────────────────────────── */}
      <section>
        <h3 className="text-base font-semibold text-gray-900 mb-4">AI Configuration</h3>

        {/* Enable/disable master toggle */}
        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200 mb-6">
          <button
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              enabled ? "bg-blue-600" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <div>
            <p className="text-sm font-medium text-gray-900">
              {enabled ? "AI features enabled" : "AI features disabled"}
            </p>
            <p className="text-xs text-gray-500">
              {enabled
                ? "Voice transcription and semantic search are active."
                : "All AI-powered features are off. No API calls will be made."}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {/* Provider */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Provider
            </label>
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as "OPENAI" | "ANTHROPIC")}
              disabled={!enabled}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="OPENAI">OpenAI</option>
              <option value="ANTHROPIC">Anthropic</option>
            </select>
          </div>

          {/* Model */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Model
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={!enabled}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
            >
              {modelOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Max Tokens */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Tokens per Request
            </label>
            <input
              type="number"
              min={256}
              max={16000}
              step={256}
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value, 10) || 2000)}
              disabled={!enabled}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
            />
            <p className="mt-1 text-xs text-gray-400">Limits context window per AI call (256–16,000)</p>
          </div>

          {/* Daily Budget */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Daily Budget (USD)
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                $
              </span>
              <input
                type="number"
                min={0}
                max={1000}
                step={0.5}
                value={dailyBudget}
                onChange={(e) => setDailyBudget(parseFloat(e.target.value) || 0)}
                disabled={!enabled}
                className="block w-full rounded-md border border-gray-300 pl-7 pr-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
            <p className="mt-1 text-xs text-gray-400">AI calls stop if daily spend exceeds this limit</p>
          </div>
        </div>

        {/* Save button + feedback */}
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Settings"}
          </button>
          {saveSuccess && (
            <span className="text-sm text-green-600 font-medium">✓ Settings saved</span>
          )}
          {saveError && (
            <span className="text-sm text-red-600">{saveError}</span>
          )}
        </div>

        {/* API key reminder */}
        <div className="mt-4 rounded-md bg-amber-50 border border-amber-200 p-3">
          <p className="text-xs text-amber-700">
            <strong>API keys:</strong> Set{" "}
            <code className="font-mono">OPENAI_API_KEY</code> and/or{" "}
            <code className="font-mono">ANTHROPIC_API_KEY</code> in your Vercel environment variables.
            The selected provider&apos;s key must be present for AI features to work.
          </p>
        </div>
      </section>

      {/* ── Usage stats ───────────────────────────────────────────────── */}
      <section>
        <h3 className="text-base font-semibold text-gray-900 mb-4">
          Usage — Last 7 Days
        </h3>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
          <StatCard
            label="Total Cost"
            value={`$${usage.totalCostUsd.toFixed(4)}`}
            sub="USD"
          />
          <StatCard
            label="Total Tokens"
            value={usage.totalTokens.toLocaleString()}
            sub="tokens"
          />
          <StatCard
            label="API Calls"
            value={usage.totalCalls.toLocaleString()}
            sub="requests"
          />
          <StatCard
            label="Success Rate"
            value={`${successRatePct}%`}
            sub={`of ${usage.totalCalls} calls`}
          />
        </div>

        {/* Per-day breakdown */}
        {usage.byDay.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {["Date", "Calls", "Prompt Tokens", "Completion Tokens", "Cost (USD)"].map(
                    (col) => (
                      <th
                        key={col}
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
                      >
                        {col}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {usage.byDay.map((row) => (
                  <tr key={row.date} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-gray-700">{row.date}</td>
                    <td className="px-4 py-3 text-gray-600">{row.calls}</td>
                    <td className="px-4 py-3 text-gray-600">{row.promptTokens.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-600">{row.completionTokens.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-600">${row.costUsd.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">No AI usage recorded in the last 7 days.</p>
        )}
      </section>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

/**
 * Small summary card for a single metric.
 *
 * @param label - Card heading (e.g. "Total Cost")
 * @param value - Primary displayed value
 * @param sub   - Secondary label beneath the value
 */
function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-xl font-semibold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400">{sub}</p>
    </div>
  );
}
