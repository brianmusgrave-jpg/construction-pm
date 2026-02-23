/**
 * Type extensions for Sprint H new Prisma models.
 *
 * These models exist in prisma/schema.prisma but the generated client
 * (node_modules/.prisma/client) is stale. After running
 *   prisma db push && prisma generate
 * on the development machine, this file can be deleted and all imports
 * updated to use the generated types directly.
 *
 * Sprint H models: ChangeOrder, DailyLog, Inspection, SubcontractorBid,
 * Material, ApiKey, Webhook, TotpSecret, ReportSchedule, ClientToken
 */

import { db as _db } from "./db";

// Re-export the db client cast to include new model delegates
export const db = _db as typeof _db & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  changeOrder: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dailyLog: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inspection: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  subcontractorBid: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  material: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apiKey: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  webhook: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  totpSecret: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reportSchedule: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientToken: any;
};

// Inline types for Sprint H models (mirrors schema.prisma exactly)
export type ChangeOrderStatus = "PENDING" | "APPROVED" | "REJECTED";
export type InspectionResult = "PASS" | "FAIL" | "CONDITIONAL";
export type MaterialStatus = "ORDERED" | "DELIVERED" | "INSTALLED" | "RETURNED";
export type ReportFrequency = "WEEKLY" | "MONTHLY";

export interface ChangeOrder {
  id: string;
  number: string;
  title: string;
  description: string | null;
  status: ChangeOrderStatus;
  amount: number | null;
  reason: string | null;
  phaseId: string;
  requestedById: string;
  approvedById: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  requestedBy?: { id: string; name: string | null; email: string | null };
  approvedBy?: { id: string; name: string | null } | null;
  phase?: { id: string; name: string };
}

export interface DailyLog {
  id: string;
  date: Date;
  weather: string | null;
  tempHigh: number | null;
  tempLow: number | null;
  crewCount: number | null;
  equipment: string | null;
  workSummary: string;
  issues: string | null;
  notes: string | null;
  projectId: string;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
  author?: { id: string; name: string | null; email: string | null };
}

export interface Inspection {
  id: string;
  title: string;
  inspectorName: string | null;
  scheduledAt: Date;
  completedAt: Date | null;
  result: InspectionResult | null;
  notes: string | null;
  notifyOnResult: boolean;
  phaseId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubcontractorBid {
  id: string;
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  amount: number;
  notes: string | null;
  awarded: boolean;
  submittedAt: Date;
  phaseId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Material {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  status: MaterialStatus;
  cost: number | null;
  supplier: string | null;
  orderedAt: Date | null;
  deliveredAt: Date | null;
  installedAt: Date | null;
  notes: string | null;
  phaseId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiKey {
  id: string;
  name: string;
  keyHash: string;
  prefix: string;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  active: boolean;
  createdAt: Date;
}

export interface Webhook {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  lastTriggeredAt: Date | null;
  lastStatusCode: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TotpSecret {
  id: string;
  userId: string;
  secret: string;
  verified: boolean;
  createdAt: Date;
}

export interface ReportSchedule {
  id: string;
  frequency: ReportFrequency;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  sendHour: number;
  recipients: string[];
  includeProjects: string[];
  lastSentAt: Date | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClientToken {
  id: string;
  token: string;
  label: string;
  projectId: string | null;
  expiresAt: Date | null;
  active: boolean;
  createdAt: Date;
}
