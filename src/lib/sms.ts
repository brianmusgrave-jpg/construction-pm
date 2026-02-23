/**
 * SMS service using Twilio.
 * Gracefully skips if TWILIO env vars are not set.
 */

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

interface SendSMSOptions {
  to: string; // E.164 format: +1234567890
  body: string;
}

/**
 * Send an SMS via Twilio.
 * Returns true if sent, false if skipped or failed.
 */
export async function sendSMS(options: SendSMSOptions): Promise<boolean> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.log("[sms] Skipped — Twilio credentials not configured");
    return false;
  }

  // Basic E.164 validation
  if (!options.to.match(/^\+[1-9]\d{1,14}$/)) {
    console.log("[sms] Skipped — invalid phone number:", options.to);
    return false;
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const auth = Buffer.from(
      `${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`
    ).toString("base64");

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: TWILIO_PHONE_NUMBER,
        To: options.to,
        Body: options.body,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[sms] Twilio error:", err);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[sms] Failed to send:", error);
    return false;
  }
}

// ── SMS Templates ──

export async function sendPhaseStatusSMS(
  phone: string,
  projectName: string,
  phaseName: string,
  newStatus: string
): Promise<boolean> {
  const statusLabels: Record<string, string> = {
    PENDING: "Pending",
    IN_PROGRESS: "In Progress",
    REVIEW_REQUESTED: "Review Requested",
    UNDER_REVIEW: "Under Review",
    COMPLETE: "Complete",
  };
  const label = statusLabels[newStatus] || newStatus;

  return sendSMS({
    to: phone,
    body: `[Construction PM] ${phaseName} is now "${label}" in ${projectName}.`,
  });
}

export async function sendReviewRequestSMS(
  phone: string,
  projectName: string,
  phaseName: string
): Promise<boolean> {
  return sendSMS({
    to: phone,
    body: `[Construction PM] Review requested for ${phaseName} in ${projectName}. Please check the app.`,
  });
}

export async function sendChecklistCompleteSMS(
  phone: string,
  projectName: string,
  phaseName: string
): Promise<boolean> {
  return sendSMS({
    to: phone,
    body: `[Construction PM] All checklist items complete for ${phaseName} in ${projectName}.`,
  });
}

export async function sendDocumentStatusSMS(
  phone: string,
  projectName: string,
  documentName: string,
  status: string
): Promise<boolean> {
  const label = status === "APPROVED" ? "approved" : "rejected";
  return sendSMS({
    to: phone,
    body: `[Construction PM] Document "${documentName}" has been ${label} in ${projectName}.`,
  });
}
