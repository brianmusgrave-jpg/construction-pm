"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

const dbc = db as any;

export async function getDrawings(phaseId: string) {
  return dbc.drawing
    .findMany({
      where: { phaseId },
      include: { uploadedBy: { select: { id: true, name: true } } },
      orderBy: [{ discipline: "asc" }, { drawingNumber: "asc" }],
    })
    .catch(() => []);
}

export async function createDrawing(data: {
  phaseId: string;
  title: string;
  drawingNumber: string;
  discipline: string;
  revision?: string;
  description?: string;
  fileUrl?: string;
  sheetSize?: string;
  scale?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "create", "document")) throw new Error("Forbidden");

  const drawing = await dbc.drawing.create({
    data: {
      title: data.title,
      drawingNumber: data.drawingNumber,
      discipline: data.discipline,
      revision: data.revision || "0",
      description: data.description,
      fileUrl: data.fileUrl,
      sheetSize: data.sheetSize,
      scale: data.scale,
      phaseId: data.phaseId,
      uploadedById: session.user.id,
    },
    include: { uploadedBy: { select: { id: true, name: true } } },
  });

  revalidatePath(`/dashboard/projects`);
  return drawing;
}

export async function updateDrawingStatus(id: string, status: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "update", "document")) throw new Error("Forbidden");

  await dbc.drawing.update({ where: { id }, data: { status } });
  revalidatePath(`/dashboard/projects`);
}

export async function deleteDrawing(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "delete", "document")) throw new Error("Forbidden");

  await dbc.drawing.delete({ where: { id } });
  revalidatePath(`/dashboard/projects`);
}
