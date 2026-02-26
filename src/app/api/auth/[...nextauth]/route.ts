/**
 * @file src/app/api/auth/[...nextauth]/route.ts
 * @description NextAuth.js catch-all route handler. Re-exports GET and POST from
 * the centralized auth configuration in src/lib/auth.ts.
 */
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
