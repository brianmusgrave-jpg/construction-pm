/**
 * Email service using Resend.
 * Gracefully skips if RESEND_API_KEY is not set.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = "AccuDone <noreply@constructionpm.app>";
const APP_URL = process.env.NEXTAUTH_URL || "https://construction-pm-theta.vercel.app";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.log("[email] Skipped — RESEND_API_KEY not set");
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: options.to,
        subject: options.subject,
        html: options.html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[email] Resend error:", err);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[email] Failed to send:", error);
    return false;
  }
}

// ── Email wrapper (HTML layout) ──

function wrapHTML(content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
      <div style="padding:24px 24px 0;">
        <div style="font-size:18px;font-weight:700;color:#111827;margin-bottom:4px;">🚧 AccuDone</div>
      </div>
      <div style="padding:16px 24px 24px;">
        ${content}
      </div>
    </div>
    <div style="text-align:center;padding:16px;color:#9ca3af;font-size:12px;">
      AccuDone · You received this because you're a project member
    </div>
  </div>
</body>
</html>`;
}

function btnHTML(text: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;background:#4F6DF5;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;margin-top:16px;">${text}</a>`;
}

// ── Specific email templates ──

export async function sendAccountInviteEmail(
  email: string,
  role: string,
  inviteToken: string,
  inviterName: string
): Promise<boolean> {
  const inviteUrl = `${APP_URL}/invite/activate/${inviteToken}`;
  const roleName = role.charAt(0) + role.slice(1).toLowerCase().replace(/_/g, " ");

  return sendEmail({
    to: email,
    subject: `You've been invited to AccuDone`,
    html: wrapHTML(`
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 12px;">
        <strong>${inviterName}</strong> has invited you to join <strong>AccuDone</strong> as a <strong>${roleName}</strong>.
      </p>
      <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 4px;">
        Click below to set up your account. This link expires in 7 days.
      </p>
      ${btnHTML("Accept Invitation", inviteUrl)}
      <p style="color:#9ca3af;font-size:12px;margin-top:16px;">If you weren't expecting this invitation, you can ignore this email.</p>
    `),
  });
}

export async function sendInvitationEmail(
  email: string,
  projectName: string,
  role: string,
  inviteToken: string,
  inviterName: string
): Promise<boolean> {
  const inviteUrl = `${APP_URL}/invite/activate/${inviteToken}`;
  const roleName = role.charAt(0) + role.slice(1).toLowerCase();

  return sendEmail({
    to: email,
    subject: `You've been invited to ${projectName}`,
    html: wrapHTML(`
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 12px;">
        <strong>${inviterName}</strong> invited you to join <strong>${projectName}</strong> as a <strong>${roleName}</strong>.
      </p>
      <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 4px;">
        Click below to accept the invitation and join the project team.
      </p>
      ${btnHTML("Accept Invitation", inviteUrl)}
      <p style="color:#9ca3af;font-size:12px;margin-top:16px;">This invitation expires in 7 days.</p>
    `),
  });
}

export async function sendPhaseStatusEmail(
  email: string,
  projectName: string,
  phaseName: string,
  newStatus: string,
  projectId: string
): Promise<boolean> {
  const statusLabels: Record<string, string> = {
    PENDING: "Pending",
    IN_PROGRESS: "In Progress",
    REVIEW_REQUESTED: "Review Requested",
    UNDER_REVIEW: "Under Review",
    COMPLETE: "Complete",
  };
  const label = statusLabels[newStatus] || newStatus;
  const projectUrl = `${APP_URL}/dashboard/projects/${projectId}`;

  return sendEmail({
    to: email,
    subject: `${phaseName} is now ${label} — ${projectName}`,
    html: wrapHTML(`
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 12px;">
        The phase <strong>${phaseName}</strong> in <strong>${projectName}</strong> has been updated to <strong>${label}</strong>.
      </p>
      ${btnHTML("View Project", projectUrl)}
    `),
  });
}

export async function sendDocumentStatusEmail(
  email: string,
  projectName: string,
  documentName: string,
  status: string,
  projectId: string
): Promise<boolean> {
  const label = status === "APPROVED" ? "approved" : "rejected";
  const projectUrl = `${APP_URL}/dashboard/projects/${projectId}`;

  return sendEmail({
    to: email,
    subject: `Document ${label}: ${documentName} — ${projectName}`,
    html: wrapHTML(`
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 12px;">
        Your document <strong>${documentName}</strong> in <strong>${projectName}</strong> has been <strong>${label}</strong>.
      </p>
      ${btnHTML("View Project", projectUrl)}
    `),
  });
}

export async function sendReviewRequestEmail(
  email: string,
  projectName: string,
  phaseName: string,
  projectId: string,
  phaseId: string
): Promise<boolean> {
  const phaseUrl = `${APP_URL}/dashboard/projects/${projectId}/phases/${phaseId}`;

  return sendEmail({
    to: email,
    subject: `Review requested: ${phaseName} — ${projectName}`,
    html: wrapHTML(`
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 12px;">
        A review has been requested for <strong>${phaseName}</strong> in <strong>${projectName}</strong>.
      </p>
      <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 4px;">
        Please review the phase and either approve or request changes.
      </p>
      ${btnHTML("Review Phase", phaseUrl)}
    `),
  });
}

export async function sendPasswordResetEmail(
  email: string,
  resetToken: string
): Promise<boolean> {
  const resetUrl = `${APP_URL}/reset-password/${resetToken}`;

  return sendEmail({
    to: email,
    subject: "Reset your AccuDone password",
    html: wrapHTML(`
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 12px;">
        We received a request to reset the password for your AccuDone account.
      </p>
      <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 4px;">
        Click below to set a new password. This link expires in 1 hour.
      </p>
      ${btnHTML("Reset Password", resetUrl)}
      <p style="color:#9ca3af;font-size:12px;margin-top:16px;">If you didn't request this, you can safely ignore this email. Your password won't change.</p>
    `),
  });
}

export async function sendChecklistCompleteEmail(
  email: string,
  projectName: string,
  phaseName: string,
  projectId: string,
  phaseId: string
): Promise<boolean> {
  const phaseUrl = `${APP_URL}/dashboard/projects/${projectId}/phases/${phaseId}`;

  return sendEmail({
    to: email,
    subject: `Checklist complete: ${phaseName} — ${projectName}`,
    html: wrapHTML(`
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 12px;">
        All checklist items for <strong>${phaseName}</strong> in <strong>${projectName}</strong> have been completed.
      </p>
      ${btnHTML("View Phase", phaseUrl)}
    `),
  });
}
