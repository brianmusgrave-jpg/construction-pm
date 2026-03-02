"use client";

/**
 * @file components/dashboard/DashboardShell.tsx
 * @description Client-side shell that assembles widget configs and renders
 * the DashboardGrid. Receives serialized data from the server page component.
 */

import { useTranslations } from "next-intl";
import {
  CircleDot,
  FolderKanban,
  Bell,
  Activity,
  Clock,
  TrendingUp,
  Lightbulb,
  Bot,
  BarChart3,
} from "lucide-react";
import { DashboardGrid } from "./DashboardGrid";
import type { WidgetConfig } from "./DashboardGrid";
import type { DashboardLayoutData } from "@/actions/dashboard-layout";
import { KPIWidget } from "./widgets/KPIWidget";
import { AttentionWidget } from "./widgets/AttentionWidget";
import { ProjectsWidget } from "./widgets/ProjectsWidget";
import { NotificationsWidget } from "./widgets/NotificationsWidget";
import { ActivityWidget } from "./widgets/ActivityWidget";
import { UpcomingWidget } from "./widgets/UpcomingWidget";
import { AnalyticsWidgets } from "./AnalyticsWidgets";
import { InsightsPanel } from "./InsightsPanel";
import { AIAssistantPanel } from "./AIAssistantPanel";

// ── Serialized data shapes ──────────────────────────────────────────

interface KPIData {
  activePhases: number;
  totalPhases: number;
  reviewPhases: number;
  overduePhases: number;
  pendingDocs: number;
  checklistPercent: number;
  completedItems: number;
  totalItems: number;
}

interface AttentionPhase {
  id: string;
  name: string;
  status: string;
  estEnd: string;
  project: { id: string; name: string };
  assignee?: string;
}

interface ProjectData {
  id: string;
  name: string;
  status: string;
  address?: string;
  phaseCount: number;
  completedCount: number;
  memberCount: number;
  currentPhase?: { id: string; name: string; status: string; estStart: string };
  nextPhase?: { id: string; name: string; status: string; estStart: string };
}

interface NotifData {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface ActivityData {
  id: string;
  action: string;
  message: string;
  createdAt: string;
  userName: string;
  projectName: string;
}

interface UpcomingPhase {
  id: string;
  name: string;
  estStart: string;
  project: { id: string; name: string };
}

// ── Props ──────────────────────────────────────────────────────────

interface Props {
  userRole: string;
  savedLayout: DashboardLayoutData | null;
  showCreate: boolean;
  kpi: KPIData;
  reviewPhases: AttentionPhase[];
  overduePhases: AttentionPhase[];
  projects: ProjectData[];
  notifications: NotifData[];
  activity: ActivityData[];
  upcomingPhases: UpcomingPhase[];
  analytics: any;
  projectList: { id: string; name: string }[];
}

export function DashboardShell({
  userRole,
  savedLayout,
  showCreate,
  kpi,
  reviewPhases,
  overduePhases,
  projects,
  notifications,
  activity,
  upcomingPhases,
  analytics,
  projectList,
}: Props) {
  const t = useTranslations("widgets");

  const widgets: WidgetConfig[] = [
    {
      id: "kpi",
      title: t("kpiTitle"),
      icon: <BarChart3 className="w-4 h-4" />,
      component: <KPIWidget {...kpi} />,
      defaultColSpan: 3,
      defaultVisible: true,
    },
    {
      id: "attention",
      title: t("attentionTitle"),
      icon: <CircleDot className="w-4 h-4" />,
      component: (
        <AttentionWidget
          reviewPhases={reviewPhases}
          overduePhases={overduePhases}
        />
      ),
      defaultColSpan: 2,
      defaultVisible: true,
    },
    {
      id: "projects",
      title: t("projectsTitle"),
      icon: <FolderKanban className="w-4 h-4" />,
      component: <ProjectsWidget projects={projects} showCreate={showCreate} />,
      defaultColSpan: 2,
      defaultVisible: true,
    },
    {
      id: "upcoming",
      title: t("upcomingTitle"),
      icon: <Clock className="w-4 h-4" />,
      component: <UpcomingWidget phases={upcomingPhases} />,
      defaultColSpan: 1,
      defaultVisible: upcomingPhases.length > 0,
    },
    {
      id: "notifications",
      title: t("notificationsTitle"),
      icon: <Bell className="w-4 h-4" />,
      component: <NotificationsWidget notifications={notifications} />,
      defaultColSpan: 1,
      defaultVisible: true,
    },
    {
      id: "activity",
      title: t("activityTitle"),
      icon: <Activity className="w-4 h-4" />,
      component: <ActivityWidget entries={activity} />,
      defaultColSpan: 1,
      defaultVisible: true,
    },
    {
      id: "analytics",
      title: t("analyticsTitle"),
      icon: <TrendingUp className="w-4 h-4" />,
      component: analytics ? (
        <AnalyticsWidgets data={analytics} />
      ) : (
        <div className="p-6 text-center">
          <TrendingUp className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-xs text-gray-400">{t("analyticsEmpty")}</p>
        </div>
      ),
      defaultColSpan: 3,
      defaultVisible: true,
      minRole: "CONTRACTOR",
    },
    {
      id: "insights",
      title: t("insightsTitle"),
      icon: <Lightbulb className="w-4 h-4" />,
      component: <InsightsPanel projects={projectList} />,
      defaultColSpan: 3,
      defaultVisible: true,
      minRole: "PROJECT_MANAGER",
    },
    {
      id: "assistant",
      title: t("assistantTitle"),
      icon: <Bot className="w-4 h-4" />,
      component: <AIAssistantPanel projects={projectList} />,
      defaultColSpan: 3,
      defaultVisible: true,
      minRole: "PROJECT_MANAGER",
    },
  ];

  return (
    <DashboardGrid
      widgets={widgets}
      savedLayout={savedLayout}
      userRole={userRole}
    />
  );
}
