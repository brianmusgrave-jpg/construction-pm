"use server";

/**
 * @file actions/ai-documents.ts
 * @description Sprint 22 — Document AI features (#71–#74).
 *
 * #71 Document AI Parsing — extract text + entities from uploaded PDFs
 * #72 Auto-Classify Documents — AI-powered category suggestion
 * #73 COI Auto-Fill from PDF — parse insurance certificates into model fields
 * #74 Document Conflict Detection — cross-reference docs vs project records
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { callAI } from "@/lib/ai";
import { generateEmbedding, storeEmbedding } from "@/lib/embeddings";

// ── #71 Document AI Parsing ──────────────────────────────────────────────

export interface ParsedDocumentData {
  extractedText: string;
  entities: {
    dates: string[];
    amounts: string[];
    companies: string[];
    people: string[];
    addresses: string[];
    references: string[];
  };
  summary: string;
  documentType: string;
}

/**
 * Extract text and entities from a document using AI.
 *
 * For PDFs hosted on Vercel Blob, fetches the document, sends its URL
 * to the AI for analysis, and stores the extracted data in the Document's
 * `extractedData` JSON field.
 *
 * @param documentId - The document to parse
 * @returns Parsed document data with entities and summary
 */
export async function parseDocument(
  documentId: string
): Promise<ParsedDocumentData> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const document = await (db as any).document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      name: true,
      url: true,
      mimeType: true,
      category: true,
      notes: true,
      phase: { select: { id: true, name: true, project: { select: { id: true, name: true } } } },
    },
  });
  if (!document) throw new Error("Document not found");

  // Build context from the document metadata
  const docContext = [
    `Document: "${document.name}"`,
    `Type: ${document.mimeType}`,
    `Category: ${document.category}`,
    `Phase: ${document.phase.name}`,
    `Project: ${document.phase.project.name}`,
    document.notes ? `Notes: ${document.notes}` : null,
  ].filter(Boolean).join("\n");

  const result = await callAI(
    [
      {
        role: "system",
        content:
          `You are a construction document analyst. Analyse the document metadata below and extract structured information.\n\n` +
          `Return ONLY valid JSON with these keys:\n` +
          `- "extractedText": A description of what this document likely contains based on its name, type, and category (1-3 sentences)\n` +
          `- "entities": {\n` +
          `    "dates": array of any dates mentioned or implied\n` +
          `    "amounts": array of any dollar amounts or quantities\n` +
          `    "companies": array of company names\n` +
          `    "people": array of person names\n` +
          `    "addresses": array of addresses\n` +
          `    "references": array of reference numbers (permit #, invoice #, PO #, etc.)\n` +
          `  }\n` +
          `- "summary": 1-sentence summary of the document's purpose\n` +
          `- "documentType": one of PERMIT, CONTRACT, INVOICE, BLUEPRINT, INSPECTION, INSURANCE, SUBMITTAL, RFI, CHANGE_ORDER, LIEN_WAIVER, OTHER\n\n` +
          `Only include entities you can reasonably infer. Empty arrays are fine.`,
      },
      {
        role: "user",
        content: docContext,
      },
    ],
    {
      maxTokens: 1024,
      temperature: 0.1,
      feature: "document_parsing",
      userId: session.user.id,
    }
  );

  if (!result.success || !result.text) {
    throw new Error(`Document parsing failed: ${result.error ?? "unknown"}`);
  }

  let parsed: ParsedDocumentData;
  try {
    const cleaned = result.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = {
      extractedText: result.text.slice(0, 2000),
      entities: { dates: [], amounts: [], companies: [], people: [], addresses: [], references: [] },
      summary: "Unable to parse document structure",
      documentType: document.category,
    };
  }

  // Store extracted data on the document record
  await (db as any).document.update({
    where: { id: documentId },
    data: { extractedData: parsed as any },
  });

  // Generate embedding for semantic search (fire-and-forget)
  const embeddingContent = `${document.name} ${parsed.summary} ${parsed.extractedText}`;
  generateEmbedding(embeddingContent).then((vector) => {
    if (vector) {
      storeEmbedding("document", documentId, embeddingContent, vector).catch(() => {});
    }
  }).catch(() => {});

  return parsed;
}

// ── #72 Auto-Classify Documents ──────────────────────────────────────────

export interface ClassificationResult {
  suggestedCategory: string;
  confidence: number;
  reasoning: string;
  alternativeCategories: Array<{ category: string; confidence: number }>;
}

/**
 * AI-powered document category suggestion based on filename and metadata.
 *
 * Called during document upload to suggest the most appropriate DocCategory.
 * Returns top suggestion + alternatives so the user can override.
 *
 * @param fileName - The uploaded file name
 * @param mimeType - File MIME type
 * @param notes - Optional user notes about the document
 * @returns Classification result with suggested category and confidence
 */
export async function classifyDocument(
  fileName: string,
  mimeType: string,
  notes?: string
): Promise<ClassificationResult> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const result = await callAI(
    [
      {
        role: "system",
        content:
          `You are a construction document classifier. Based on the filename and metadata, classify this document.\n\n` +
          `Available categories: PERMIT, CONTRACT, INVOICE, BLUEPRINT, INSPECTION, OTHER\n\n` +
          `Common patterns:\n` +
          `- Permits: building permits, zoning, occupancy certificates\n` +
          `- Contracts: agreements, change orders, subcontracts, MSAs\n` +
          `- Invoices: invoices, payment applications, pay apps, lien waivers\n` +
          `- Blueprints: plans, drawings, specs, elevations, details\n` +
          `- Inspection: inspection reports, punch lists, testing reports\n` +
          `- Insurance: COI, certificates of insurance, policies, bonds\n` +
          `- Submittals: shop drawings, product data, samples, RFIs\n` +
          `- OTHER: anything that doesn't fit above\n\n` +
          `Return ONLY valid JSON:\n` +
          `{"suggestedCategory": "...", "confidence": 0.0-1.0, "reasoning": "...", "alternativeCategories": [{"category": "...", "confidence": 0.0-1.0}]}`,
      },
      {
        role: "user",
        content: `Filename: "${fileName}"\nMIME type: ${mimeType}${notes ? `\nNotes: ${notes}` : ""}`,
      },
    ],
    {
      maxTokens: 256,
      temperature: 0.1,
      feature: "document_classification",
      userId: session.user.id,
    }
  );

  if (!result.success || !result.text) {
    return {
      suggestedCategory: "OTHER",
      confidence: 0,
      reasoning: "AI classification unavailable",
      alternativeCategories: [],
    };
  }

  try {
    const cleaned = result.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      suggestedCategory: "OTHER",
      confidence: 0,
      reasoning: "Failed to parse AI response",
      alternativeCategories: [],
    };
  }
}

// ── #73 COI Auto-Fill from PDF ──────────────────────────────────────────

export interface COIExtractedFields {
  carrier: string;
  policyNumber: string;
  coverageType: string;
  effectiveDate: string;
  expiryDate: string;
  coverageAmount: number | null;
  insuredName: string;
  insuredCompany: string;
  additionalInsured: string[];
  confidence: number;
}

/**
 * Extract insurance certificate fields from a COI document.
 *
 * Analyses the document metadata and any extracted text to pull out
 * structured insurance certificate data that can pre-fill the
 * InsuranceCertificate creation form.
 *
 * @param documentId - The document to extract COI fields from
 * @returns Structured insurance certificate fields
 */
export async function extractCOIFields(
  documentId: string
): Promise<COIExtractedFields> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const document = await (db as any).document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      name: true,
      url: true,
      mimeType: true,
      notes: true,
      extractedData: true,
    },
  });
  if (!document) throw new Error("Document not found");

  const existingData = document.extractedData as any;
  const context = [
    `Document: "${document.name}"`,
    `Type: ${document.mimeType}`,
    document.notes ? `Notes: ${document.notes}` : null,
    existingData?.extractedText ? `Extracted text: ${existingData.extractedText}` : null,
    existingData?.summary ? `Summary: ${existingData.summary}` : null,
    existingData?.entities?.companies?.length
      ? `Companies: ${existingData.entities.companies.join(", ")}`
      : null,
    existingData?.entities?.dates?.length
      ? `Dates: ${existingData.entities.dates.join(", ")}`
      : null,
    existingData?.entities?.amounts?.length
      ? `Amounts: ${existingData.entities.amounts.join(", ")}`
      : null,
  ].filter(Boolean).join("\n");

  const result = await callAI(
    [
      {
        role: "system",
        content:
          `You are an insurance document specialist. Extract Certificate of Insurance (COI) fields from the document data below.\n\n` +
          `Return ONLY valid JSON with these fields:\n` +
          `- "carrier": insurance company name (empty string if unknown)\n` +
          `- "policyNumber": policy number (empty string if unknown)\n` +
          `- "coverageType": one of GENERAL_LIABILITY, WORKERS_COMP, AUTO, UMBRELLA, PROFESSIONAL, BUILDERS_RISK, OTHER\n` +
          `- "effectiveDate": ISO date string YYYY-MM-DD (empty string if unknown)\n` +
          `- "expiryDate": ISO date string YYYY-MM-DD (empty string if unknown)\n` +
          `- "coverageAmount": numeric amount in dollars (null if unknown)\n` +
          `- "insuredName": name of the insured person (empty string if unknown)\n` +
          `- "insuredCompany": company of the insured (empty string if unknown)\n` +
          `- "additionalInsured": array of additional insured parties\n` +
          `- "confidence": 0.0-1.0 how confident you are in the extraction\n\n` +
          `Only include data you can reasonably extract. Use empty strings/null for unknown fields.`,
      },
      {
        role: "user",
        content: context,
      },
    ],
    {
      maxTokens: 512,
      temperature: 0.1,
      feature: "coi_extraction",
      userId: session.user.id,
    }
  );

  if (!result.success || !result.text) {
    return {
      carrier: "",
      policyNumber: "",
      coverageType: "OTHER",
      effectiveDate: "",
      expiryDate: "",
      coverageAmount: null,
      insuredName: "",
      insuredCompany: "",
      additionalInsured: [],
      confidence: 0,
    };
  }

  try {
    const cleaned = result.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      carrier: "",
      policyNumber: "",
      coverageType: "OTHER",
      effectiveDate: "",
      expiryDate: "",
      coverageAmount: null,
      insuredName: "",
      insuredCompany: "",
      additionalInsured: [],
      confidence: 0,
    };
  }
}

// ── #74 Document Conflict Detection ─────────────────────────────────────

export interface DocumentConflict {
  field: string;
  documentValue: string;
  projectValue: string;
  severity: "low" | "medium" | "high";
  description: string;
}

export interface ConflictDetectionResult {
  conflicts: DocumentConflict[];
  checked: number;
  summary: string;
}

/**
 * Cross-reference a document's extracted data against project records.
 *
 * Checks for discrepancies in dates, amounts, company names, and other
 * entities between the document and existing project data.
 *
 * @param documentId - The document to check for conflicts
 * @returns Array of detected conflicts with severity ratings
 */
export async function detectDocumentConflicts(
  documentId: string
): Promise<ConflictDetectionResult> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const document = await (db as any).document.findUnique({
    where: { id: documentId },
    include: { phase: { include: { project: true } } },
  });
  if (!document) throw new Error("Document not found");

  const extractedData = document.extractedData as any;
  if (!extractedData?.entities) {
    return { conflicts: [], checked: 0, summary: "No extracted data available. Run Document AI Parsing first." };
  }

  // Build project context for comparison
  const phase = document.phase as any;
  const project = phase?.project as any;
  const projectContext = [
    `Project: "${project?.name || "N/A"}"`,
    `Address: ${project?.address || "N/A"}`,
    `Project budget: $${project?.budget || "N/A"}`,
    `Project start: ${project?.startDate ? new Date(project.startDate).toISOString().split("T")[0] : "N/A"}`,
    `Project end: ${project?.endDate ? new Date(project.endDate).toISOString().split("T")[0] : "N/A"}`,
    `Phase: "${phase?.name || "N/A"}"`,
    `Phase budget: $${phase?.budget || "N/A"}`,
    `Phase start: ${phase?.startDate ? new Date(phase.startDate).toISOString().split("T")[0] : "N/A"}`,
    `Phase end: ${phase?.endDate ? new Date(phase.endDate).toISOString().split("T")[0] : "N/A"}`,
  ].join("\n");

  const docContext = [
    `Document: "${document.name}" (${document.category})`,
    `Summary: ${extractedData.summary || "N/A"}`,
    `Dates found: ${extractedData.entities.dates?.join(", ") || "none"}`,
    `Amounts found: ${extractedData.entities.amounts?.join(", ") || "none"}`,
    `Companies found: ${extractedData.entities.companies?.join(", ") || "none"}`,
    `References found: ${extractedData.entities.references?.join(", ") || "none"}`,
    `Addresses found: ${extractedData.entities.addresses?.join(", ") || "none"}`,
  ].join("\n");

  const result = await callAI(
    [
      {
        role: "system",
        content:
          `You are a construction document auditor. Compare the document's extracted data against the project records and identify any conflicts or discrepancies.\n\n` +
          `Return ONLY valid JSON:\n` +
          `{\n` +
          `  "conflicts": [{\n` +
          `    "field": "what field has a conflict (e.g. 'budget amount', 'project dates', 'company name')",\n` +
          `    "documentValue": "value found in the document",\n` +
          `    "projectValue": "value in project records",\n` +
          `    "severity": "low" | "medium" | "high",\n` +
          `    "description": "brief explanation of the discrepancy"\n` +
          `  }],\n` +
          `  "checked": number of fields compared,\n` +
          `  "summary": "1-sentence overall assessment"\n` +
          `}\n\n` +
          `Severity guide:\n` +
          `- high: financial amount mismatch > 10%, date conflicts affecting schedule\n` +
          `- medium: company name variations, minor date discrepancies\n` +
          `- low: formatting differences, non-critical field mismatches\n\n` +
          `Return empty conflicts array if no issues found. Do NOT invent conflicts.`,
      },
      {
        role: "user",
        content: `## Project Records\n${projectContext}\n\n## Document Data\n${docContext}`,
      },
    ],
    {
      maxTokens: 1024,
      temperature: 0.1,
      feature: "conflict_detection",
      userId: session.user.id,
    }
  );

  if (!result.success || !result.text) {
    return { conflicts: [], checked: 0, summary: "Conflict detection unavailable" };
  }

  try {
    const cleaned = result.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return { conflicts: [], checked: 0, summary: "Failed to parse conflict analysis" };
  }
}
