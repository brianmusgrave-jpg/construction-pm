import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // ── Create Admin User ──
  const admin = await db.user.upsert({
    where: { email: "admin@constructionpm.com" },
    update: {},
    create: {
      email: "admin@constructionpm.com",
      name: "Brian Musgrave",
      role: "ADMIN",
      company: "Construction PM",
    },
  });

  // ── Create Sample Contractor ──
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

  // ── Create Staff Library ──
  const staffMembers = await Promise.all([
    db.staff.create({
      data: {
        name: "Mike Johnson",
        company: "Johnson Construction",
        role: "General Contractor",
        email: "mike@johnsonconstruction.com",
        phone: "555-0101",
        createdById: admin.id,
      },
    }),
    db.staff.create({
      data: {
        name: "Sarah Chen",
        company: "Chen Engineering",
        role: "Structural Engineer",
        email: "sarah@cheneng.com",
        phone: "555-0102",
        createdById: admin.id,
      },
    }),
    db.staff.create({
      data: {
        name: "Tom Williams",
        company: "Williams Electric",
        role: "Electrician",
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
        email: "lisa@parkplumbing.com",
        phone: "555-0104",
        createdById: admin.id,
      },
    }),
    db.staff.create({
      data: {
        name: "David Martinez",
        company: "City Permits Office",
        role: "Inspector",
        email: "david.martinez@city.gov",
        phone: "555-0105",
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

  // ── Assign Staff to Phases ──
  await db.phaseAssignment.create({
    data: {
      phaseId: phases[1].id, // Stamped Plans
      staffId: staffMembers[4].id, // Inspector
      isOwner: true,
    },
  });

  await db.phaseAssignment.create({
    data: {
      phaseId: phases[3].id, // Site Work
      staffId: staffMembers[0].id, // General Contractor
      isOwner: true,
    },
  });

  await db.phaseAssignment.create({
    data: {
      phaseId: phases[3].id, // Site Work
      staffId: staffMembers[3].id, // Plumber
      isOwner: false,
    },
  });

  await db.phaseAssignment.create({
    data: {
      phaseId: phases[6].id, // Finishing Work
      staffId: staffMembers[0].id, // General Contractor
      isOwner: true,
    },
  });

  await db.phaseAssignment.create({
    data: {
      phaseId: phases[6].id, // Finishing Work
      staffId: staffMembers[2].id, // Electrician
      isOwner: false,
    },
  });

  await db.phaseAssignment.create({
    data: {
      phaseId: phases[6].id, // Finishing Work
      staffId: staffMembers[3].id, // Plumber
      isOwner: false,
    },
  });

  console.log("Seed complete!");
  console.log(`  Created ${2} users`);
  console.log(`  Created ${staffMembers.length} staff members`);
  console.log(`  Created 4 checklist templates`);
  console.log(`  Created 1 project with ${phases.length} phases`);
  console.log(`  Created 6 phase assignments`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
