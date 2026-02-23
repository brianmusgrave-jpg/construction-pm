// Global test setup
import { vi } from "vitest";

// Mock Next.js cache revalidation
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Mock Prisma client
vi.mock("@/lib/db", () => ({
  db: {
    project: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    phase: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    projectMember: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    invitation: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    notification: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    activityLog: {
      findMany: vi.fn(),
      create: vi.fn().mockReturnValue({ catch: vi.fn() }),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    photo: {
      create: vi.fn(),
      createMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    document: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    checklist: {
      findUnique: vi.fn(),
    },
    checklistItem: {
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock notifications
vi.mock("@/lib/notifications", () => ({
  notify: vi.fn(),
  getProjectMemberIds: vi.fn().mockResolvedValue([]),
}));

// Mock email
vi.mock("@/lib/email", () => ({
  sendInvitationEmail: vi.fn().mockResolvedValue(true),
  sendPhaseStatusEmail: vi.fn().mockResolvedValue(true),
  sendReviewRequestEmail: vi.fn().mockResolvedValue(true),
  sendChecklistCompleteEmail: vi.fn().mockResolvedValue(true),
  sendDocumentStatusEmail: vi.fn().mockResolvedValue(true),
}));
