import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Temporary seed endpoint — remove after use
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  if (key !== "seed-sprint-z-2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Get all staff members
    const staff = await db.staff.findMany();
    if (staff.length === 0) {
      return NextResponse.json({ error: "No staff found" }, { status: 404 });
    }

    // 2. Seed insurance certificates
    const now = new Date();
    const futureDate = (months: number) => {
      const d = new Date(now);
      d.setMonth(d.getMonth() + months);
      return d;
    };
    const pastDate = (months: number) => {
      const d = new Date(now);
      d.setMonth(d.getMonth() - months);
      return d;
    };

    const insuranceData = [];

    for (const s of staff) {
      // Give subcontractors and team members different insurance profiles
      if (s.contactType === "SUBCONTRACTOR" || s.contactType === "TEAM") {
        // General Liability — active
        insuranceData.push({
          carrier: "Hartford Financial",
          policyNumber: `GL-${Math.floor(100000 + Math.random() * 900000)}`,
          coverageType: "GENERAL_LIABILITY" as const,
          effectiveDate: pastDate(6),
          expiryDate: futureDate(6),
          coverageAmount: 1000000,
          status: "ACTIVE" as const,
          staffId: s.id,
          notes: "Annual renewal policy",
        });

        // Workers Comp — active
        insuranceData.push({
          carrier: "State Farm",
          policyNumber: `WC-${Math.floor(100000 + Math.random() * 900000)}`,
          coverageType: "WORKERS_COMP" as const,
          effectiveDate: pastDate(3),
          expiryDate: futureDate(9),
          coverageAmount: 500000,
          status: "ACTIVE" as const,
          staffId: s.id,
        });
      }

      if (s.contactType === "SUBCONTRACTOR") {
        // Auto — expiring soon (within 30 days)
        insuranceData.push({
          carrier: "Progressive",
          policyNumber: `AU-${Math.floor(100000 + Math.random() * 900000)}`,
          coverageType: "AUTO" as const,
          effectiveDate: pastDate(11),
          expiryDate: futureDate(0.5), // ~15 days from now
          coverageAmount: 300000,
          status: "EXPIRING_SOON" as const,
          staffId: s.id,
          notes: "Renewal pending",
        });
      }
    }

    // Find an inspector — give them expired insurance for demo
    const inspector = staff.find((s) => s.contactType === "INSPECTOR");
    if (inspector) {
      insuranceData.push({
        carrier: "Liberty Mutual",
        policyNumber: `PL-${Math.floor(100000 + Math.random() * 900000)}`,
        coverageType: "PROFESSIONAL" as const,
        effectiveDate: pastDate(14),
        expiryDate: pastDate(2), // expired 2 months ago
        coverageAmount: 2000000,
        status: "EXPIRED" as const,
        staffId: inspector.id,
        notes: "Professional liability — EXPIRED, needs renewal",
      });
    }

    // Clear existing demo insurance first
    await db.insuranceCertificate.deleteMany({});

    // Insert all insurance records
    for (const ins of insuranceData) {
      await db.insuranceCertificate.create({
        data: ins,
      });
    }

    // 3. Seed budget data on phases
    const phases = await db.phase.findMany({
      include: { project: true },
    });

    const budgetUpdates = [];
    for (const phase of phases) {
      const estimatedCost = Math.floor(15000 + Math.random() * 85000); // $15k–$100k
      const costVariance = 0.7 + Math.random() * 0.5; // 70%–120% of estimated
      const actualCost =
        phase.status === "COMPLETE"
          ? Math.floor(estimatedCost * costVariance)
          : phase.status === "IN_PROGRESS"
            ? Math.floor(estimatedCost * costVariance * 0.6)
            : null;

      budgetUpdates.push(
        db.phase.update({
          where: { id: phase.id },
          data: {
            estimatedCost,
            actualCost,
          },
        })
      );
    }
    await Promise.all(budgetUpdates);

    // 4. Add star ratings to some staff (PM-only ratings)
    const ratingUpdates = [];
    for (const s of staff) {
      let rating = null;
      if (s.contactType === "SUBCONTRACTOR") rating = 3 + Math.floor(Math.random() * 3); // 3-5
      if (s.contactType === "TEAM") rating = 4 + Math.floor(Math.random() * 2); // 4-5
      if (s.contactType === "INSPECTOR") rating = 4;

      if (rating) {
        ratingUpdates.push(
          db.staff.update({
            where: { id: s.id },
            data: { rating },
          })
        );
      }
    }
    await Promise.all(ratingUpdates);

    return NextResponse.json({
      success: true,
      seeded: {
        insuranceCertificates: insuranceData.length,
        phaseBudgets: budgetUpdates.length,
        staffRatings: ratingUpdates.length,
      },
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
