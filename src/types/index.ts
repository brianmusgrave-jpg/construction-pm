// ── Local Type Definitions ──

interface Project {
  id: string;
  name: string;
  description?: string | null;
  address?: string | null;
  planApproval?: Date | null;
  budget?: number | null;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Phase {
  id: string;
  projectId: string;
  name: string;
  detail?: string | null;
  status: string;
  isMilestone: boolean;
  estStart: Date;
  estEnd: Date;
  worstStart?: Date | null;
  worstEnd?: Date | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

interface Staff {
  id: string;
  name: string;
  company?: string | null;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PhaseAssignment {
  id: string;
  phaseId: string;
  staffId: string;
  isOwner: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface Document {
  id: string;
  phaseId: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  category: string;
  status: string;
  version: number;
  notes?: string | null;
  uploadedById: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Photo {
  id: string;
  phaseId: string;
  url: string;
  caption?: string | null;
  uploadedById: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Checklist {
  id: string;
  phaseId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ChecklistItem {
  id: string;
  checklistId: string;
  title: string;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  actorId?: string | null;
  data?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

interface User {
  id: string;
  name?: string | null;
  email?: string | null;
  emailVerified?: Date | null;
  image?: string | null;
  role?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

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

// Export local types
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
