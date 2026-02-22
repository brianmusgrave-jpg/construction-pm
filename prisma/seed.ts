import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // ── Clean existing data (order matters for foreign keys) ──
  await db.orgSettings.deleteMany();
  await db.activityLog.deleteMany();
  await db.phaseAssignment.deleteMany();
  await db.checklistItem.deleteMany();
  await db.checklist.deleteMany();
  await db.checklistTemplateItem.deleteMany();
  await db.checklistTemplate.deleteMany();
  await db.document.deleteMany();
  await db.photo.deleteMany();
  await db.notification.deleteMany();
  await db.phase.deleteMany();
  await db.projectMember.deleteMany();
  await db.invitation.deleteMany();
  await db.project.deleteMany();
  await db.staff.deleteMany();

  console.log("  Cleaned existing data");

  // ── Create Admin User ──
  const admin = await db.user.upsert({
    where: { email: "admin@constructionpm.com" },
    update: { name: "Brian Musgrave", role: "ADMIN", company: "Construction PM" },
    create: {
      email: "admin@constructionpm.com",
      name: "Brian Musgrave",
      role: "ADMIN",
      company: "Construction PM",
    },
  });

  // ── Create Sample Contractor User ──
  const contractor = await db.user.upsert({
    where: { email: "contractor@example.com" },
    update: {},
    create: {
      email: "contractor@example.com",
      name: "Mike Johnson",
      role: "CONTRACTOR",
      company: "Johnson Construction",
    },
  });

  // ── Create Directory Contacts ──
  const staffMembers = await Promise.all([
    // TEAM - your own people
    db.staff.create({
      data: {
        name: "Mike Johnson",
        company: "Johnson Construction",
        role: "General Contractor",
        contactType: "TEAM",
        email: "mike@johnsonconstruction.com",
        phone: "555-0101",
        createdById: admin.id,
      },
    }),
    // SUBCONTRACTORS
    db.staff.create({
      data: {
        name: "Tom Williams",
        company: "Williams Electric",
        role: "Electrician",
        contactType: "SUBCONTRACTOR",
        email: "tom@williamselectric.com",
        phone: "555-0103",
        createdById: admin.id,
      },
    }),
    db.staff.create({
      data: {
        name: "Lisa Park",
        company: "Park Plumbing",
        role: "Plumber",
        contactType: "SUBCONTRACTOR",
        email: "lisa@parkplumbing.com",
        phone: "555-0104",
        createdById: admin.id,
      },
    }),
    db.staff.create({
      data: {
        name: "Sarah Chen",
        company: "Chen Engineering",
        role: "Structural Engineer",
        contactType: "SUBCONTRACTOR",
        email: "sarah@cheneng.com",
        phone: "555-0102",
        createdById: admin.id,
      },
    }),
    // INSPECTORS
    db.staff.create({
      data: {
        name: "David Martinez",
        company: "City Permits Office",
        role: "Building Inspector",
        contactType: "INSPECTOR",
        email: "david.martinez@city.gov",
        phone: "555-0105",
        createdById: admin.id,
      },
    }),
    // VENDORS
    db.staff.create({
      data: {
        name: "ABC Supply",
        company: "ABC Supply Co.",
        role: "Lumber & Materials",
        contactType: "VENDOR",
        email: "orders@abcsupply.com",
        phone: "555-0200",
        createdById: admin.id,
      },
    }),
  ]);

  // ── Checklist Templates ──
  await db.checklistTemplate.create({
    data: {
      name: "Permitting",
      items: {
        create: [
          { title: "Submit building permit application", order: 0 },
          { title: "Provide site plan and survey", order: 1 },
          { title: "Submit structural drawings", order: 2 },
          { title: "Pay permit fees", order: 3 },
          { title: "Schedule plan review meeting", order: 4 },
          { title: "Receive stamped/approved plans", order: 5 },
          { title: "Post permit on site", order: 6 },
        ],
      },
    },
  });

  await db.checklistTemplate.create({
    data: {
      name: "Site Work",
      items: {
        create: [
          { title: "Clear and grade lot", order: 0 },
          { title: "Excavate for foundation", order: 1 },
          { title: "Install foundation forms", order: 2 },
          { title: "Rough-in plumbing (underground)", order: 3 },
          { title: "Pour foundation", order: 4 },
          { title: "Foundation inspection", order: 5 },
          { title: "Backfill and compact", order: 6 },
          { title: "Install sewer/septic connection", order: 7 },
        ],
      },
    },
  });

  await db.checklistTemplate.create({
    data: {
      name: "Framing & Shell",
      items: {
        create: [
          { title: "Deliver framing materials", order: 0 },
          { title: "Frame exterior walls", order: 1 },
          { title: "Frame interior walls", order: 2 },
          { title: "Install roof trusses", order: 3 },
          { title: "Sheathing and housewrap", order: 4 },
          { title: "Install windows and exterior doors", order: 5 },
          { title: "Roofing installation", order: 6 },
          { title: "Framing inspection", order: 7 },
        ],
      },
    },
  });

  await db.checklistTemplate.create({
    data: {
      name: "Finishing Work",
      items: {
        create: [
          { title: "Rough-in electrical", order: 0 },
          { title: "Rough-in plumbing (interior)", order: 1 },
          { title: "HVAC installation", order: 2 },
          { title: "Insulation", order: 3 },
          { title: "Drywall hang and finish", order: 4 },
          { title: "Interior painting", order: 5 },
          { title: "Flooring installation", order: 6 },
          { title: "Cabinets and countertops", order: 7 },
          { title: "Plumbing fixtures", order: 8 },
          { title: "Electrical fixtures and trim", order: 9 },
          { title: "Final inspection", order: 10 },
          { title: "Certificate of occupancy", order: 11 },
        ],
      },
    },
  });

  // ── Create Sample Project (matching Patrick's timeline) ──
  const project = await db.project.create({
    data: {
      name: "MSH Construction Build",
      description:
        "Modular steel home construction project. 12-16 week build window from plan approval.",
      address: "123 Construction Way, Springfield",
      status: "ACTIVE",
      planApproval: new Date("2026-02-02"),
      estCompletion: new Date("2026-05-17"),
      members: {
        create: [
          { userId: admin.id, role: "OWNER" },
          { userId: contractor.id, role: "CONTRACTOR" },
        ],
      },
    },
  });

  // ── Create Phases (matching Patrick's 7 phases) ──
  const phases = await Promise.all([
    db.phase.create({
      data: {
        projectId: project.id,
        name: "Plans Confirmed",
        isMilestone: true,
        sortOrder: 0,
        status: "COMPLETE",
        progress: 100,
        estStart: new Date("2026-02-02"),
        estEnd: new Date("2026-02-02"),
      },
    }),
    db.phase.create({
      data: {
        projectId: project.id,
        name: "Stamped Plans",
        detail: "3-4 weeks for permit review and stamping",
        sortOrder: 1,
        status: "IN_PROGRESS",
        progress: 60,
        estStart: new Date("2026-02-02"),
        estEnd: new Date("2026-03-02"),
        worstStart: new Date("2026-02-02"),
        worstEnd: new Date("2026-03-02"),
      },
    }),
    db.phase.create({
      data: {
        projectId: project.id,
        name: "MSH Kit Build",
        detail: "4-6 weeks after stamps",
        sortOrder: 2,
        status: "PENDING",
        estStart: new Date("2026-03-02"),
        estEnd: new Date("2026-03-30"),
        worstStart: new Date("2026-03-02"),
        worstEnd: new Date("2026-04-13"),
      },
    }),
    db.phase.create({
      data: {
        projectId: project.id,
        name: "Site Work",
        detail: "Foundation / Plumbing / Sewer",
        sortOrder: 3,
        status: "PENDING",
        estStart: new Date("2026-03-02"),
        estEnd: new Date("2026-04-06"),
        worstStart: new Date("2026-03-02"),
        worstEnd: new Date("2026-04-13"),
      },
    }),
    db.phase.create({
      data: {
        projectId: project.id,
        name: "Delivery",
        detail: "ASAP after build",
        sortOrder: 4,
        status: "PENDING",
        estStart: new Date("2026-03-30"),
        estEnd: new Date("2026-04-06"),
        worstStart: new Date("2026-04-13"),
        worstEnd: new Date("2026-04-20"),
      },
    }),
    db.phase.create({
      data: {
        projectId: project.id,
        name: "Unload & Build Shell",
        detail: "~2 weeks",
        sortOrder: 5,
        status: "PENDING",
        estStart: new Date("2026-04-06"),
        estEnd: new Date("2026-04-20"),
        worstStart: new Date("2026-04-20"),
        worstEnd: new Date("2026-05-04"),
      },
    }),
    db.phase.create({
      data: {
        projectId: project.id,
        name: "Finishing Work",
        detail: "Full-time / sub option",
        sortOrder: 6,
        status: "PENDING",
        estStart: new Date("2026-04-20"),
        estEnd: new Date("2026-05-18"),
        worstStart: new Date("2026-05-04"),
        worstEnd: new Date("2026-05-25"),
      },
    }),
  ]);

  // ── Assign Contacts to Phases ──
  await Promise.all([
    db.phaseAssignment.create({
      data: { phaseId: phases[1].id, staffId: staffMembers[4].id, isOwner: true }, // Stamped Plans → Inspector
    }),
    db.phaseAssignment.create({
      data: { phaseId: phases[3].id, staffId: staffMembers[0].id, isOwner: true }, // Site Work → GC
    }),
    db.phaseAssignment.create({
      data: { phaseId: phases[3].id, staffId: staffMembers[2].id, isOwner: false }, // Site Work → Plumber
    }),
    db.phaseAssignment.create({
      data: { phaseId: phases[6].id, staffId: staffMembers[0].id, isOwner: true }, // Finishing → GC
    }),
    db.phaseAssignment.create({
      data: { phaseId: phases[6].id, staffId: staffMembers[1].id, isOwner: false }, // Finishing → Electrician
    }),
    db.phaseAssignment.create({
      data: { phaseId: phases[6].id, staffId: staffMembers[2].id, isOwner: false }, // Finishing → Plumber
    }),
  ]);

  // ── Activity Log Entries (for dashboard feed) ──
  const now = new Date();
  await Promise.all([
    db.activityLog.create({
      data: {
        projectId: project.id,
        userId: admin.id,
        action: "PROJECT_CREATED",
        message: "Created project MSH Construction Build",
        createdAt: new Date(now.getTime() - 7 * 86400000),
      },
    }),
    db.activityLog.create({
      data: {
        projectId: project.id,
        userId: admin.id,
        action: "PHASE_STATUS_CHANGED",
        message: "Plans Confirmed marked as Complete",
        data: { phaseId: phases[0].id, oldStatus: "PENDING", newStatus: "COMPLETE" },
        createdAt: new Date(now.getTime() - 6 * 86400000),
      },
    }),
    db.activityLog.create({
      data: {
        projectId: project.id,
        userId: admin.id,
        action: "PHASE_STATUS_CHANGED",
        message: "Stamped Plans moved to In Progress",
        data: { phaseId: phases[1].id, oldStatus: "PENDING", newStatus: "IN_PROGRESS" },
        createdAt: new Date(now.getTime() - 5 * 86400000),
      },
    }),
    db.activityLog.create({
      data: {
        projectId: project.id,
        userId: admin.id,
        action: "STAFF_ASSIGNED",
        message: "Assigned David Martinez as owner of Stamped Plans",
        data: { phaseId: phases[1].id, staffName: "David Martinez" },
        createdAt: new Date(now.getTime() - 5 * 86400000 + 3600000),
      },
    }),
    db.activityLog.create({
      data: {
        projectId: project.id,
        userId: contractor.id,
        action: "STAFF_ASSIGNED",
        message: "Assigned Mike Johnson as owner of Site Work",
        data: { phaseId: phases[3].id, staffName: "Mike Johnson" },
        createdAt: new Date(now.getTime() - 3 * 86400000),
      },
    }),
    db.activityLog.create({
      data: {
        projectId: project.id,
        userId: admin.id,
        action: "STAFF_ASSIGNED",
        message: "Assigned Lisa Park to Site Work",
        data: { phaseId: phases[3].id, staffName: "Lisa Park" },
        createdAt: new Date(now.getTime() - 3 * 86400000 + 1800000),
      },
    }),
    db.activityLog.create({
      data: {
        projectId: project.id,
        userId: admin.id,
        action: "MEMBER_INVITED",
        message: "Added Mike Johnson as Contractor",
        createdAt: new Date(now.getTime() - 2 * 86400000),
      },
    }),
    db.activityLog.create({
      data: {
        projectId: project.id,
        userId: admin.id,
        action: "STAFF_ASSIGNED",
        message: "Assigned Tom Williams to Finishing Work",
        data: { phaseId: phases[6].id, staffName: "Tom Williams" },
        createdAt: new Date(now.getTime() - 1 * 86400000),
      },
    }),
  ]);

  // ── Organization Settings (default theme) ──
  await db.orgSettings.create({
    data: { theme: "blue" },
  });

  // ── Sample Notifications ──
  await db.notification.createMany({
    data: [
      {
        type: "PHASE_STATUS_CHANGED",
        title: "Phase started: Stamped Plans",
        message: "Stamped Plans on MSH Construction Build is now started",
        userId: admin.id,
        read: true,
        data: { projectId: project.id, phaseId: phases[1].id },
        createdAt: new Date(now.getTime() - 5 * 86400000),
      },
      {
        type: "MEMBER_INVITED",
        title: "New team member joined",
        message: "Mike Johnson joined MSH Construction Build as Contractor",
        userId: admin.id,
        read: true,
        data: { projectId: project.id },
        createdAt: new Date(now.getTime() - 2 * 86400000),
      },
      {
        type: "DOCUMENT_UPLOADED",
        title: "New Document: Foundation Survey",
        message: '"Foundation Survey" uploaded to Site Work',
        userId: admin.id,
        read: false,
        data: { projectId: project.id, phaseId: phases[3].id },
        createdAt: new Date(now.getTime() - 1 * 86400000),
      },
      {
        type: "REVIEW_REQUESTED",
        title: "Review Requested: Stamped Plans",
        message: "Mike Johnson wants you to review Stamped Plans on MSH Construction Build",
        userId: admin.id,
        read: false,
        data: { projectId: project.id, phaseId: phases[1].id },
        createdAt: new Date(now.getTime() - 4 * 3600000),
      },
      {
        type: "CHECKLIST_COMPLETED",
        title: "Checklist Complete: Site Work",
        message: "All checklist items completed for Site Work on MSH Construction Build",
        userId: admin.id,
        read: false,
        data: { projectId: project.id, phaseId: phases[3].id },
        createdAt: new Date(now.getTime() - 2 * 3600000),
      },
      {
        type: "DOCUMENT_STATUS_CHANGED",
        title: "Document approved: Building Permit",
        message: '"Building Permit" in Stamped Plans was approved',
        userId: admin.id,
        read: false,
        data: { projectId: project.id, phaseId: phases[1].id },
        createdAt: new Date(now.getTime() - 30 * 60000),
      },
      // Notifications for contractor user too
      {
        type: "PHASE_STATUS_CHANGED",
        title: "Phase started: Stamped Plans",
        message: "Stamped Plans on MSH Construction Build is now started",
        userId: contractor.id,
        read: false,
        data: { projectId: project.id, phaseId: phases[1].id },
        createdAt: new Date(now.getTime() - 5 * 86400000),
      },
      {
        type: "REVIEW_REQUESTED",
        title: "Review Requested: Stamped Plans",
        message: "Brian Musgrave wants you to review Stamped Plans",
        userId: contractor.id,
        read: false,
        data: { projectId: project.id, phaseId: phases[1].id },
        createdAt: new Date(now.getTime() - 3 * 3600000),
      },
    ],
  });

  console.log("Seed complete!");
  console.log(`  Created 2 users`);
  console.log(`  Created ${staffMembers.length} directory contacts`);
  console.log(`  Created 4 checklist templates`);
  console.log(`  Created 1 project with ${phases.length} phases`);
  console.log(`  Created 6 phase assignments`);
  console.log(`  Created 8 activity log entries`);
  console.log(`  Created 8 sample notifications`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
