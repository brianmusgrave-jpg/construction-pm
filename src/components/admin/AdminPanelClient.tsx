"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  ToggleLeft,
  ToggleRight,
  Activity,
  Users,
  Server,
  Download,
  Key,
  Shield,
  Settings,
  ChevronRight,
  UserCog,
  AlertTriangle,
  Check,
  X,
  HardDrive,
  FolderKanban,
  FileText,
  Camera,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import {
  toggleFeature,
  updateUserRole,
  deactivateUser,
  exportAuditLog,
} from "@/actions/admin";

type Tab = "features" | "activity" | "users" | "health" | "audit";

interface FeatureToggle {
  id: string;
  featureKey: string;
  enabled: boolean;
  label: string;
  category: string;
  disabledBy?: string | null;
  disabledAt?: string | null;
}

interface UserInfo {
  id: string;
  name: string | null;
  email: string;
  role: string;
  image: string | null;
  createdAt: string;
  _count: { projectMembers: number; notifications: number };
}

interface SystemStats {
  users: number;
  projects: number;
  activeProjects: number;
  phases: number;
  documents: number;
  photos: number;
  staff: number;
  totalActivities: number;
  recentActivities: number;
  storageBytes: number;
}

interface AdminPanelClientProps {
  features: FeatureToggle[];
  users: UserInfo[];
  stats: SystemStats;
  currentUserId: string;
  activityLogNode: React.ReactNode;
}

export function AdminPanelClient({
  features: initialFeatures,
  users: initialUsers,
  stats,
  currentUserId,
  activityLogNode,
}: AdminPanelClientProps) {
  const t = useTranslations("adminPanel");
  const [tab, setTab] = useState<Tab>("features");
  const [features, setFeatures] = useState(initialFeatures);
  const [users] = useState(initialUsers);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);
  const [changingRole, setChangingRole] = useState<string | null>(null);

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "features", label: t("tabs.features"), icon: <ToggleLeft className="w-4 h-4" /> },
    { key: "activity", label: t("tabs.activity"), icon: <Activity className="w-4 h-4" /> },
    { key: "users", label: t("tabs.users"), icon: <Users className="w-4 h-4" /> },
    { key: "health", label: t("tabs.health"), icon: <Server className="w-4 h-4" /> },
    { key: "audit", label: t("tabs.audit"), icon: <Download className="w-4 h-4" /> },
  ];

  // ── Feature Toggles ──
  async function handleToggle(featureKey: string, enabled: boolean) {
    setTogglingKey(featureKey);
    try {
      await toggleFeature(featureKey, enabled);
      setFeatures((prev) =>
        prev.map((f) => (f.featureKey === featureKey ? { ...f, enabled } : f))
      );
      toast.success(enabled ? t("featureEnabled") : t("featureDisabled"));
    } catch {
      toast.error(t("error"));
    } finally {
      setTogglingKey(null);
    }
  }

  const groupedFeatures = features.reduce<Record<string, FeatureToggle[]>>((acc, f) => {
    if (!acc[f.category]) acc[f.category] = [];
    acc[f.category].push(f);
    return acc;
  }, {});

  const categoryLabels: Record<string, string> = {
    field: t("categories.field"),
    financial: t("categories.financial"),
    integrations: t("categories.integrations"),
    general: t("categories.general"),
  };

  const categoryOrder = ["field", "financial", "integrations", "general"];

  // ── User Management ──
  async function handleRoleChange(userId: string, newRole: string) {
    setChangingRole(userId);
    try {
      await updateUserRole(userId, newRole);
      toast.success(t("roleUpdated"));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setChangingRole(null);
    }
  }

  async function handleDeactivate(userId: string, userName: string) {
    if (!confirm(t("confirmDeactivate", { name: userName || "this user" }))) return;
    try {
      await deactivateUser(userId);
      toast.success(t("userDeactivated"));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("error"));
    }
  }

  // ── Audit Export ──
  async function handleAuditExport() {
    try {
      const csv = await exportAuditLog();
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("auditExported"));
    } catch {
      toast.error(t("error"));
    }
  }

  // ── Helpers ──
  function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  function formatDate(d: string): string {
    return new Date(d).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  const roleColors: Record<string, string> = {
    ADMIN: "bg-red-100 text-red-800",
    PROJECT_MANAGER: "bg-blue-100 text-blue-800",
    CONTRACTOR: "bg-amber-100 text-amber-800",
    STAKEHOLDER: "bg-purple-100 text-purple-800",
    VIEWER: "bg-gray-100 text-gray-600",
  };

  return (
    <div>
      {/* Tab Bar */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t.key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Feature Toggles Tab ── */}
      {tab === "features" && (
        <div className="space-y-6">
          <p className="text-sm text-gray-500">{t("featuresDescription")}</p>

          {categoryOrder.map((cat) => {
            const items = groupedFeatures[cat];
            if (!items || items.length === 0) return null;
            return (
              <div key={cat} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    {categoryLabels[cat] || cat}
                  </h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {items.map((feature) => (
                    <div
                      key={feature.featureKey}
                      className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            feature.enabled ? "bg-green-500" : "bg-gray-300"
                          }`}
                        />
                        <span className={`text-sm ${feature.enabled ? "text-gray-900" : "text-gray-400"}`}>
                          {feature.label}
                        </span>
                      </div>
                      <button
                        onClick={() => handleToggle(feature.featureKey, !feature.enabled)}
                        disabled={togglingKey === feature.featureKey}
                        className="relative"
                      >
                        {feature.enabled ? (
                          <ToggleRight className="w-8 h-8 text-blue-600" />
                        ) : (
                          <ToggleLeft className="w-8 h-8 text-gray-300" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Activity Log Tab ── */}
      {tab === "activity" && (
        <div>{activityLogNode}</div>
      )}

      {/* ── User Management Tab ── */}
      {tab === "users" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">{t("usersDescription")}</p>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">{t("user")}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">{t("role")}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">{t("projects")}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">{t("joined")}</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">{t("actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-xs">
                          {user.image ? (
                            <img src={user.image} alt="" className="w-8 h-8 rounded-full" />
                          ) : (
                            (user.name || user.email)[0]?.toUpperCase()
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{user.name || "—"}</div>
                          <div className="text-xs text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {user.id === currentUserId ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[user.role] || "bg-gray-100 text-gray-600"}`}>
                          {user.role.replace("_", " ")}
                          <Shield className="w-3 h-3" />
                        </span>
                      ) : (
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          disabled={changingRole === user.id}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
                        >
                          <option value="ADMIN">Admin</option>
                          <option value="PROJECT_MANAGER">Project Manager</option>
                          <option value="CONTRACTOR">Contractor</option>
                          <option value="STAKEHOLDER">Stakeholder</option>
                          <option value="VIEWER">Viewer</option>
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {user._count.projectMembers}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {user.id !== currentUserId && (
                        <button
                          onClick={() => handleDeactivate(user.id, user.name || user.email)}
                          className="text-xs text-red-500 hover:text-red-700 hover:underline"
                        >
                          {t("deactivate")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── System Health Tab ── */}
      {tab === "health" && (
        <div className="space-y-6">
          <p className="text-sm text-gray-500">{t("healthDescription")}</p>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: t("stats.users"), value: stats.users, icon: <Users className="w-5 h-5 text-blue-500" /> },
              { label: t("stats.projects"), value: stats.projects, icon: <FolderKanban className="w-5 h-5 text-green-500" />, sub: `${stats.activeProjects} ${t("stats.active")}` },
              { label: t("stats.phases"), value: stats.phases, icon: <BarChart3 className="w-5 h-5 text-purple-500" /> },
              { label: t("stats.staff"), value: stats.staff, icon: <UserCog className="w-5 h-5 text-amber-500" /> },
              { label: t("stats.documents"), value: stats.documents, icon: <FileText className="w-5 h-5 text-indigo-500" /> },
              { label: t("stats.photos"), value: stats.photos, icon: <Camera className="w-5 h-5 text-pink-500" /> },
              { label: t("stats.storage"), value: formatBytes(stats.storageBytes), icon: <HardDrive className="w-5 h-5 text-gray-500" /> },
              { label: t("stats.activities"), value: stats.totalActivities, icon: <Activity className="w-5 h-5 text-orange-500" />, sub: `${stats.recentActivities} ${t("stats.last7days")}` },
            ].map((stat, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  {stat.icon}
                  <span className="text-xs text-gray-500 font-medium">{stat.label}</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                {stat.sub && (
                  <div className="text-xs text-gray-400 mt-0.5">{stat.sub}</div>
                )}
              </div>
            ))}
          </div>

          {/* Version Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">{t("systemInfo")}</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">{t("version")}:</span>{" "}
                <span className="font-mono font-medium">v1.0</span>
              </div>
              <div>
                <span className="text-gray-500">{t("framework")}:</span>{" "}
                <span className="font-mono">Next.js 16 + React 19</span>
              </div>
              <div>
                <span className="text-gray-500">{t("database")}:</span>{" "}
                <span className="font-mono">PostgreSQL (Neon)</span>
              </div>
              <div>
                <span className="text-gray-500">{t("languages")}:</span>{" "}
                <span className="font-mono">EN, ES, PT, FR</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Audit Export Tab ── */}
      {tab === "audit" && (
        <div className="space-y-6">
          <p className="text-sm text-gray-500">{t("auditDescription")}</p>

          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
            <Download className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t("exportAuditLog")}</h3>
            <p className="text-sm text-gray-500 mb-4">{t("exportDescription")}</p>
            <button
              onClick={handleAuditExport}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Download className="w-4 h-4" />
              {t("downloadCSV")}
            </button>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-amber-900">{t("auditNote")}</h4>
              <p className="text-xs text-amber-700 mt-1">{t("auditNoteDescription")}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
