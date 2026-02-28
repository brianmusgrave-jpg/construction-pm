/**
 * @file db.ts
 * @description Prisma client singleton for Construction PM.
 *
 * Next.js hot-reloads in development, which would create a new PrismaClient
 * instance on every module reload and exhaust the database connection pool.
 * This pattern stores the client on `globalThis` so it survives hot-reloads.
 *
 * In production, the module is loaded once — no singleton logic needed there,
 * but the guard (`!== "production"`) keeps the globalThis assignment out of
 * the production path for clarity.
 *
 * Usage:
 *   import { db } from "@/lib/db";  // ← always named import, never default
 *   const project = await db.project.findUnique({ where: { id } });
 *
 * GOTCHA: Always use the named import `{ db }`. Turbopack treats a default
 * import from a named-export-only module as a hard build error.
 */

import { PrismaClient } from "@prisma/client";

// Extend globalThis type to hold the cached client without TypeScript errors.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const db =
  globalForPrisma.prisma || // Reuse existing client in dev (survives hot-reload)
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"] // Verbose logging in dev
        : ["error"],                  // Errors only in production
  });

// Cache the client on globalThis in non-production environments.
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
