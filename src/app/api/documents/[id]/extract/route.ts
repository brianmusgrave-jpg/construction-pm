import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * Document metadata extraction endpoint.
 *
 * Current implementation: heuristic extraction from filename + document fields.
 * To upgrade to real OCR, replace the `heuristicExtract` call with an
 * external service (e.g. AWS Textract, Google Document AI, or OpenAI vision).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: documentId } = await params;

  const doc = await db.document.findUnique({
    where: { id: documentId },
    include: {
      phase: { select: { projectId: true } },
    },
  });

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Verify user has access to this project
  const membership = await db.projectMember.findFirst({
    where: { projectId: doc.phase.projectId, userId: session.user.id },
  });
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Heuristic extraction from document metadata
  const extracted = heuristicExtract(doc as {
    name: string;
    url: string;
    category: string;
    notes: string | null;
  });

  // Persist extracted data
  const updated = await db.document.update({
    where: { id: documentId },
    data: { extractedData: extracted as never },
  });

  return NextResponse.json({ extractedData: updated.extractedData });
}

// ── Heuristic extractor ─────────────────────────────────────────────────────

function heuristicExtract(doc: {
  name: string;
  url: string;
  category: string;
  notes: string | null;
}) {
  const text = [doc.name, doc.notes ?? ""].join(" ");
  const name = doc.name;

  // Detect file extension
  const extMatch = doc.url.split("?")[0].match(/\.([a-zA-Z0-9]+)$/);
  const fileExtension = extMatch ? extMatch[1].toUpperCase() : "UNKNOWN";

  // Detect dates in filename / notes (various formats)
  const datePatterns = [
    /(\d{4}[-./]\d{2}[-./]\d{2})/g,
    /(\d{2}[-./]\d{2}[-./]\d{4})/g,
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s.-]\d{1,2}[\s,-]+\d{4}/gi,
  ];
  const detectedDates: string[] = [];
  for (const pattern of datePatterns) {
    const matches = text.matchAll(pattern);
    for (const m of matches) {
      const d = m[0];
      if (!detectedDates.includes(d)) detectedDates.push(d);
    }
  }

  // Detect dollar amounts
  const amountPattern = /\$[\d,]+(?:\.\d{2})?|\b\d{1,3}(?:,\d{3})+(?:\.\d{2})?\b/g;
  const detectedAmounts: string[] = [];
  const amountMatches = text.matchAll(amountPattern);
  for (const m of amountMatches) {
    if (!detectedAmounts.includes(m[0])) detectedAmounts.push(m[0]);
  }

  // Detect permit / invoice / contract numbers
  const refPatterns = [
    /(?:permit|pmt)[#:\s-]*([A-Z0-9-]{4,})/gi,
    /(?:invoice|inv)[#:\s-]*([A-Z0-9-]{4,})/gi,
    /(?:contract|ctr)[#:\s-]*([A-Z0-9-]{4,})/gi,
    /(?:ref|no|#)[.:\s]*([A-Z0-9]{5,})/gi,
  ];
  const refNumbers: string[] = [];
  for (const p of refPatterns) {
    const matches = text.matchAll(p);
    for (const m of matches) {
      if (!refNumbers.includes(m[1])) refNumbers.push(m[1]);
    }
  }

  // Category-specific hints
  const hints: Record<string, string[]> = {
    PERMIT: ["Verify expiry date", "Check issuing authority"],
    CONTRACT: ["Review payment schedule", "Note change order clause"],
    INVOICE: ["Cross-check with budget line", "Verify vendor details"],
    BLUEPRINT: ["Confirm revision number", "Check scale reference"],
    INSPECTION: ["Review pass/fail status", "Note inspector signature"],
  };

  // Detect keywords related to construction
  const constructionKeywords = [
    "foundation", "framing", "roofing", "electrical", "plumbing",
    "HVAC", "concrete", "steel", "inspection", "permit", "approval",
    "revision", "amendment", "final", "preliminary",
  ];
  const detectedKeywords = constructionKeywords.filter((kw) =>
    new RegExp(kw, "i").test(text)
  );

  // Confidence scoring (simple heuristic)
  let confidence = 0.4; // base confidence for heuristic-only extraction
  if (detectedDates.length > 0) confidence += 0.1;
  if (detectedAmounts.length > 0) confidence += 0.1;
  if (refNumbers.length > 0) confidence += 0.1;
  if (detectedKeywords.length > 2) confidence += 0.1;
  confidence = Math.min(confidence, 0.85);

  return {
    extractedAt: new Date().toISOString(),
    method: "heuristic",
    confidence: Math.round(confidence * 100),
    fileExtension,
    detectedDates,
    detectedAmounts,
    refNumbers,
    detectedKeywords,
    hints: hints[doc.category] ?? [],
    summary:
      detectedDates.length === 0 && detectedAmounts.length === 0 && refNumbers.length === 0
        ? "No structured data detected automatically. Consider uploading a text-readable PDF for better extraction."
        : `Found ${detectedDates.length} date(s), ${detectedAmounts.length} amount(s), ${refNumbers.length} reference number(s).`,
    note: "For full OCR extraction, integrate AWS Textract, Google Document AI, or OpenAI vision API.",
  };
}
