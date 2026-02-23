# Sprint Workflow Skill

## Build Order (Bottom-Up)
Always build in this order to avoid cascading type errors:
1. **Schema** (prisma/schema.prisma) → `prisma generate`
2. **Server Actions** (src/actions/*.ts)
3. **Components** (src/components/**/*.tsx)
4. **Pages** (src/app/**/page.tsx)
5. **Navigation** (sidebar links, redirects)

## Server Action Pattern
```typescript
"use server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

export async function doThing(data: TypedInput) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!can(session.user.role || "VIEWER", "action", "resource"))
    throw new Error("Forbidden");
  // ... mutation
  revalidatePath(`/dashboard/projects/${projectId}`);
  return result;
}
```

## Component Pattern
- Server Components for pages (data fetching)
- `"use client"` only for interactive components
- Props: pass data down from server, not fetch in client
- Types: match Prisma output types exactly (Date not string)

## Current Project State
- **Stack**: Next.js 16, React 19, Prisma 5, Supabase, Vercel
- **Auth**: NextAuth v5 beta, Credentials provider, JWT
- **Live URL**: https://construction-pm-theta.vercel.app
- **Repo**: brianmusgrave-jpg/construction-pm

## Completed Sprints
- Sprint 1: Auth, project/phase CRUD, timeline Gantt, sidebar nav
- Sprint 2: Phase detail, checklists, dashboard redesign, activity log
- Sprint 3: Project creation form with inline phase builder
- Sprint 3.5: Document uploads (Vercel Blob, drag-drop, status management)

## Upcoming Features
- Contractor Portal (trade-scoped login, see only assigned phases)
- Photo uploads with camera integration
- Notifications (in-app + email via Resend)
- Mobile optimization / PWA
- Commercial project template
