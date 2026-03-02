"use client";

/**
 * @file components/dashboard/AIAssistantPanel.tsx
 * @description Sprint 24 — AI Assistant UI (#82–#84).
 *
 * Three-tab panel:
 *   1. Chat — conversational project assistant with action execution
 *   2. Alerts — proactive alerts for insurance, schedule, budget, compliance
 *   3. Actions — log of executed AI actions with status
 */

import { useState, useRef, useEffect, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  Bot,
  AlertTriangle,
  Zap,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  Shield,
  Clock,
  DollarSign,
  CloudRain,
  ChevronDown,
  RefreshCw,
  MessageSquare,
} from "lucide-react";
import {
  chatWithAssistant,
  generateProactiveAlerts,
} from "@/actions/ai-assistant";
import type {
  AssistantMessage,
  ExecutedAction,
  ProactiveAlert,
} from "@/actions/ai-assistant";

// ── Types ────────────────────────────────────────────────────────────────

interface Props {
  projects: { id: string; name: string }[];
}

type TabKey = "chat" | "alerts" | "actions";

// ── Severity / category styling ──────────────────────────────────────────

const SEV_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  critical: { bg: "bg-red-50 border-red-200", text: "text-red-700", icon: "text-red-500" },
  warning: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", icon: "text-amber-500" },
  info: { bg: "bg-blue-50 border-blue-200", text: "text-blue-700", icon: "text-blue-500" },
};

function CategoryIcon({ category }: { category: string }) {
  switch (category) {
    case "insurance": return <Shield className="w-4 h-4" />;
    case "schedule": return <Clock className="w-4 h-4" />;
    case "budget": return <DollarSign className="w-4 h-4" />;
    case "weather": return <CloudRain className="w-4 h-4" />;
    case "compliance": return <AlertTriangle className="w-4 h-4" />;
    default: return <AlertTriangle className="w-4 h-4" />;
  }
}

// ── Main Component ───────────────────────────────────────────────────────

export function AIAssistantPanel({ projects }: Props) {
  const t = useTranslations("assistant");
  const [activeTab, setActiveTab] = useState<TabKey>("chat");
  const [selectedProject, setSelectedProject] = useState(projects[0]?.id || "");

  // Chat state
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, startSending] = useTransition();
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Alerts state
  const [alerts, setAlerts] = useState<ProactiveAlert[] | null>(null);
  const [isLoadingAlerts, startAlerts] = useTransition();
  const [alertFilter, setAlertFilter] = useState<string>("all");

  // Actions log
  const [actionLog, setActionLog] = useState<ExecutedAction[]>([]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Chat handler ──

  function handleSend() {
    if (!input.trim() || !selectedProject) return;
    const userMsg: AssistantMessage = {
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    const currentInput = input.trim();
    setInput("");

    startSending(async () => {
      try {
        const history = messages.map((m) => ({ role: m.role, content: m.content }));
        const result: any = await chatWithAssistant(
          selectedProject, currentInput, history
        );
        const assistantMsg: AssistantMessage = {
          role: "assistant",
          content: result.reply,
          actions: result.actions?.length > 0 ? result.actions : undefined,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);

        // Add executed actions to the action log
        if (result.actions?.length > 0) {
          setActionLog((prev) => [...result.actions, ...prev]);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: t("error"),
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    });
  }

  // ── Alerts handler ──

  function loadAlerts() {
    startAlerts(async () => {
      try {
        const result: any = await generateProactiveAlerts();
        setAlerts(result.alerts || []);
      } catch {
        setAlerts([]);
      }
    });
  }

  const filteredAlerts = alerts?.filter(
    (a) => alertFilter === "all" || a.category === alertFilter
  );

  // ── Tabs config ──

  const tabs: { key: TabKey; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: "chat", label: t("tabChat"), icon: <MessageSquare className="w-4 h-4" /> },
    {
      key: "alerts",
      label: t("tabAlerts"),
      icon: <AlertTriangle className="w-4 h-4" />,
      count: alerts?.filter((a) => a.severity === "critical").length,
    },
    {
      key: "actions",
      label: t("tabActions"),
      icon: <Zap className="w-4 h-4" />,
      count: actionLog.length > 0 ? actionLog.length : undefined,
    },
  ];

  return (
    <section className="rounded-xl border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3 border-b bg-gradient-to-r from-violet-50 to-indigo-50">
        <Bot className="w-5 h-5 text-violet-600" />
        <h2 className="font-semibold text-gray-900">{t("title")}</h2>
        <span className="ml-auto text-xs text-gray-400">Sprint 24</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              if (tab.key === "alerts" && alerts === null) loadAlerts();
            }}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-violet-600 text-violet-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs font-bold rounded-full bg-red-100 text-red-700">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Project Selector (for chat tab) */}
      {activeTab === "chat" && (
        <div className="px-4 py-2 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">{t("project")}:</label>
            <div className="relative">
              <select
                value={selectedProject}
                onChange={(e) => {
                  setSelectedProject(e.target.value);
                  setMessages([]); // Reset chat on project switch
                }}
                className="appearance-none bg-white border rounded-md pl-2 pr-7 py-1 text-sm focus:ring-1 focus:ring-violet-300 focus:outline-none"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
      )}

      {/* ── Chat Tab ── */}
      {activeTab === "chat" && (
        <div className="flex flex-col" style={{ height: "420px" }}>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <Bot className="w-10 h-10 mx-auto mb-3 text-violet-300" />
                <p className="text-sm">{t("chatEmpty")}</p>
                <p className="text-xs mt-1 text-gray-300">{t("chatHint")}</p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-violet-600 text-white"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {/* Executed actions */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200 space-y-1">
                      {msg.actions.map((action, j) => (
                        <div
                          key={j}
                          className={`flex items-center gap-1.5 text-xs rounded px-2 py-1 ${
                            action.success
                              ? "bg-green-50 text-green-700"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          {action.success ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <XCircle className="w-3 h-3" />
                          )}
                          <span>{action.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isSending && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg px-3 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="border-t px-4 py-3 bg-gray-50">
            <form
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t("inputPlaceholder")}
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-violet-300 focus:outline-none"
                disabled={isSending || !selectedProject}
              />
              <button
                type="submit"
                disabled={isSending || !input.trim() || !selectedProject}
                className="px-3 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Alerts Tab ── */}
      {activeTab === "alerts" && (
        <div className="p-4" style={{ maxHeight: "420px", overflowY: "auto" }}>
          {/* Filter bar */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex gap-1 flex-wrap">
              {["all", "insurance", "schedule", "budget", "compliance"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setAlertFilter(cat)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    alertFilter === cat
                      ? "bg-violet-100 text-violet-700"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {t(`filter_${cat}`)}
                </button>
              ))}
            </div>
            <button
              onClick={loadAlerts}
              disabled={isLoadingAlerts}
              className="ml-auto p-1.5 rounded hover:bg-gray-100 text-gray-400"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingAlerts ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Alerts list */}
          {isLoadingAlerts && !alerts && (
            <div className="text-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-violet-500 mx-auto" />
              <p className="text-sm text-gray-400 mt-2">{t("loadingAlerts")}</p>
            </div>
          )}

          {alerts && filteredAlerts && filteredAlerts.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-400" />
              <p className="text-sm">{t("noAlerts")}</p>
            </div>
          )}

          {filteredAlerts && filteredAlerts.length > 0 && (
            <div className="space-y-2">
              {filteredAlerts.map((alert) => {
                const sev = SEV_STYLES[alert.severity] || SEV_STYLES.info;
                return (
                  <div
                    key={alert.id}
                    className={`border rounded-lg p-3 ${sev.bg}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`mt-0.5 ${sev.icon}`}>
                        <CategoryIcon category={alert.category} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${sev.text}`}>
                            {alert.title}
                          </span>
                          <span className="text-xs text-gray-400">
                            {alert.projectName}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5">
                          {alert.description}
                        </p>
                        <p className="text-xs text-gray-500 mt-1 italic">
                          {alert.recommendation}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Actions Tab ── */}
      {activeTab === "actions" && (
        <div className="p-4" style={{ maxHeight: "420px", overflowY: "auto" }}>
          {actionLog.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Zap className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">{t("noActions")}</p>
              <p className="text-xs mt-1 text-gray-300">{t("noActionsHint")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {actionLog.map((action, i) => (
                <div
                  key={i}
                  className={`border rounded-lg p-3 ${
                    action.success
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {action.success ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className="text-sm font-medium text-gray-800">
                      {action.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 ml-6">
                    {action.detail}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
