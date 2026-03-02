"use server";

/**
 * @file ai-payment-app.ts
 * @description AI-powered payment application features — Sprint 32.
 * 1. Payment application validator: AI checks math, reasonableness, and AIA compliance
 * 2. Payment schedule forecaster: AI predicts upcoming payment milestones
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { callAI } from "@/lib/ai";

const dbc = db as any;

export async function validatePaymentApplication(
  applicationId: string,
  projectId: string
) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Not authenticated" };

  try {
    const app = await dbc.paymentApplication.findUnique({
      where: { id: applicationId },
    });
    if (!app) return { success: false, error: "Payment application not found" };

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { name: true, budget: true },
    });

    const phase = await db.phase.findUnique({
      where: { id: app.phaseId },
      select: { name: true, status: true, progress: true },
    });

    const allApps = await dbc.paymentApplication.findMany({
      where: { phaseId: app.phaseId },
      orderBy: { number: "asc" },
    });

    const appData = {
      number: app.number,
      periodStart: app.periodStart,
      periodEnd: app.periodEnd,
      scheduledValue: app.scheduledValue ? Number(app.scheduledValue) : 0,
      workCompleted: app.workCompleted ? Number(app.workCompleted) : 0,
      materialsStored: app.materialsStored ? Number(app.materialsStored) : 0,
      retainage: app.retainage ? Number(app.retainage) : 0,
      previousPayments: app.previousPayments ? Number(app.previousPayments) : 0,
      currentDue: app.currentDue ? Number(app.currentDue) : 0,
      status: app.status,
      notes: app.notes,
    };

    const historySummary = allApps
      .filter((a: any) => a.id !== applicationId)
      .map((a: any) => ({
        number: a.number,
        workCompleted: a.workCompleted ? Number(a.workCompleted) : 0,
        currentDue: a.currentDue ? Number(a.currentDue) : 0,
        status: a.status,
      }));

    const messages = [
      {
        role: "system" as const,
        content: `You are a construction payment application auditor (AIA G702/G703 style).
Validate this payment application for mathematical accuracy, reasonableness, and compliance.
Return JSON: {
  "valid": boolean,
  "validationScore": number (1-10),
  "mathCheck": {
    "currentDueCalculated": number (workCompleted + materialsStored - retainage - previousPayments),
    "currentDueSubmitted": number,
    "mathCorrect": boolean,
    "variance": number (if any)
  },
  "issues": [
    {
      "severity": "ERROR" | "WARNING" | "INFO",
      "category": "MATH" | "COMPLIANCE" | "REASONABLENESS" | "DOCUMENTATION",
      "issue": "string (what's wrong)",
      "recommendation": "string (how to fix)"
    }
  ],
  "percentComplete": number (workCompleted / scheduledValue * 100),
  "retainageRate": number (retainage / workCompleted * 100),
  "overbillingRisk": "NONE" | "LOW" | "MODERATE" | "HIGH",
  "recommendations": ["string array of actions"],
  "summary": "1-2 sentence validation summary"
}`,
      },
      {
        role: "user" as const,
        content: `Project: ${project?.name || "Unknown"}, Budget: $${project?.budget || "N/A"}
Phase: ${phase?.name || "Unknown"}, Status: ${phase?.status}, Progress: ${phase?.progress || 0}%

Payment Application #${appData.number}:
- Period: ${appData.periodStart} to ${appData.periodEnd}
- Scheduled Value: $${appData.scheduledValue.toLocaleString()}
- Work Completed: $${appData.workCompleted.toLocaleString()}
- Materials Stored: $${appData.materialsStored.toLocaleString()}
- Retainage: $${appData.retainage.toLocaleString()}
- Previous Payments: $${appData.previousPayments.toLocaleString()}
- Current Due: $${appData.currentDue.toLocaleString()}
- Status: ${appData.status}

Prior Applications: ${historySummary.length}
${historySummary.map((h: any) => `  #${h.number}: Work $${h.workCompleted}, Due $${h.currentDue}, Status: ${h.status}`).join("\n")}

Validate this payment application.`,
      },
    ];

    const response = await callAI(messages, {
      feature: "ai_payment_validate",
      userId: session.user.id,
      temperature: 0.2,
      maxTokens: 800,
    });

    const text = response.text || "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const validation = JSON.parse(cleaned);

    return { success: true, validation };
  } catch (e: any) {
    return { success: false, error: e.message || "Payment validation failed" };
  }
}

export async function forecastPaymentSchedule(
  phaseId: string,
  projectId: string
) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Not authenticated" };

  try {
    const apps = await dbc.paymentApplication.findMany({
      where: { phaseId },
      orderBy: { number: "asc" },
    });

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { name: true, budget: true },
    });

    const phase = await db.phase.findUnique({
      where: { id: phaseId },
      select: { name: true, status: true, progress: true, estStart: true, estEnd: true },
    });

    const appSummary = apps.map((a: any) => ({
      number: a.number,
      periodStart: a.periodStart,
      periodEnd: a.periodEnd,
      scheduledValue: a.scheduledValue ? Number(a.scheduledValue) : 0,
      workCompleted: a.workCompleted ? Number(a.workCompleted) : 0,
      currentDue: a.currentDue ? Number(a.currentDue) : 0,
      status: a.status,
    }));

    const totalBilled = appSummary.reduce((s: number, a: any) => s + a.workCompleted, 0);

    const messages = [
      {
        role: "system" as const,
        content: `You are a construction payment schedule forecasting AI.
Based on payment history and phase progress, forecast upcoming payment milestones.
Return JSON: {
  "projectedRemaining": number (estimated total remaining to bill),
  "estimatedApplicationsLeft": number,
  "monthlyBurnRate": number (average monthly billing based on history),
  "projectedCompletionDate": "string (estimated date for final billing)",
  "forecast": [
    {
      "applicationNumber": number,
      "estimatedDate": "string (YYYY-MM)",
      "projectedAmount": number,
      "milestone": "string (e.g., 'Rough-in complete', 'Final billing')"
    }
  ],
  "cashFlowRisks": ["string array of cash flow concerns"],
  "retainageRelease": {
    "estimatedAmount": number,
    "estimatedDate": "string (when retainage might be released)",
    "conditions": ["string array of typical release conditions"]
  },
  "recommendations": ["string array of payment scheduling recommendations"],
  "summary": "1-2 sentence forecast summary"
}`,
      },
      {
        role: "user" as const,
        content: `Project: ${project?.name || "Unknown"}, Budget: $${project?.budget || "N/A"}
Phase: ${phase?.name || "Unknown"}, Status: ${phase?.status}, Progress: ${phase?.progress || 0}%
Timeline: ${phase?.estStart || "TBD"} to ${phase?.estEnd || "TBD"}

Payment History (${apps.length} applications, total billed: $${totalBilled.toLocaleString()}):
${appSummary.map((a: any) => `- #${a.number}: Period ${a.periodStart} to ${a.periodEnd}, Scheduled: $${a.scheduledValue.toLocaleString()}, Work: $${a.workCompleted.toLocaleString()}, Due: $${a.currentDue.toLocaleString()}`).join("\n")}

Forecast the remaining payment schedule for this phase.`,
      },
    ];

    const response = await callAI(messages, {
      feature: "ai_payment_forecast",
      userId: session.user.id,
      temperature: 0.4,
      maxTokens: 800,
    });

    const text = response.text || "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const forecast = JSON.parse(cleaned);

    return { success: true, forecast };
  } catch (e: any) {
    return { success: false, error: e.message || "Payment forecast failed" };
  }
}
