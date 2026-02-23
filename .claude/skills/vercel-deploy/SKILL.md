# Vercel Deploy Skill

## Environment Variables (Vercel Dashboard)
- `DATABASE_URL` — Supabase pooler (port 6543 + `?pgbouncer=true`)
- `DIRECT_URL` — Supabase direct (port 5432, no pgbouncer)
- `NEXTAUTH_SECRET` — Random secret for JWT signing
- `NEXTAUTH_URL` — `https://construction-pm-theta.vercel.app`
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob store token (created in Vercel Storage)

## Build Script
`"build": "prisma generate && next build"` — Prisma client regenerated on every build.

## Common Build Errors & Fixes
| Error | Fix |
|-------|-----|
| `_sum` on boolean | Use `.count()` with filter instead |
| `Date` vs `string` in component interfaces | Match Prisma output — always `Date` |
| Implicit `any` in callbacks | Add explicit types: `(item: { field: Type }) => ...` |
| `DIRECT_URL` not found | Set env var before `prisma db push` |
| activityLog not on PrismaClient | Run `prisma generate` (happens auto on Vercel) |

## Database Operations (Local)
```bash
export DIRECT_URL="postgresql://postgres.xxx:PASSWORD@aws-0-us-east-2.pooler.supabase.com:5432/postgres"
export DATABASE_URL="postgresql://postgres.xxx:PASSWORD@aws-0-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
npx prisma db push
DATABASE_URL="$DIRECT_URL" npx tsx prisma/seed.ts
```

## Deploy Cadence
1. Schema changes → `prisma db push`
2. Seed if needed → `npx tsx prisma/seed.ts`
3. `git push origin main` → Vercel auto-deploys
4. Verify on live site

## Post-Deploy Checklist
- [ ] Site loads without errors
- [ ] Auth flow works
- [ ] New features visible
- [ ] No console errors on key pages
