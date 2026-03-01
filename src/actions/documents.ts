"use server";

/**
 * @file actions/documents.ts
 * @description Server actions for document upload, status workflow, and deletion.
 *
 * Documents are files attached to a phase (permits, contracts, invoices, blueprints,
 * inspection reports, etc.). They live in Vercel Blob storage; the DB record holds
 * metadata and a reference URL.
 *
 * Status workflow: PENDING → APPROVED | REJECTED | EXPIRED
 * (EXPIRED is set by external processes, not through this file.)
 *
 * Notification events:
 *   - DOCUMENT_UPLOADED        → all project members on creation
 *   - DOCUMENT_STATUS_CHANGED  → the uploader when their document is approved/rejected
 *
 * Auth:
 *   - create: any role with "create document" permission
 *   - updateStatus: any role with "update document" permission (PM+)
 *   - delete: any role with "delete document" permission
 *
 * Blob cleanup: deletion attempts to remove the Vercel Blob object before
 * removing the DB record. If blob deletion fails (e.g. already removed),
 * the error is logged but the DB deletion still proceeds.
 */

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { del } from "@vercel/blob";
import { notify, getProjectMemberIds } from "@/lib/notifications";

type DocCategory = "PERMIT" | "CONTRACT" | "INVOICE" | "BLUEPRINT" | "INSPECTION" | "OTHER";
type DocStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";

// ── Mutations ──

/**
 * Record a newly uploaded document in the database.
 * The file itself is uploaded to Vercel Blob by the client before this action
 * is called — this action receives the resulting URL and metadata.
 * Logs a DOCUMENT_UPLOADED activity and notifies all project members.
 *
 * Requires: "create document" permission.
 */
export async function createDocument(data: {
  phaseId: string;
  name: string;
  url: string;       // Vercel Blob URL
  size: number;      // File size in bytes
  mimeType: string;
  category: DocCategory;
  notes?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const userRole = session.user.role || "VIEWER";
  if (!can(userRole, "create", "document")) throw new Error("Forbidden");

  // Verify phase exists and fetch projectId for revalidation and notifications
  const phase = await db.phase.findUnique({
    where: { id: data.phaseId },
    select: { id: true, projectId: true, name: true },
  });
  if (!phase) throw new Error("Phase not found");

  const document = await db.document.create({
    data: {
      name: data.name,
      url: data.url,
      size: data.size,
      mimeType: data.mimeType,
      category: data.category,
      notes: data.notes,
      phaseId: data.phaseId,
      uploadedById: session.user.id,
    },
  });

  // Activity log (awaited — important for document audit trails)
  await db.activityLog.create({
    data: {
      orgId: session.user.orgId!,
      action: "DOCUMENT_UPLOADED",
      message: `Uploaded "${data.name}" to ${phase.name}`,
      projectId: phase.projectId,
      userId: session.user.id,
      data: {
        documentId: document.id,
        phaseId: phase.id,
        category: data.category,
      },
    },
  });

  // Notify all project members of the new document
  const memberIds = await getProjectMemberIds(phase.projectId);
  notify({
    type: "DOCUMENT_UPLOADED",
    title: `New Document: ${data.name}`,
    message: `"${data.name}" uploaded to ${phase.name}`,
    recipientIds: memberIds,
    actorId: session.user.id,
    data: { projectId: phase.projectId, phaseId: phase.id, documentId: document.id },
  });

  revalidatePath(`/dashboard/projects/${phase.projectId}`);
  return document;
}

/**
 * Update a document's review status (APPROVED, REJECTED, etc.).
 * Logs the status change and notifies the original uploader.
 *
 * Requires: "update document" permission (PM+ level).
 */
export async function updateDocumentStatus(
  documentId: string,
  status: DocStatus
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const userRole = session.user.role || "VIEWER";
  if (!can(userRole, "update", "document")) throw new Error("Forbidden");

  const document = await db.document.findUnique({
    where: { id: documentId },
    include: {
      phase: { select: { projectId: true, name: true } },
    },
  });
  if (!document) throw new Error("Document not found");

  const updated = await db.document.update({
    where: { id: documentId },
    data: { status },
  });

  await db.activityLog.create({
    data: {
      orgId: session.user.orgId!,
      action: "DOCUMENT_STATUS_CHANGED",
      message: `${status === "APPROVED" ? "Approved" : status === "REJECTED" ? "Rejected" : "Updated"} "${document.name}" in ${document.phase.name}`,
      projectId: document.phase.projectId,
      userId: session.user.id,
      data: {
        documentId,
        phaseId: document.phaseId,
        oldStatus: document.status,
        newStatus: status,
      },
    },
  });

  // Notify the uploader (not all members) of the decision
  const statusLabel = status === "APPROVED" ? "approved" : status === "REJECTED" ? "rejected" : "updated";
  if (document.uploadedById) {
    notify({
      type: "DOCUMENT_STATUS_CHANGED",
      title: `Document ${statusLabel}: ${document.name}`,
      message: `"${document.name}" in ${document.phase.name} was ${statusLabel}`,
      recipientIds: [document.uploadedById],
      actorId: session.user.id,
      data: { projectId: document.phase.projectId, phaseId: document.phaseId, documentId, documentName: document.name, newStatus: status },
    });
  }

  revalidatePath(`/dashboard/projects/${document.phase.projectId}`);
  return updated;
}

/**
 * Delete a document: removes the file from Vercel Blob, then deletes the DB record.
 * If Blob deletion fails (e.g. already deleted), the error is logged and DB
 * deletion continues — prevents orphaned DB records from blocking cleanup.
 *
 * Requires: "delete document" permission.
 */
export async function deleteDocument(documentId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const userRole = session.user.role || "VIEWER";
  if (!can(userRole, "delete", "document")) throw new Error("Forbidden");

  const document = await db.document.findUnique({
    where: { id: documentId },
    include: {
      phase: { select: { projectId: true, name: true } },
    },
  });
  if (!document) throw new Error("Document not found");

  // Remove from Vercel Blob — failure is non-fatal (blob may have been cleaned up already)
  try {
    await del(document.url);
  } catch (e) {
    console.error("Failed to delete blob:", e);
    // Continue with DB deletion even if blob delete fails
  }

  await db.document.delete({ where: { id: documentId } });

  revalidatePath(`/dashboard/projects/${document.phase.projectId}`);
  return { success: true };
}
