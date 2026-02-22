import type {
  Project,
  Phase,
  Staff,
  PhaseAssignment,
  Document,
  Photo,
  Checklist,
  ChecklistItem,
  Notification,
  User,
  ProjectMember,
} from "@prisma/client";

// ── Composite Types (with relations) ──

export type ProjectWithMembers = Project & {
  members: (ProjectMember & { user: Pick<User, "id" | "name" | "email" | "image"> })[];
};

export type ProjectWithPhases = Project & {
  phases: Phase[];
  members: (ProjectMember & { user: Pick<User, "id" | "name" | "email" | "image"> })[];
  _count?: { phases: number; members: number };
};

export type PhaseWithRelations = Phase & {
  assignments: (PhaseAssignment & { staff: Staff })[];
  checklist: (Checklist & { items: ChecklistItem[] }) | null;
  documents: Document[];
  photos: Photo[];
};

export type PhaseForTimeline = Phase & {
  assignments: (PhaseAssignment & {
    staff: Pick<Staff, "id" | "name" | "company">;
  })[];
  _count?: { documents: number; photos: number };
};

export type StaffWithAssignments = Staff & {
  assignments: (PhaseAssignment & {
    phase: Pick<Phase, "id" | "name" | "projectId">;
  })[];
};

export type NotificationWithData = Notification & {
  data: {
    projectId?: string;
    phaseId?: string;
    documentId?: string;
    [key: string]: unknown;
  } | null;
};

// ── Form Types ──

export type CreateProjectInput = {
  name: string;
  description?: string;
  address?: string;
  planApproval?: string;
  budget?: number;
};

export type CreatePhaseInput = {
  name: string;
  detail?: string;
  isMilestone?: boolean;
  estStart: string;
  estEnd: string;
  worstStart?: string;
  worstEnd?: string;
  sortOrder?: number;
};

export type UpdatePhaseDatesInput = {
  phaseId: string;
  estStart: string;
  estEnd: string;
  worstStart?: string;
  worstEnd?: string;
};

export type CreateStaffInput = {
  name: string;
  company?: string;
  role?: string;
  email?: string;
  phone?: string;
  notes?: string;
};

// ── Timeline Types ──

export type TimelineRange = {
  start: Date;
  end: Date;
  totalDays: number;
};

export type DragState = {
  phaseId: string;
  barType: "estimated" | "worst";
  mode: "move" | "resize-left" | "resize-right";
  startX: number;
  origStart: Date;
  origEnd: Date;
} | null;

// Re-export Prisma types
export type {
  Project,
  Phase,
  Staff,
  PhaseAssignment,
  Document,
  Photo,
  Checklist,
  ChecklistItem,
  Notification,
  User,
  ProjectMember,
};
