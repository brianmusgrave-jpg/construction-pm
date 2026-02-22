"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { del } from "@vercel/blob";
import { DocCategory, DocStatus } from "@prisma/client";
import { notify, getProjectMemberIds } from "@/lib/notifications";

export async function createDocument(data: {
  phaseId: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  category: DocCategory;
  notes?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const userRole = session.user.role || "VIEWER";
  if (!can(userRole, "create", "document")) throw new Error("Forbidden");

  // Verify phase exists and get project ID for revalidation
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

  // Log activity
  await db.activityLog.create({
    data: {
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

  // Notify project members about new document
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

export async function updateDocumentStatus(
  documentId: string,
  status: DocStatus
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const userRole = session.user.role || "VIEWER";
  // Only PM+ can approve/reject documents
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

  // Notify the document uploader about status change
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

  // Delete from Vercel Blob storage
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
