"use client";

/**
 * @file components/dashboard/InsightsPanel.tsx
 * @description Sprint 23 — AI Proactive Insights Panel (#75–#81).
 *
 * Tabbed card on the dashboard that surfaces AI-generated insights:
 *   - Morning Digest (#77) — cross-project daily overview
 *   - Schedule Risk (#78) — per-phase risk scoring
 *   - Budget Trend (#79) — spend forecast and recommendations
 *   - Stakeholder Update (#75) — weekly progress report
 *   - Meeting Prep (#76) — pre-meeting brief
 *   - Weather Impact (#80) — schedule weather risk
 *   - CO Patterns (#81) — change order pattern detection
 *
 * Each tab calls its server action on-demand (lazy load) and caches
 * the result in component state to avoid re-fetching on tab switch.
 *
 * i18n namespace: `insights`.
 */

import { useState, useCallback, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  Sparkles,
  Sun,
  AlertTriangle,
  TrendingUp,
  FileText,
  Calendar,
  CloudRain,
  FileStack,
  Loader2,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  RefreshCw,
} from "lucide-react";
import {
  generateMorningDigest,
  analyzeScheduleRisk,
  predictBudgetTrend,
  generateStakeholderUpdate,
  generateMeetingPrepBrief,
  forecastWeatherImpact,
  detectCOPatterns,
} from "@/actions/ai-insights";

/* ── Types ────────────────────────────────────────────────────────────── */

type TabId =
  | "digest"
  | "scheduleRisk"
  | "budget"
  | "stakeholder"
  | "meeting"
  | "weather"
  | "coPatterns";

interface TabDef {
  id: TabId;
  icon: React.ReactNode;
  labelKey: string;
  /** Requires projectId (false = cross-project) */
  needsProject: boolean;
}

/* ── Component ────────────────────────────────────────────────────────── */

interface InsightsPanelProps {
  /** Available projects for project-scoped insights */
  projects: Array<{ id: string; name: string }>;
}

export function InsightsPanel({ projects }: InsightsPanelProps) {
  const t = useTranslations("insights");
  const [activeTab, setActiveTab] = useState<TabId>("digest");
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    projects[0]?.id ?? ""
  );
  const [results, setResults] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  const iconCls = "w-4 h-4";
  const tabs: TabDef[] = [
    { id: "digest", icon: <Sun className={iconCls} />, labelKey: "digest", needsProject: false },
    { id: "scheduleRisk", icon: <AlertTriangle className={iconCls} />, labelKey: "scheduleRisk", needsProject: true },
    { id: "budget", icon: <TrendingUp className={iconCls} />, labelKey: "budgetTrend", needsProject: true },
    { id: "stakeholder", icon: <FileText className={iconCls} />, labelKey: "stakeholderUpdate", needsProject: true },
    { id: "meeting", icon: <Calendar className={iconCls} />, labelKey: "meetingPrep", needsProject: true },
    { id: "weather", icon: <CloudRain className={iconCls} />, labelKey: "weatherImpact", needsProject: true },
    { id: "coPatterns", icon: <FileStack className={iconCls} />, labelKey: "coPatterns", needsProject: true },
  ];

  const activeTabDef = tabs.find((t) => t.id === activeTab)!;
  const cacheKey = activeTabDef.needsProject
    ? `${activeTab}:${selectedProjectId}`
    : activeTab;

  const runInsight = useCallback(() => {
    setErrors((prev) => ({ ...prev, [cacheKey]: "" }));
    startTransition(async () => {
      try {
        let data: any;
        switch (activeTab) {
          case "digest":
            data = await generateMorningDigest();
            break;
          case "scheduleRisk":
            data = await analyzeScheduleRisk(selectedProjectId);
            break;
          case "budget":
            data = await predictBudgetTrend(selectedProjectId);
            break;
          case "stakeholder":
            data = await generateStakeholderUpdate(selectedProjectId);
            break;
          case "meeting":
            data = await generateMeetingPrepBrief(selectedProjectId);
            break;
          case "weather":
            data = await forecastWeatherImpact(selectedProjectId);
            break;
          case "coPatterns":
            data = await detectCOPatterns(selectedProjectId);
            break;
        }
        setResults((prev) => ({ ...prev, [cacheKey]: data }));
      } catch (err: any) {
        setErrors((prev) => ({
          ...prev,
          [cacheKey]: err?.message || t("errorGeneric"),
        }));
      }
    });
  }, [activeTab, selectedProjectId, cacheKey, t]);

  const currentResult = results[cacheKey];
  const currentError = errors[cacheKey];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          {t("title")}
        </h2>
        {currentResult && (
          <button
            onClick={runInsight}
            disabled={isPending}
            className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isPending ? "animate-spin" : ""}`} />
            {t("refresh")}
          </button>
        )}
      </div>

      {/* Tab Row */}
      <div className="flex gap-1 px-4 pt-3 pb-2 overflow-x-auto border-b border-gray-100">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? "bg-indigo-100 text-indigo-700"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            }`}
          >
            {tab.icon}
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Project Selector (for project-scoped tabs) */}
      {activeTabDef.needsProject && projects.length > 1 && (
        <div className="px-5 pt-3">
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-50 text-gray-700 w-full max-w-xs"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Content Area */}
      <div className="p-5 min-h-[200px]">
        {isPending ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
            <p className="text-xs text-gray-400">{t("generating")}</p>
          </div>
        ) : currentError ? (
          <div className="text-center py-10">
            <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto mb-2" />
            <p className="text-xs text-red-500">{currentError}</p>
            <button
              onClick={runInsight}
              className="text-xs text-indigo-600 hover:underline mt-2"
            >
              {t("tryAgain")}
            </button>
          </div>
        ) : currentResult ? (
          <InsightContent tab={activeTab} data={currentResult} t={t} />
        ) : (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Sparkles className="w-8 h-8 text-indigo-200" />
            <p className="text-sm text-gray-500">{t("clickGenerate")}</p>
            <button
              onClick={runInsight}
              disabled={isPending || (activeTabDef.needsProject && !selectedProjectId)}
              className="px-4 py-2 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {t("generate")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Insight Renderers ──────────────────────────────────────────────── */

function InsightContent({
  tab,
  data,
  t,
}: {
  tab: TabId;
  data: any;
  t: (key: string, values?: Record<string, any>) => string;
}) {
  switch (tab) {
    case "digest":
      return <DigestView data={data} t={t} />;
    case "scheduleRisk":
      return <ScheduleRiskView data={data} t={t} />;
    case "budget":
      return <BudgetView data={data} t={t} />;
    case "stakeholder":
      return <StakeholderView data={data} t={t} />;
    case "meeting":
      return <MeetingView data={data} t={t} />;
    case "weather":
      return <WeatherView data={data} t={t} />;
    case "coPatterns":
      return <COPatternsView data={data} t={t} />;
    default:
      return null;
  }
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
      {children}
    </h3>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (!items?.length) return null;
  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
          <ChevronRight className="w-3 h-3 text-indigo-400 mt-1 shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function RiskBadge({ score }: { score: number }) {
  const color =
    score >= 70
      ? "bg-red-100 text-red-700"
      : score >= 40
      ? "bg-amber-100 text-amber-700"
      : "bg-green-100 text-green-700";
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>
      {score}/100
    </span>
  );
}

/* ── #77 Morning Digest ───────────────────────────────────────────── */

function DigestView({ data, t }: { data: any; t: any }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-700">{data.overview}</p>
      {data.projects?.map((p: any, i: number) => (
        <div key={i} className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-900">{p.name}</span>
            <span className="text-xs text-gray-500">{p.progress}</span>
          </div>
          <p className="text-xs text-gray-600">{p.summary}</p>
        </div>
      ))}
      {data.topPriorities?.length > 0 && (
        <div>
          <SectionLabel>{t("priorities")}</SectionLabel>
          <BulletList items={data.topPriorities} />
        </div>
      )}
      {data.alerts?.length > 0 && (
        <div>
          <SectionLabel>{t("alerts")}</SectionLabel>
          <BulletList items={data.alerts} />
        </div>
      )}
    </div>
  );
}

/* ── #78 Schedule Risk ────────────────────────────────────────────── */

function ScheduleRiskView({ data, t }: { data: any; t: any }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <SectionLabel>{t("overallRisk")}</SectionLabel>
        <RiskBadge score={data.overallRisk ?? 0} />
      </div>
      <p className="text-sm text-gray-700">{data.summary}</p>
      {data.phaseRisks?.map((pr: any, i: number) => (
        <div key={i} className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-900">{pr.phaseName}</span>
            <RiskBadge score={pr.riskScore ?? 0} />
          </div>
          <BulletList items={pr.factors || []} />
          {pr.mitigation && (
            <p className="text-xs text-indigo-600 mt-1">{pr.mitigation}</p>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── #79 Budget Trend ─────────────────────────────────────────────── */

function BudgetView({ data, t }: { data: any; t: any }) {
  const trendIcon =
    data.trend === "over_budget" ? (
      <ArrowUpRight className="w-4 h-4 text-red-500" />
    ) : data.trend === "under_budget" ? (
      <ArrowDownRight className="w-4 h-4 text-green-500" />
    ) : (
      <Minus className="w-4 h-4 text-gray-400" />
    );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500">{t("totalBudget")}</p>
          <p className="text-lg font-bold text-gray-900">{data.totalBudget}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500">{t("spentToDate")}</p>
          <p className="text-lg font-bold text-gray-900">{data.spentToDate}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500">{t("forecast")}</p>
          <p className="text-lg font-bold text-gray-900 flex items-center justify-center gap-1">
            {trendIcon} {data.forecastAtCompletion}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-500">{t("burnRate")}:</span>
        <span className="font-medium">{data.burnRate}</span>
        <span className="text-gray-300">|</span>
        <span className="text-gray-500">{t("variance")}:</span>
        <span className="font-medium">{data.variance}</span>
      </div>
      <p className="text-sm text-gray-700">{data.analysis}</p>
      {data.recommendations?.length > 0 && (
        <div>
          <SectionLabel>{t("recommendations")}</SectionLabel>
          <BulletList items={data.recommendations} />
        </div>
      )}
    </div>
  );
}

/* ── #75 Stakeholder Update ───────────────────────────────────────── */

function StakeholderView({ data, t }: { data: any; t: any }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-700">{data.summary}</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {data.metrics && (
          <>
            <MiniMetric label={t("phasesCompleted")} value={data.metrics.phasesCompleted} />
            <MiniMetric label={t("inProgress")} value={data.metrics.phasesInProgress} />
            <MiniMetric label={t("budgetSpent")} value={data.metrics.budgetSpent} />
            <MiniMetric label={t("overallProgress")} value={data.metrics.overallProgress} />
          </>
        )}
      </div>
      {data.highlights?.length > 0 && (
        <div>
          <SectionLabel>{t("highlights")}</SectionLabel>
          <BulletList items={data.highlights} />
        </div>
      )}
      {data.risks?.length > 0 && (
        <div>
          <SectionLabel>{t("risks")}</SectionLabel>
          <BulletList items={data.risks} />
        </div>
      )}
      {data.nextWeekPriorities?.length > 0 && (
        <div>
          <SectionLabel>{t("nextWeek")}</SectionLabel>
          <BulletList items={data.nextWeekPriorities} />
        </div>
      )}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-gray-50 rounded-lg p-2 text-center">
      <p className="text-lg font-bold text-gray-900">{value ?? "–"}</p>
      <p className="text-[10px] text-gray-500">{label}</p>
    </div>
  );
}

/* ── #76 Meeting Prep ─────────────────────────────────────────────── */

function MeetingView({ data, t }: { data: any; t: any }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-700">{data.projectSnapshot}</p>
      {data.suggestedAgenda?.length > 0 && (
        <div>
          <SectionLabel>{t("suggestedAgenda")}</SectionLabel>
          <ol className="space-y-1">
            {data.suggestedAgenda.map((item: string, i: number) => (
              <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-xs font-bold text-indigo-500 mt-0.5">{i + 1}.</span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {data.decisionsNeeded?.length > 0 && (
        <div>
          <SectionLabel>{t("decisionsNeeded")}</SectionLabel>
          <BulletList items={data.decisionsNeeded} />
        </div>
      )}
      {data.openIssues?.length > 0 && (
        <div>
          <SectionLabel>{t("openIssues")}</SectionLabel>
          <BulletList items={data.openIssues} />
        </div>
      )}
      {data.talkingPoints?.length > 0 && (
        <div>
          <SectionLabel>{t("talkingPoints")}</SectionLabel>
          <BulletList items={data.talkingPoints} />
        </div>
      )}
    </div>
  );
}

/* ── #80 Weather Impact ───────────────────────────────────────────── */

function WeatherView({ data, t }: { data: any; t: any }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <SectionLabel>{t("delayRisk")}</SectionLabel>
        <RiskBadge score={data.delayRiskScore ?? 0} />
      </div>
      <p className="text-sm text-gray-700">{data.summary}</p>
      {data.affectedPhases?.length > 0 && (
        <div>
          <SectionLabel>{t("affectedPhases")}</SectionLabel>
          {data.affectedPhases.map((ap: any, i: number) => (
            <div key={i} className="bg-gray-50 rounded-lg p-3 mb-2">
              <span className="text-sm font-medium text-gray-900">{ap.phaseName}</span>
              <p className="text-xs text-gray-600 mt-0.5">{ap.impact}</p>
            </div>
          ))}
        </div>
      )}
      {data.recommendations?.length > 0 && (
        <div>
          <SectionLabel>{t("recommendations")}</SectionLabel>
          <BulletList items={data.recommendations} />
        </div>
      )}
    </div>
  );
}

/* ── #81 CO Pattern Detection ─────────────────────────────────────── */

function COPatternsView({ data, t }: { data: any; t: any }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-700">{data.summary}</p>
      {data.patterns?.length > 0 && (
        <div>
          <SectionLabel>{t("patternsFound")}</SectionLabel>
          {data.patterns.map((pat: any, i: number) => (
            <div key={i} className="bg-gray-50 rounded-lg p-3 mb-2">
              <span className="text-sm font-medium text-gray-900">{pat.pattern}</span>
              <p className="text-xs text-gray-600 mt-0.5">{pat.description}</p>
              {pat.frequency && (
                <p className="text-[10px] text-gray-400 mt-1">
                  {t("frequency")}: {pat.frequency}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      {data.riskFactors?.length > 0 && (
        <div>
          <SectionLabel>{t("riskFactors")}</SectionLabel>
          <BulletList items={data.riskFactors} />
        </div>
      )}
      {data.preventionStrategies?.length > 0 && (
        <div>
          <SectionLabel>{t("prevention")}</SectionLabel>
          <BulletList items={data.preventionStrategies} />
        </div>
      )}
    </div>
  );
}
