"use client";

/**
 * @file components/help/HelpCenter.tsx
 * @description Searchable in-app help documentation with accordion sections and
 *   expandable articles.
 *
 * Content: 30+ guide sections (returned by `useGuides`) covering getting-started,
 *   all feature areas (projects, phases, checklists, documents, photos, team,
 *   notifications, comments, change orders, daily logs, inspections, materials,
 *   bids, offline mode, punch lists, RFIs, submittals, time tracking, estimates,
 *   drawings, lien waivers, payment apps, voice notes, analytics, insurance), and
 *   admin topics (advanced, settings, admin panel).
 *
 * Role gating: the "admin" category sections (advanced, settings, admin panel) are
 *   hidden for roles other than ADMIN and PROJECT_MANAGER.
 *
 * Search: filters sections and articles by title, i18n content, and article tags.
 *   Active search forces all matching sections to expand; result count shown.
 *
 * Quick links: shown when no search is active — 8 shortcut buttons plus a
 *   "Replay Intro Tour" button that calls `resetTour()` from OnboardingTour.
 *
 * Accordion: click section header to expand/collapse; expanding auto-opens the
 *   first article. Clicking an article toggles its body content.
 *
 * Initial state: `initialSection` and `initialArticle` props support deep-linking
 *   from tour "Learn More" buttons via URL query params.
 *
 * i18n namespaces: `help`, `common`.
 */

import { useState } from "react";
import {
  Search,
  FolderKanban,
  HardHat,
  Users,
  ClipboardCheck,
  FileText,
  Camera,
  Bell,
  Settings,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Shield,
  ExternalLink,
  BookOpen,
  Receipt,
  ClipboardList,
  SearchCheck,
  Package,
  Gavel,
  WifiOff,
  BarChart3,
  MapPin,
  Globe,
  Upload,
  KeyRound,
  Webhook,
  TrendingUp,
  CalendarClock,
  ShieldCheck,
  Star,
  DollarSign,
  Mic,
  ListChecks,
  MessageSquareText,
  FileCheck2,
  Timer,
  PenTool,
  Calculator,
} from "lucide-react";
import { PlayCircle, CreditCard } from "lucide-react";
import { resetTour } from "./OnboardingTour";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface GuideSection {
  id: string;
  titleKey: string;
  icon: React.ReactNode;
  category: "getting-started" | "features" | "admin";
  articles: Article[];
}

interface Article {
  id: string;
  titleKey: string;
  contentKey: string;
  tags: string[];
}

function useGuides(t: (key: string) => string): GuideSection[] {
  return [
    {
      id: "getting-started",
      titleKey: "sections.gettingStarted",
      icon: <BookOpen className="w-5 h-5" />,
      category: "getting-started",
      articles: [
        { id: "gs-overview", titleKey: "articles.appOverview", contentKey: "articles.appOverviewContent", tags: ["overview", "intro", "navigation", "dashboard"] },
        { id: "gs-first-project", titleKey: "articles.firstProject", contentKey: "articles.firstProjectContent", tags: ["create", "new", "project", "setup"] },
        { id: "gs-roles", titleKey: "articles.roles", contentKey: "articles.rolesContent", tags: ["roles", "permissions", "admin", "contractor", "manager"] },
      ],
    },
    {
      id: "projects",
      titleKey: "sections.projects",
      icon: <FolderKanban className="w-5 h-5" />,
      category: "features",
      articles: [
        { id: "proj-overview", titleKey: "articles.projectOverview", contentKey: "articles.projectOverviewContent", tags: ["project", "overview", "budget", "progress"] },
        { id: "proj-budget", titleKey: "articles.budgetTracking", contentKey: "articles.budgetTrackingContent", tags: ["budget", "cost", "money", "spending", "variance"] },
      ],
    },
    {
      id: "phases",
      titleKey: "sections.phases",
      icon: <HardHat className="w-5 h-5" />,
      category: "features",
      articles: [
        { id: "phase-lifecycle", titleKey: "articles.phaseLifecycle", contentKey: "articles.phaseLifecycleContent", tags: ["phase", "status", "lifecycle", "review", "complete"] },
        { id: "phase-dependencies", titleKey: "articles.phaseDependencies", contentKey: "articles.phaseDependenciesContent", tags: ["dependency", "dependencies", "link", "scheduling", "timeline"] },
      ],
    },
    {
      id: "checklists",
      titleKey: "sections.checklists",
      icon: <ClipboardCheck className="w-5 h-5" />,
      category: "features",
      articles: [
        { id: "check-templates", titleKey: "articles.checklistTemplates", contentKey: "articles.checklistTemplatesContent", tags: ["checklist", "template", "items", "check", "complete"] },
      ],
    },
    {
      id: "documents",
      titleKey: "sections.documents",
      icon: <FileText className="w-5 h-5" />,
      category: "features",
      articles: [
        { id: "doc-management", titleKey: "articles.documentManagement", contentKey: "articles.documentManagementContent", tags: ["document", "upload", "approve", "reject", "pdf"] },
      ],
    },
    {
      id: "photos",
      titleKey: "sections.photos",
      icon: <Camera className="w-5 h-5" />,
      category: "features",
      articles: [
        { id: "photo-progress", titleKey: "articles.progressPhotos", contentKey: "articles.progressPhotosContent", tags: ["photo", "camera", "progress", "flag", "image"] },
      ],
    },
    {
      id: "team",
      titleKey: "sections.team",
      icon: <Users className="w-5 h-5" />,
      category: "features",
      articles: [
        { id: "team-invite", titleKey: "articles.invitingTeam", contentKey: "articles.invitingTeamContent", tags: ["invite", "team", "member", "email", "join"] },
      ],
    },
    {
      id: "notifications",
      titleKey: "sections.notifications",
      icon: <Bell className="w-5 h-5" />,
      category: "features",
      articles: [
        { id: "notif-channels", titleKey: "articles.notifChannels", contentKey: "articles.notifChannelsContent", tags: ["notification", "email", "sms", "alert", "preference"] },
      ],
    },
    {
      id: "comments",
      titleKey: "sections.comments",
      icon: <MessageSquare className="w-5 h-5" />,
      category: "features",
      articles: [
        { id: "comments-usage", titleKey: "articles.phaseComments", contentKey: "articles.phaseCommentsContent", tags: ["comment", "discuss", "communication", "message"] },
      ],
    },
    {
      id: "change-orders",
      titleKey: "sections.changeOrders",
      icon: <Receipt className="w-5 h-5" />,
      category: "features",
      articles: [
        { id: "co-overview", titleKey: "articles.changeOrders", contentKey: "articles.changeOrdersContent", tags: ["change order", "scope", "amendment", "approval", "cost impact"] },
      ],
    },
    {
      id: "daily-logs",
      titleKey: "sections.dailyLogs",
      icon: <ClipboardList className="w-5 h-5" />,
      category: "features",
      articles: [
        { id: "dl-overview", titleKey: "articles.dailyLogs", contentKey: "articles.dailyLogsContent", tags: ["daily log", "journal", "weather", "crew", "safety"] },
      ],
    },
    {
      id: "inspections",
      titleKey: "sections.inspections",
      icon: <SearchCheck className="w-5 h-5" />,
      category: "features",
      articles: [
        { id: "insp-overview", titleKey: "articles.inspections", contentKey: "articles.inspectionsContent", tags: ["inspection", "quality", "compliance", "pass", "fail"] },
      ],
    },
    {
      id: "materials",
      titleKey: "sections.materials",
      icon: <Package className="w-5 h-5" />,
      category: "features",
      articles: [
        { id: "mat-overview", titleKey: "articles.materials", contentKey: "articles.materialsContent", tags: ["material", "supply", "order", "delivery", "install"] },
      ],
    },
    {
      id: "bids",
      titleKey: "sections.bids",
      icon: <Gavel className="w-5 h-5" />,
      category: "features",
      articles: [
        { id: "bid-overview", titleKey: "articles.subcontractorBids", contentKey: "articles.subcontractorBidsContent", tags: ["bid", "subcontractor", "proposal", "tender", "award"] },
      ],
    },
    {
      id: "offline",
      titleKey: "sections.offline",
      icon: <WifiOff className="w-5 h-5" />,
      category: "features",
      articles: [
        { id: "offline-mode", titleKey: "articles.offlineMode", contentKey: "articles.offlineModeContent", tags: ["offline", "sync", "queue", "connectivity", "field"] },
      ],
    },
    {
      id: "punch-lists",
      titleKey: "sections.punchLists",
      icon: <ListChecks className="w-5 h-5" />,
      category: "features",
      articles: [
        { id: "pl-overview", titleKey: "articles.punchListTitle", contentKey: "articles.punchListBody", tags: ["punch", "list", "deficiency", "snag", "closeout", "completion"] },
      ],
    },
    {
      id: "rfis",
      titleKey: "sections.rfis",
      icon: <MessageSquareText className="w-5 h-5" />,
      category: "features",
      articles: [
        { id: "rfi-overview", titleKey: "articles.rfiTitle", contentKey: "articles.rfiBody", tags: ["rfi", "request", "information", "question", "answer", "ball-in-court"] },
      ],
    },
    {
      id: "submittals",
      titleKey: "sections.submittals",
      icon: <FileCheck2 className="w-5 h-5" />,
      category: "features",
      articles: [
        { id: "sub-overview", titleKey: "articles.submittalTitle", contentKey: "articles.submittalBody", tags: ["submittal", "review", "approval", "spec", "revision", "shop drawing"] },
      ],
    },
    {
      id: "time-tracking",
      titleKey: "sections.timeTracking",
      icon: <Timer className="w-5 h-5" />,
      category: "features",
      articles: [
        { id: "tt-overview", titleKey: "articles.timeTrackingTitle", contentKey: "articles.timeTrackingBody", tags: ["time", "hours", "labor", "tracking", "approve", "cost code"] },
      ],
    },
    {
      id: "estimates",
      titleKey: "sections.estimates",
      icon: <Calculator className="w-5 h-5" />,
      category: "features",
      articles: [
        { id: "est-overview", titleKey: "articles.estimatesTitle", contentKey: "articles.estimatesBody", tags: ["estimate", "takeoff", "quantity", "cost", "budget", "line item", "unit cost"] },
      ],
    },
    {
      id: "drawings",
      titleKey: "sections.drawings",
      icon: <PenTool className="w-5 h-5" />,
      category: "features",
      articles: [
        { id: "dr-overview", titleKey: "articles.drawingsTitle", contentKey: "articles.drawingsBody", tags: ["drawing", "plan", "blueprint", "revision", "discipline", "architectural", "structural"] },
      ],
    },
    {
      id: "lien-waivers",
      titleKey: "sections.lienWaivers",
      icon: <ShieldCheck className="w-5 h-5" />,
      category: "features",
      articles: [
        { id: "lw-overview", titleKey: "articles.lienWaiversTitle", contentKey: "articles.lienWaiversBody", tags: ["lien", "waiver", "vendor", "conditional", "unconditional", "notarized"] },
      ],
    },
    {
      id: "payment-apps",
      titleKey: "sections.paymentApps",
      icon: <DollarSign className="w-5 h-5" />,
      category: "features",
      articles: [
        { id: "pa-overview", titleKey: "articles.paymentAppsTitle", contentKey: "articles.paymentAppsBody", tags: ["payment", "application", "pay app", "AIA", "retainage", "billing"] },
      ],
    },
    {
      id: "voice-notes",
      titleKey: "sections.voiceNotes",
      icon: <Mic className="w-5 h-5" />,
      category: "features",
      articles: [
        { id: "vn-overview", titleKey: "articles.voiceNotes", contentKey: "articles.voiceNotesContent", tags: ["voice", "audio", "record", "note", "transcription", "mic"] },
      ],
    },
    {
      id: "analytics",
      titleKey: "sections.analytics",
      icon: <BarChart3 className="w-5 h-5" />,
      category: "features",
      articles: [
        { id: "analytics-dash", titleKey: "articles.analyticsDashboard", contentKey: "articles.analyticsDashboardContent", tags: ["analytics", "chart", "report", "dashboard", "statistics"] },
        { id: "budget-forecast", titleKey: "articles.budgetForecasting", contentKey: "articles.budgetForecastingContent", tags: ["forecast", "prediction", "trend", "CPI", "earned value"] },
        { id: "report-schedule", titleKey: "articles.reportScheduling", contentKey: "articles.reportSchedulingContent", tags: ["report", "schedule", "automatic", "email", "recurring"] },
      ],
    },
    {
      id: "insurance",
      titleKey: "sections.insurance",
      icon: <ShieldCheck className="w-5 h-5" />,
      category: "features",
      articles: [
        { id: "ins-certificates", titleKey: "articles.insuranceCertificates", contentKey: "articles.insuranceCertificatesContent", tags: ["insurance", "certificate", "coverage", "liability", "compliance"] },
        { id: "ins-compliance", titleKey: "articles.complianceExport", contentKey: "articles.complianceExportContent", tags: ["compliance", "CSV", "export", "umbrella", "expiry"] },
        { id: "ins-star-rating", titleKey: "articles.starRatings", contentKey: "articles.starRatingsContent", tags: ["star", "rating", "review", "performance", "contractor"] },
        { id: "ins-directory-search", titleKey: "articles.directorySearch", contentKey: "articles.directorySearchContent", tags: ["search", "filter", "directory", "find", "type"] },
        { id: "ins-location", titleKey: "articles.staffLocation", contentKey: "articles.staffLocationContent", tags: ["location", "city", "address", "staff", "directory"] },
        { id: "ins-job-pl", titleKey: "articles.jobPL", contentKey: "articles.jobPLContent", tags: ["profit", "loss", "P&L", "margin", "report", "financial"] },
      ],
    },
    {
      id: "billing-plans",
      titleKey: "sections.billingPlans",
      icon: <CreditCard className="w-5 h-5" />,
      category: "admin",
      articles: [
        { id: "bill-plans", titleKey: "articles.plansOverviewTitle", contentKey: "articles.plansOverviewBody", tags: ["plan", "starter", "pro", "enterprise", "pricing", "subscription", "billing"] },
        { id: "bill-ai-usage", titleKey: "articles.aiUsageTitle", contentKey: "articles.aiUsageBody", tags: ["AI", "token", "budget", "quota", "usage", "gating"] },
        { id: "bill-qb-export", titleKey: "articles.qbExportTitle", contentKey: "articles.qbExportBody", tags: ["QuickBooks", "export", "invoice", "accounting", "QB"] },
        { id: "bill-signup", titleKey: "articles.signupOnboardingTitle", contentKey: "articles.signupOnboardingBody", tags: ["signup", "onboarding", "trial", "register", "account", "company"] },
      ],
    },
    {
      id: "advanced",
      titleKey: "sections.advanced",
      icon: <Globe className="w-5 h-5" />,
      category: "admin",
      articles: [
        { id: "adv-gps", titleKey: "articles.gpsPhotos", contentKey: "articles.gpsPhotosContent", tags: ["GPS", "map", "location", "geotag", "coordinates"] },
        { id: "adv-client-portal", titleKey: "articles.clientPortal", contentKey: "articles.clientPortalContent", tags: ["client", "portal", "token", "read-only", "share"] },
        { id: "adv-bulk-import", titleKey: "articles.bulkImport", contentKey: "articles.bulkImportContent", tags: ["import", "CSV", "bulk", "batch", "spreadsheet"] },
        { id: "adv-2fa", titleKey: "articles.twoFactorAuth", contentKey: "articles.twoFactorAuthContent", tags: ["2FA", "security", "authenticator", "TOTP", "two-factor"] },
        { id: "adv-api", titleKey: "articles.apiWebhooks", contentKey: "articles.apiWebhooksContent", tags: ["API", "webhook", "integration", "HMAC", "REST"] },
      ],
    },
    {
      id: "settings",
      titleKey: "sections.settingsAdmin",
      icon: <Settings className="w-5 h-5" />,
      category: "admin",
      articles: [
        { id: "settings-theme", titleKey: "articles.themeCustomization", contentKey: "articles.themeCustomizationContent", tags: ["theme", "color", "logo", "brand", "appearance"] },
        { id: "settings-security", titleKey: "articles.securityAccess", contentKey: "articles.securityAccessContent", tags: ["security", "login", "password", "oauth", "access"] },
      ],
    },
    {
      id: "admin-panel",
      titleKey: "sections.adminPanel",
      icon: <ShieldCheck className="w-5 h-5" />,
      category: "admin",
      articles: [
        { id: "admin-panel-overview", titleKey: "articles.adminPanelTitle", contentKey: "articles.adminPanelBody", tags: ["admin", "feature toggle", "user management", "system health", "audit", "export"] },
      ],
    },
  ];
}

interface Props {
  userRole: string;
  initialSection?: string;
  initialArticle?: string;
}

export function HelpCenter({ userRole, initialSection, initialArticle }: Props) {
  const [search, setSearch] = useState("");
  const [expandedSection, setExpandedSection] = useState<string | null>(initialSection || "getting-started");
  const [expandedArticle, setExpandedArticle] = useState<string | null>(initialArticle || "gs-overview");
  const t = useTranslations("help");
  const tc = useTranslations("common");

  const GUIDES = useGuides(t);

  // Filter guides based on role (hide admin section for non-admin/PM)
  const isAdmin = userRole === "ADMIN" || userRole === "PROJECT_MANAGER";
  const visibleGuides = GUIDES.filter(
    (g) => g.category !== "admin" || isAdmin
  );

  // Search filter
  const searchLower = search.toLowerCase().trim();
  const filteredGuides = searchLower
    ? visibleGuides
        .map((section) => ({
          ...section,
          articles: section.articles.filter(
            (a) =>
              t(a.titleKey).toLowerCase().includes(searchLower) ||
              t(a.contentKey).toLowerCase().includes(searchLower) ||
              a.tags.some((tag) => tag.includes(searchLower))
          ),
        }))
        .filter((section) => section.articles.length > 0)
    : visibleGuides;

  const totalArticles = filteredGuides.reduce(
    (sum, s) => sum + s.articles.length,
    0
  );

  return (
    <div>
      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (e.target.value) {
              setExpandedSection(null);
              setExpandedArticle(null);
            }
          }}
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none"
        />
        {search && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
            {totalArticles} {totalArticles !== 1 ? "results" : "result"}
          </span>
        )}
      </div>

      {/* Quick Links */}
      {!search && (
        <div className="space-y-3 mb-6">
          {/* Primary: Replay Tour */}
          <button
            onClick={() => resetTour()}
            className="w-full flex items-center gap-3 p-4 bg-[var(--color-primary-bg)] rounded-xl border border-[var(--color-primary-light)]/30 hover:border-[var(--color-primary-light)] hover:shadow-sm transition-all text-left"
          >
            <PlayCircle className="w-5 h-5 text-[var(--color-primary)]" />
            <div>
              <span className="text-sm font-semibold text-[var(--color-primary-dark)]">
                {t("replayIntro")}
              </span>
              <p className="text-xs text-[var(--color-primary-dark)]/70 mt-0.5">
                {t("replayIntroDesc")}
              </p>
            </div>
          </button>

          {/* Quick jump links */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: t("createProject"), icon: <FolderKanban className="w-4 h-4" />, section: "projects", article: "proj-overview" },
              { label: t("phaseStatus"), icon: <HardHat className="w-4 h-4" />, section: "phases", article: "phase-lifecycle" },
              { label: t("inviteTeam"), icon: <Users className="w-4 h-4" />, section: "team", article: "team-invite" },
              { label: t("quickLinkNotifications"), icon: <Bell className="w-4 h-4" />, section: "notifications", article: "notif-channels" },
              { label: t("quickLinkChangeOrders"), icon: <Receipt className="w-4 h-4" />, section: "change-orders", article: "co-overview" },
              { label: t("quickLinkOffline"), icon: <WifiOff className="w-4 h-4" />, section: "offline", article: "offline-mode" },
              { label: t("quickLinkAnalytics"), icon: <BarChart3 className="w-4 h-4" />, section: "analytics", article: "analytics-dash" },
              { label: t("quickLinkAdvanced"), icon: <Globe className="w-4 h-4" />, section: "advanced", article: "adv-client-portal" },
            ].map((link) => (
              <button
                key={link.section}
                onClick={() => {
                  setExpandedSection(link.section);
                  setExpandedArticle(link.article);
                }}
                className="flex items-center gap-2 p-3 bg-white rounded-lg border border-gray-200 hover:border-[var(--color-primary-light)] hover:shadow-sm transition-all text-sm font-medium text-gray-700"
              >
                <span className="text-[var(--color-primary)]">{link.icon}</span>
                {link.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Guide Sections */}
      <div className="space-y-3">
        {filteredGuides.map((section) => {
          const isOpen = search ? true : expandedSection === section.id;
          return (
            <div
              key={section.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              <button
                onClick={() => {
                  if (!search) {
                    setExpandedSection(isOpen ? null : section.id);
                    if (!isOpen) setExpandedArticle(section.articles[0]?.id || null);
                  }
                }}
                className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="text-[var(--color-primary)]">{section.icon}</span>
                <span className="text-sm font-semibold text-gray-900 flex-1">
                  {t(section.titleKey)}
                </span>
                <span className="text-xs text-gray-400 mr-2">
                  {section.articles.length} {section.articles.length !== 1 ? "articles" : "article"}
                </span>
                {isOpen ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {isOpen && (
                <div className="border-t border-gray-100">
                  {section.articles.map((article) => {
                    const isArticleOpen = search || expandedArticle === article.id;
                    return (
                      <div key={article.id} className="border-b border-gray-50 last:border-0">
                        <button
                          onClick={() =>
                            setExpandedArticle(
                              isArticleOpen ? null : article.id
                            )
                          }
                          className="w-full flex items-center gap-2 px-5 py-3 text-left hover:bg-gray-50 transition-colors"
                        >
                          {isArticleOpen ? (
                            <ChevronDown className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                          )}
                          <span
                            className={cn(
                              "text-sm",
                              isArticleOpen
                                ? "font-medium text-[var(--color-primary-dark)]"
                                : "text-gray-700"
                            )}
                          >
                            {t(article.titleKey)}
                          </span>
                        </button>
                        {isArticleOpen && (
                          <div className="px-5 pb-4 pl-10">
                            <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                              {t(article.contentKey)}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {filteredGuides.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-900">{tc("noResults")}</p>
            <p className="text-xs text-gray-500 mt-1">
              {tc("tryAgain")}
            </p>
          </div>
        )}
      </div>

      {/* Contact Support */}
      <div className="mt-8 bg-[var(--color-primary-bg)] rounded-xl p-6 text-center">
        <Shield className="w-8 h-8 text-[var(--color-primary)] mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-gray-900 mb-1">
          {t("needMoreHelp")}
        </h3>
        <p className="text-sm text-gray-600 mb-3">
          {t("contactAdmin")}
        </p>
        <a
          href="mailto:support@constructionpm.app"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--color-primary)] hover:bg-white/60 rounded-lg transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          {t("contactSupport")}
        </a>
      </div>
    </div>
  );
}
