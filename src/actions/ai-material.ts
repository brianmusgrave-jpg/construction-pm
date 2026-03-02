"use server";

/**
 * @file ai-material.ts
 * @description AI-powered material management features — Sprint 31.
 * 1. Material list generator: AI generates required materials from scope/phase description
 * 2. Procurement risk analysis: AI assesses delivery risk for current materials
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { callAI } from "@/lib/ai";

const dbc = db as any;

export async function generateMaterialList(
  scopeDescription: string,
  projectId: string,
  phaseId?: string
) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Not authenticated" };

  try {
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { name: true, address: true },
    });

    let phaseContext = "";
    if (phaseId) {
      const phase = await db.phase.findUnique({
        where: { id: phaseId },
        select: { name: true, status: true },
      });
      if (phase) phaseContext = `Phase: ${phase.name} (${phase.status})`;
    }

    const messages = [
      {
        role: "system" as const,
        content: `You are a construction material estimator.
Generate a practical material list based on the scope description.
Return JSON: {
  "items": [
    {
      "name": "specific material name (e.g., 'Portland Cement Type I/II')",
      "quantity": number,
      "unit": "string (e.g., 'bags', 'sq ft', 'linear ft', 'each', 'cubic yards')",
      "unitCost": number (estimated cost per unit in USD, 2025 pricing),
      "supplier": "string (suggested supplier type, e.g., 'Local lumber yard', 'Specialty distributor')",
      "leadTime": "string (estimated lead time, e.g., '1-2 days', '2-3 weeks')",
      "category": "STRUCTURAL" | "FINISH" | "MEP" | "SITE" | "SPECIALTY"
    }
  ],
  "totalEstimate": number (sum of quantity * unitCost for all items),
  "notes": "string (assumptions, alternatives, or important considerations)"
}
Generate 5-15 items. Use realistic 2025 US pricing. Include common but easy-to-forget items.`,
      },
      {
        role: "user" as const,
        content: `Project: ${project?.name || "Unknown"}, Address: ${project?.address || "N/A"}
${phaseContext}

Generate a material list for: "${scopeDescription}"`,
      },
    ];

    const response = await callAI(messages, {
      feature: "ai_material_list",
      userId: session.user.id,
      temperature: 0.4,
      maxTokens: 1200,
    });

    const text = response.text || "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const materialList = JSON.parse(cleaned);

    return { success: true, materialList };
  } catch (e: any) {
    return { success: false, error: e.message || "Material list generation failed" };
  }
}

export async function analyzeProcurementRisk(
  phaseId: string,
  projectId: string
) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Not authenticated" };

  try {
    const materials = await dbc.material.findMany({
      where: { phaseId },
      orderBy: { createdAt: "asc" },
    });

    if (materials.length === 0) {
      return { success: false, error: "No materials found for this phase" };
    }

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    });

    const phase = await db.phase.findUnique({
      where: { id: phaseId },
      select: { name: true, estStart: true, estEnd: true, status: true },
    });

    const materialSummary = materials.map((m: any) => ({
      name: m.name,
      quantity: m.quantity,
      unit: m.unit,
      cost: m.cost ? Number(m.cost) : null,
      supplier: m.supplier,
      status: m.status,
      deliveredAt: m.deliveredAt,
    }));

    const messages = [
      {
        role: "system" as const,
        content: `You are a construction procurement risk analyst.
Analyze the materials list for delivery risks, supply chain issues, and scheduling concerns.
Return JSON: {
  "overallRisk": "LOW" | "MEDIUM" | "HIGH",
  "riskScore": number (1-10),
  "atRiskItems": [
    {
      "material": "string (material name)",
      "risk": "HIGH" | "MEDIUM" | "LOW",
      "reason": "string (why this item is at risk)",
      "mitigation": "string (suggested action)"
    }
  ],
  "supplyChainConcerns": ["string array of general supply chain issues"],
  "scheduleRisks": ["string array of schedule-related material risks"],
  "costRisks": ["string array of potential cost escalation items"],
  "recommendations": ["string array of procurement recommendations"]
}`,
      },
      {
        role: "user" as const,
        content: `Project: ${project?.name || "Unknown"}
Phase: ${phase?.name || "Unknown"}, Status: ${phase?.status}, Timeline: ${phase?.estStart} to ${phase?.estEnd}
Materials (${materials.length} items):
${materialSummary.map((m: any) => `- ${m.name}: ${m.quantity} ${m.unit}, Status: ${m.status}, Supplier: ${m.supplier || "TBD"}`).join("\n")}

Analyze procurement risks for these materials.`,
      },
    ];

    const response = await callAI(messages, {
      feature: "ai_procurement_risk",
      userId: session.user.id,
      temperature: 0.3,
      maxTokens: 800,
    });

    const text = response.text || "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const riskAnalysis = JSON.parse(cleaned);

    return { success: true, riskAnalysis };
  } catch (e: any) {
    return { success: false, error: e.message || "Procurement risk analysis failed" };
  }
}
