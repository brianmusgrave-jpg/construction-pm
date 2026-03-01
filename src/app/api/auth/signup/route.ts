/**
 * @file /api/auth/signup
 * @description New account registration API (Sprint 15/17).
 *
 * Creates: Organization, User (ADMIN + isOrgOwner), OrgSettings.
 * If plan is paid: creates Stripe Checkout session and returns checkoutUrl.
 * If trial: creates org with TRIAL status and 14-day window.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

const dbc = db as any;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 48);
}

export async function POST(req: NextRequest) {
  try {
    const { companyName, email, password, fullName, plan } = await req.json();

    // Validate
    if (!companyName?.trim() || !email?.trim() || !password?.trim() || !fullName?.trim()) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const emailLower = email.trim().toLowerCase();

    // Check if email already exists
    const existingUser = await dbc.user.findFirst({ where: { email: emailLower } });
    if (existingUser) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    // Generate slug (ensure uniqueness)
    let slug = slugify(companyName);
    const existingOrg = await dbc.organization.findFirst({ where: { slug } });
    if (existingOrg) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Determine trial dates
    const now = new Date();
    const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days

    // AI token budget by plan
    const aiTokenBudget = plan === "ENTERPRISE" ? 500000 : plan === "PRO" ? 100000 : 0;

    // Create organization
    const org = await dbc.organization.create({
      data: {
        name: companyName.trim(),
        slug,
        plan: plan || "PRO",
        status: "TRIAL",
        aiTokenBudget,
        aiTokenUsed: 0,
        billingCycleEnd: trialEnd,
      },
    });

    // Create owner user
    await dbc.user.create({
      data: {
        name: fullName.trim(),
        email: emailLower,
        passwordHash,
        role: "ADMIN",
        isOrgOwner: true,
        orgId: org.id,
      },
    });

    // Create default org settings
    try {
      await dbc.orgSettings.create({
        data: {
          orgId: org.id,
          companyName: companyName.trim(),
        },
      });
    } catch {
      // Non-critical — settings can be created later
    }

    // For now, all signups start as trial (no immediate Stripe checkout).
    // Stripe checkout is used for upgrading from the billing page.
    return NextResponse.json({
      success: true,
      orgId: org.id,
      message: "Trial account created",
    });
  } catch (err: any) {
    console.error("[auth/signup]", err);
    return NextResponse.json({ error: err.message || "Signup failed" }, { status: 500 });
  }
}
