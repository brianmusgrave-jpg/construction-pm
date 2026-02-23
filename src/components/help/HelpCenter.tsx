"use client";

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
} from "lucide-react";
import { cn } from "@/lib/utils";

interface GuideSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  category: "getting-started" | "features" | "admin";
  articles: Article[];
}

interface Article {
  id: string;
  title: string;
  content: string;
  tags: string[];
}

const GUIDES: GuideSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: <BookOpen className="w-5 h-5" />,
    category: "getting-started",
    articles: [
      {
        id: "gs-overview",
        title: "App Overview",
        content:
          "Construction PM helps you manage construction projects from start to finish. The dashboard gives you a bird's-eye view of all your projects, and you can drill into individual projects to manage phases, documents, photos, and team members.\n\nKey areas:\n• Dashboard — Overview of all projects and quick stats\n• Projects — Create and manage individual projects\n• Timeline — Visual Gantt chart of project phases\n• Directory — Manage your staff/contractor contacts\n• Notifications — Stay updated on project activity\n• Settings — Customize theme, manage templates",
        tags: ["overview", "intro", "navigation", "dashboard"],
      },
      {
        id: "gs-first-project",
        title: "Creating Your First Project",
        content:
          "To create a project:\n1. Go to Projects from the sidebar\n2. Click 'New Project' in the top right\n3. Fill in the project name, address, and estimated completion date\n4. Optionally set a budget\n5. Click 'Create Project'\n\nOnce created, you'll be taken to the project overview page where you can add phases, invite team members, and start tracking progress.",
        tags: ["create", "new", "project", "setup"],
      },
      {
        id: "gs-roles",
        title: "Understanding Roles",
        content:
          "Construction PM has five user roles:\n\n• Admin — Full access to everything including settings, user management, and all projects\n• Project Manager — Can create/edit projects, manage phases, approve documents, and invite members\n• Contractor — Access to assigned phases via the Contractor Portal, can upload photos/documents and request reviews\n• Stakeholder — Read-only access to project overviews and reports\n• Viewer — Basic read-only access\n\nRole determines what actions you can take and what menu items you see.",
        tags: ["roles", "permissions", "admin", "contractor", "manager"],
      },
    ],
  },
  {
    id: "projects",
    title: "Projects",
    icon: <FolderKanban className="w-5 h-5" />,
    category: "features",
    articles: [
      {
        id: "proj-overview",
        title: "Project Overview Page",
        content:
          "The project overview shows:\n• Budget summary (total, spent, remaining)\n• Progress bar showing phase completion percentage\n• Quick stats (active phases, reviews pending, overdue items)\n• All phases with status indicators\n• Team members and recent activity\n\nClick on any phase to see its detailed view, or use the Timeline link to see the Gantt chart.",
        tags: ["project", "overview", "budget", "progress"],
      },
      {
        id: "proj-budget",
        title: "Budget Tracking",
        content:
          "Set a project budget when creating or editing a project. Each phase can have an estimated cost and actual cost.\n\nThe Budget section on the project page shows:\n• Phase-by-phase cost breakdown\n• Variance (difference between estimated and actual)\n• Color-coded warnings when over budget\n\nAdmins and PMs can edit phase costs by clicking the edit button in the budget table.",
        tags: ["budget", "cost", "money", "spending", "variance"],
      },
    ],
  },
  {
    id: "phases",
    title: "Phases",
    icon: <HardHat className="w-5 h-5" />,
    category: "features",
    articles: [
      {
        id: "phase-lifecycle",
        title: "Phase Status Lifecycle",
        content:
          "Phases progress through these statuses:\n\n1. Pending — Not yet started\n2. In Progress — Active work underway\n3. Review Requested — Contractor has requested PM review\n4. Under Review — PM is actively reviewing\n5. Complete — Phase is finished and approved\n\nContractors can request reviews from the Contractor Portal. PMs/Admins can change status from the phase detail page.",
        tags: ["phase", "status", "lifecycle", "review", "complete"],
      },
      {
        id: "phase-dependencies",
        title: "Phase Dependencies",
        content:
          "You can link phases so that one depends on another. This helps with scheduling:\n\n• A dependency means one phase should finish before another starts\n• Lag days can be added between dependent phases\n• Circular dependencies are automatically prevented\n• Dependencies appear on the project timeline\n\nTo add a dependency, go to the phase detail page and use the dependencies section.",
        tags: ["dependency", "dependencies", "link", "scheduling", "timeline"],
      },
    ],
  },
  {
    id: "checklists",
    title: "Checklists",
    icon: <ClipboardCheck className="w-5 h-5" />,
    category: "features",
    articles: [
      {
        id: "check-templates",
        title: "Checklist Templates",
        content:
          "Admins can create reusable checklist templates in Settings > Checklist Templates. These templates can then be applied to any phase.\n\nTo apply a template:\n1. Open a phase detail page\n2. Look for the Checklist section\n3. Click 'Apply Template' and select a template\n\nChecklist items can be checked off by anyone with edit access. When all items are complete, project managers receive a notification.",
        tags: ["checklist", "template", "items", "check", "complete"],
      },
    ],
  },
  {
    id: "documents",
    title: "Documents",
    icon: <FileText className="w-5 h-5" />,
    category: "features",
    articles: [
      {
        id: "doc-management",
        title: "Document Management",
        content:
          "Upload documents to any phase for record-keeping:\n\n• Supported formats: PDF, images, Word docs, Excel, and more\n• Documents can be marked as Pending, Approved, or Rejected by PMs/Admins\n• Each document shows who uploaded it and when\n• You can delete documents you uploaded\n\nCommon document types: permits, inspection reports, contracts, change orders, material specs.",
        tags: ["document", "upload", "approve", "reject", "pdf"],
      },
    ],
  },
  {
    id: "photos",
    title: "Photos",
    icon: <Camera className="w-5 h-5" />,
    category: "features",
    articles: [
      {
        id: "photo-progress",
        title: "Progress Photos",
        content:
          "Take and upload photos to document construction progress:\n\n• Photos are attached to specific phases\n• Each photo can have a caption\n• GPS tagging support for field workers (coming soon)\n• PMs can flag photos that need attention\n• Photos display in a grid with lightbox view\n\nRegular photo documentation helps with inspections, client updates, and dispute resolution.",
        tags: ["photo", "camera", "progress", "flag", "image"],
      },
    ],
  },
  {
    id: "team",
    title: "Team & Invitations",
    icon: <Users className="w-5 h-5" />,
    category: "features",
    articles: [
      {
        id: "team-invite",
        title: "Inviting Team Members",
        content:
          "To invite someone to a project:\n1. Go to the project overview page\n2. Find the Team section\n3. Click 'Invite' and enter their email\n4. Select their role (PM, Contractor, Stakeholder, Viewer)\n5. They'll receive an email invitation\n\nInvitations expire after 7 days. You can resend or revoke pending invitations from the team section.",
        tags: ["invite", "team", "member", "email", "join"],
      },
    ],
  },
  {
    id: "notifications",
    title: "Notifications",
    icon: <Bell className="w-5 h-5" />,
    category: "features",
    articles: [
      {
        id: "notif-channels",
        title: "Notification Channels",
        content:
          "Construction PM sends notifications through three channels:\n\n• In-app — Badge on sidebar + notification center page\n• Email — Sent via email for important updates\n• SMS — Text messages for critical alerts (requires phone number)\n\nYou can customize which types of notifications you receive on each channel in Settings > Notification Preferences.\n\nQuiet hours let you pause email/SMS during off-hours while still receiving in-app notifications.",
        tags: ["notification", "email", "sms", "alert", "preference"],
      },
    ],
  },
  {
    id: "comments",
    title: "Comments",
    icon: <MessageSquare className="w-5 h-5" />,
    category: "features",
    articles: [
      {
        id: "comments-usage",
        title: "Phase Comments",
        content:
          "Each phase has a comment section for team communication:\n\n• Post comments to discuss progress, issues, or questions\n• Comments show user avatar, name, and timestamp\n• Delete your own comments (Admins can delete any comment)\n• Comments appear in reverse chronological order\n\nUse comments instead of external messaging to keep all project communication in one place.",
        tags: ["comment", "discuss", "communication", "message"],
      },
    ],
  },
  {
    id: "settings",
    title: "Settings & Admin",
    icon: <Settings className="w-5 h-5" />,
    category: "admin",
    articles: [
      {
        id: "settings-theme",
        title: "Theme Customization",
        content:
          "Admins and PMs can customize the app appearance:\n\n• Choose from multiple color themes (Blue, Green, Orange, Purple, Red, Teal)\n• Upload a company logo\n• Set a company name\n\nTheme changes apply to all users in the organization. Go to Settings > Appearance to customize.",
        tags: ["theme", "color", "logo", "brand", "appearance"],
      },
      {
        id: "settings-security",
        title: "Security & Access",
        content:
          "Construction PM uses secure authentication:\n\n• Email-based login with magic links or password\n• Google OAuth integration\n• Session-based authentication\n• Role-based access control\n\nContact your administrator to change your role or if you're locked out of your account.",
        tags: ["security", "login", "password", "oauth", "access"],
      },
    ],
  },
];

interface Props {
  userRole: string;
}

export function HelpCenter({ userRole }: Props) {
  const [search, setSearch] = useState("");
  const [expandedSection, setExpandedSection] = useState<string | null>("getting-started");
  const [expandedArticle, setExpandedArticle] = useState<string | null>("gs-overview");

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
              a.title.toLowerCase().includes(searchLower) ||
              a.content.toLowerCase().includes(searchLower) ||
              a.tags.some((t) => t.includes(searchLower))
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
          placeholder="Search help articles..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            // Auto-expand all sections when searching
            if (e.target.value) {
              setExpandedSection(null);
              setExpandedArticle(null);
            }
          }}
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none"
        />
        {search && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
            {totalArticles} result{totalArticles !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Quick Links */}
      {!search && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Create Project", icon: <FolderKanban className="w-4 h-4" />, section: "projects", article: "proj-overview" },
            { label: "Phase Status", icon: <HardHat className="w-4 h-4" />, section: "phases", article: "phase-lifecycle" },
            { label: "Invite Team", icon: <Users className="w-4 h-4" />, section: "team", article: "team-invite" },
            { label: "Notifications", icon: <Bell className="w-4 h-4" />, section: "notifications", article: "notif-channels" },
          ].map((link) => (
            <button
              key={link.label}
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
                  {section.title}
                </span>
                <span className="text-xs text-gray-400 mr-2">
                  {section.articles.length} article{section.articles.length !== 1 ? "s" : ""}
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
                            {article.title}
                          </span>
                        </button>
                        {isArticleOpen && (
                          <div className="px-5 pb-4 pl-10">
                            <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                              {article.content}
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
            <p className="text-sm font-medium text-gray-900">No results found</p>
            <p className="text-xs text-gray-500 mt-1">
              Try a different search term
            </p>
          </div>
        )}
      </div>

      {/* Contact Support */}
      <div className="mt-8 bg-[var(--color-primary-bg)] rounded-xl p-6 text-center">
        <Shield className="w-8 h-8 text-[var(--color-primary)] mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-gray-900 mb-1">
          Need more help?
        </h3>
        <p className="text-sm text-gray-600 mb-3">
          Contact your project administrator or reach out to support.
        </p>
        <a
          href="mailto:support@constructionpm.app"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--color-primary)] hover:bg-white/60 rounded-lg transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Contact Support
        </a>
      </div>
    </div>
  );
}
