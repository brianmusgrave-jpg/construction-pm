"use server";

/**
 * @file actions/quickbooks.ts
 * @description Server actions for QuickBooks Online integration.
 *
 * Implements the full OAuth 2.0 authorization code flow for connecting a
 * QuickBooks company account, plus periodic data syncing. Architecture:
 *
 *   OAuth flow:
 *     1. `getQuickBooksAuthUrl()` → redirect user to Intuit authorization page.
 *     2. Intuit redirects back to QB_REDIRECT_URI with `code` + `realmId`.
 *     3. `exchangeQuickBooksCode(code, realmId)` → exchange for tokens,
 *        fetch company info, upsert a `quickBooksConnection` row.
 *
 *   Token lifecycle:
 *     - Tokens are encrypted with `encryptToken`/`decryptToken` from `@/lib/crypto`
 *       before storage; they are never persisted in plaintext.
 *     - `refreshAccessToken` (private) auto-renews tokens on demand with a
 *       60-second validity buffer to prevent race conditions.
 *
 *   Sync engine:
 *     - `triggerQuickBooksSync` fetches Invoices, Purchases (expenses),
 *       Vendors, and Customers from the QuickBooks REST API.
 *     - ⚠️  IMPORTANT: The current implementation only fetches and counts
 *       records — it does NOT write them to the app database. The QB data is
 *       not yet mapped to projects/phases/staff. Each endpoint has a comment
 *       noting the intended target model. This is a stub to be completed.
 *     - Sync results are written to `quickBooksSyncLog` for history and
 *       the connection row is updated with `lastSyncAt`/`lastSyncStatus`.
 *     - Status values: "success" (all ok), "partial" (some failed), "error" (all failed).
 *
 * Permission: all write operations require `can(role, "manage", "phase")`,
 * which maps to ADMIN and PROJECT_MANAGER global roles. Read operations
 * return null/[] for unauthenticated callers.
 *
 * Both `quickBooksConnection` and `quickBooksSyncLog` were added after the
 * last Prisma client generation, so `(db as any)` casts are required throughout.
 * The `/* eslint-disable @typescript-eslint/no-explicit-any *\/` pragma at
 * the top of the file suppresses these warnings en masse.
 *
 * Environment variables required:
 *   QUICKBOOKS_CLIENT_ID      — OAuth app client ID from Intuit developer portal
 *   QUICKBOOKS_CLIENT_SECRET  — OAuth app client secret
 *   QUICKBOOKS_REDIRECT_URI   — Callback URL registered in the Intuit app settings
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
// quickBooksConnection and quickBooksSyncLog are not in the generated Prisma
// client types yet, so (db as any) casts are necessary throughout this file.

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { encryptToken, decryptToken } from "@/lib/crypto";
import { z } from "zod";

// ── QuickBooks API Configuration ──
// Pulled from environment variables set in .env / Vercel project settings.
const QB_CLIENT_ID = process.env.QUICKBOOKS_CLIENT_ID || "";
const QB_CLIENT_SECRET = process.env.QUICKBOOKS_CLIENT_SECRET || "";
const QB_REDIRECT_URI = process.env.QUICKBOOKS_REDIRECT_URI || "";
const QB_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const QB_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const QB_API_BASE = "https://quickbooks.api.intuit.com/v3";

// ── OAuth ──

/**
 * Generate the Intuit OAuth 2.0 authorization URL for the QuickBooks connection flow.
 *
 * The caller should redirect the user to the returned URL. After authorization,
 * Intuit redirects back to `QB_REDIRECT_URI` with `?code=…&state=…&realmId=…`.
 * Pass `code` and `realmId` to `exchangeQuickBooksCode` to complete the flow.
 *
 * Note: `state` is generated as a random UUID per request for CSRF protection
 * but is not persisted — a more robust implementation should store it in the
 * session and verify it in the callback handler.
 *
 * @returns `{ url }` on success, or `{ url: null, error }` on failure.
 *
 * Requires: `manage:phase` permission (ADMIN or PROJECT_MANAGER global role).
 */
export async function getQuickBooksAuthUrl(): Promise<{ url: string | null; error?: string }> {
  const session = await auth();
  if (!session?.user) return { url: null, error: "Unauthorized" };
  if (!can(session.user.role || "VIEWER", "manage", "phase")) {
    return { url: null, error: "Insufficient permissions" };
  }

  if (!QB_CLIENT_ID || !QB_REDIRECT_URI) {
    return { url: null, error: "QuickBooks not configured" };
  }

  const state = crypto.randomUUID(); // CSRF token — not currently persisted/verified
  const scopes = "com.intuit.quickbooks.accounting";
  const url = `${QB_AUTH_URL}?client_id=${QB_CLIENT_ID}&response_type=code&scope=${scopes}&redirect_uri=${encodeURIComponent(QB_REDIRECT_URI)}&state=${state}`;

  return { url };
}

/**
 * Exchange an OAuth authorization code for QuickBooks access + refresh tokens.
 *
 * Called from the OAuth callback route after Intuit redirects back with a
 * `code` and `realmId`. Steps:
 *   1. POST to the Intuit token endpoint with Basic Auth (client_id:client_secret).
 *   2. Optionally fetch the company's display name from the CompanyInfo API.
 *   3. Upsert the `quickBooksConnection` row (one connection per `companyId`/realmId).
 *   4. Encrypt both tokens before storage using `encryptToken` from @/lib/crypto.
 *
 * Company name fetch is best-effort — failure is logged and swallowed so the
 * connection is still saved even if the CompanyInfo call errors.
 *
 * @param code    - Authorization code from Intuit's OAuth redirect query string.
 * @param realmId - QuickBooks company ID from Intuit's OAuth redirect query string.
 * @returns `{ success: true }` on success, or `{ success: false, error }`.
 *
 * Requires: `manage:phase` permission (ADMIN or PROJECT_MANAGER global role).
 */
export async function exchangeQuickBooksCode(
  code: string,
  realmId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role || "VIEWER", "manage", "phase")) {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const basicAuth = Buffer.from(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`).toString("base64");

    const tokenResponse = await fetch(QB_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: QB_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      return { success: false, error: "Failed to exchange authorization code" };
    }

    const tokens = await tokenResponse.json();

    // Fetch company info
    let companyName = null;
    try {
      const companyRes = await fetch(
        `${QB_API_BASE}/company/${realmId}/companyinfo/${realmId}`,
        {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            Accept: "application/json",
          },
        }
      );
      if (companyRes.ok) {
        const companyData = await companyRes.json();
        companyName = companyData.CompanyInfo?.CompanyName || null;
      }
    } catch {
      // Non-fatal — we'll just save without company name
    }

    // Upsert connection
    await (db as any).quickBooksConnection.upsert({
      where: { companyId: realmId },
      create: {
        companyId: realmId,
        companyName,
        accessToken: encryptToken(tokens.access_token),
        refreshToken: encryptToken(tokens.refresh_token),
        tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
        scope: tokens.scope || "com.intuit.quickbooks.accounting",
      },
      update: {
        companyName,
        accessToken: encryptToken(tokens.access_token),
        refreshToken: encryptToken(tokens.refresh_token),
        tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
        scope: tokens.scope || "com.intuit.quickbooks.accounting",
      },
    });

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: (err instanceof Error ? err.message : null) || "Connection failed" };
  }
}

// ── Queries ──

/**
 * Return the current QuickBooks connection details for the settings UI.
 *
 * Returns the first connection found (the app supports one QB company at a
 * time). Deliberately excludes encrypted token fields from the projection —
 * only metadata needed for the settings page is returned.
 *
 * @returns The connection record (minus tokens), or null if not connected
 *          or if the table doesn't exist yet in this environment.
 */
export async function getQuickBooksConnection() {
  const session = await auth();
  if (!session?.user) return null;

  try {
    const connection = await (db as any).quickBooksConnection.findFirst({
      select: {
        id: true,
        companyId: true,
        companyName: true,
        syncEnabled: true,
        syncInvoices: true,
        syncExpenses: true,
        syncVendors: true,
        syncCustomers: true,
        lastSyncAt: true,
        lastSyncStatus: true,
        lastSyncMessage: true,
        tokenExpiry: true,
        createdAt: true,
      },
    });
    return connection;
  } catch {
    return null;
  }
}

// ── Mutations ──

/**
 * Disconnect the QuickBooks integration by deleting all connection records.
 *
 * Uses `deleteMany` (not `delete` by ID) since there should be at most one
 * connection, but this is more robust. Does NOT revoke the OAuth token on
 * the Intuit side — the user should also disconnect from their QB app settings
 * if they want to fully revoke access.
 *
 * @returns `{ success: true }` on success, or `{ success: false, error }`.
 *
 * Requires: `manage:phase` permission (ADMIN or PROJECT_MANAGER global role).
 */
export async function disconnectQuickBooks(): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role || "VIEWER", "manage", "phase")) {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    await (db as any).quickBooksConnection.deleteMany();
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: (err instanceof Error ? err.message : null) || "Disconnect failed" };
  }
}

// ── Sync Settings ──

/** Validates the payload for updating which entity types are synced. */
const SyncSettingsSchema = z.object({
  syncEnabled: z.boolean().optional(),
  syncInvoices: z.boolean().optional(),
  syncExpenses: z.boolean().optional(),
  syncVendors: z.boolean().optional(),
  syncCustomers: z.boolean().optional(),
});

/**
 * Update which QuickBooks entity types are included in future syncs.
 *
 * Only updates the `quickBooksConnection` row for the first (active) connection.
 * All fields are optional — only provided fields are changed.
 *
 * @param settings - Partial sync configuration flags.
 * @returns `{ success: true }` on success, or `{ success: false, error }`.
 *
 * Requires: `manage:phase` permission (ADMIN or PROJECT_MANAGER global role).
 */
export async function updateQuickBooksSyncSettings(settings: {
  syncEnabled?: boolean;
  syncInvoices?: boolean;
  syncExpenses?: boolean;
  syncVendors?: boolean;
  syncCustomers?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role || "VIEWER", "manage", "phase")) {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const validated = SyncSettingsSchema.parse(settings);
    const connection = await (db as any).quickBooksConnection.findFirst();
    if (!connection) return { success: false, error: "No QuickBooks connection found" };

    await (db as any).quickBooksConnection.update({
      where: { id: connection.id },
      data: validated,
    });
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: (err instanceof Error ? err.message : null) || "Update failed" };
  }
}

// ── Token Refresh (internal helper) ──

/**
 * Ensure the stored access token is valid and return it decrypted.
 *
 * This is an internal helper called by `triggerQuickBooksSync`. It:
 *   1. Checks if the stored token expires more than 60 seconds from now.
 *      If so, decrypts and returns it without an HTTP call.
 *   2. If expired (or within the 60s buffer), calls the Intuit token refresh
 *      endpoint using the stored (decrypted) refresh token.
 *   3. On a successful refresh, encrypts and persists the new token pair,
 *      then returns the new plaintext access token.
 *
 * The 60-second buffer prevents expiry races in high-latency environments.
 * If the refresh token is also expired (rare, requires 100-day inactivity),
 * the fetch will fail and this function returns null, prompting the caller
 * to surface a re-auth message to the user.
 *
 * @param connectionId - Primary key of the quickBooksConnection row.
 * @returns The valid plaintext access token, or null if refresh fails.
 */
async function refreshAccessToken(connectionId: string): Promise<string | null> {
  try {
    const connection = await (db as any).quickBooksConnection.findUnique({
      where: { id: connectionId },
    });
    if (!connection) return null;

    // 60-second buffer: avoid using a token that will expire mid-request.
    if (new Date(connection.tokenExpiry) > new Date(Date.now() + 60000)) {
      return decryptToken(connection.accessToken); // Token still valid — no HTTP call
    }

    const basicAuth = Buffer.from(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`).toString("base64");
    const res = await fetch(QB_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: decryptToken(connection.refreshToken),
      }),
    });

    if (!res.ok) return null; // Caller surfaces re-auth prompt to user

    const tokens = await res.json();
    // Intuit may not return a new refresh token (it extends the existing one).
    // Fall back to the existing token if the response omits refresh_token.
    await (db as any).quickBooksConnection.update({
      where: { id: connectionId },
      data: {
        accessToken: encryptToken(tokens.access_token),
        refreshToken: encryptToken(tokens.refresh_token || decryptToken(connection.refreshToken)),
        tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
      },
    });

    return tokens.access_token; // Plaintext — used immediately by the caller
  } catch {
    return null;
  }
}

// ── Sync ──

/**
 * Trigger a QuickBooks data sync for one or all entity types.
 *
 * ⚠️  STUB IMPLEMENTATION: The current code fetches records from the QB API
 * and counts them, but does NOT write them to the app database. Each section
 * has a comment indicating the intended target model:
 *   - Invoices  → project budgets
 *   - Expenses  → phase actual costs
 *   - Vendors   → staff directory
 *   - Customers → client directory
 *
 * A `quickBooksSyncLog` row is created at start and updated with final counts
 * and status on completion. The connection's `lastSyncAt`/`lastSyncStatus`
 * fields are also updated for the settings page display.
 *
 * Sync status determination:
 *   - "success"  — all entity fetches succeeded (itemsFailed = 0)
 *   - "partial"  — some succeeded, some failed (0 < itemsFailed, itemsSynced > 0)
 *   - "error"    — all fetches failed (itemsSynced = 0, itemsFailed > 0)
 *
 * @param syncType - Entity types to sync; defaults to "full" (all types).
 * @returns `{ success, syncLogId }` on success, or `{ success: false, error }`.
 *
 * Requires: `manage:phase` permission (ADMIN or PROJECT_MANAGER global role).
 */
export async function triggerQuickBooksSync(
  syncType: "invoices" | "expenses" | "vendors" | "customers" | "full" = "full"
): Promise<{ success: boolean; error?: string; syncLogId?: string }> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role || "VIEWER", "manage", "phase")) {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const connection = await (db as any).quickBooksConnection.findFirst();
    if (!connection) return { success: false, error: "No QuickBooks connection found" };

    const accessToken = await refreshAccessToken(connection.id);
    if (!accessToken) return { success: false, error: "Failed to refresh QuickBooks token" };

    // Create sync log entry
    const syncLog = await (db as any).quickBooksSyncLog.create({
      data: {
        connectionId: connection.id,
        syncType,
        status: "started",
      },
    });

    let itemsSynced = 0;
    let itemsFailed = 0;
    const errors: string[] = [];

    // ── Entity Fetch Blocks ──
    // Each block fetches up to 100 records from the QB REST API using IQL.
    // TODO: After fetching, map QB records to app models and upsert them.

    // Sync invoices → map to project budgets
    if (syncType === "full" || syncType === "invoices") {
      try {
        const invRes = await fetch(
          `${QB_API_BASE}/company/${connection.companyId}/query?query=${encodeURIComponent("SELECT * FROM Invoice MAXRESULTS 100")}`,
          {
            headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
          }
        );
        if (invRes.ok) {
          const invData = await invRes.json();
          const invoices = invData.QueryResponse?.Invoice || [];
          itemsSynced += invoices.length;
        } else {
          itemsFailed++;
          errors.push("Failed to fetch invoices");
        }
      } catch (e: unknown) {
        itemsFailed++;
        errors.push(`Invoice sync error: ${e instanceof Error ? e.message : "Unknown"}`);
      }
    }

    // Sync expenses → map to phase actual costs
    if (syncType === "full" || syncType === "expenses") {
      try {
        const expRes = await fetch(
          `${QB_API_BASE}/company/${connection.companyId}/query?query=${encodeURIComponent("SELECT * FROM Purchase MAXRESULTS 100")}`,
          {
            headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
          }
        );
        if (expRes.ok) {
          const expData = await expRes.json();
          const expenses = expData.QueryResponse?.Purchase || [];
          itemsSynced += expenses.length;
        } else {
          itemsFailed++;
          errors.push("Failed to fetch expenses");
        }
      } catch (e: unknown) {
        itemsFailed++;
        errors.push(`Expense sync error: ${e instanceof Error ? e.message : "Unknown"}`);
      }
    }

    // Sync vendors → map to staff directory
    if (syncType === "full" || syncType === "vendors") {
      try {
        const venRes = await fetch(
          `${QB_API_BASE}/company/${connection.companyId}/query?query=${encodeURIComponent("SELECT * FROM Vendor MAXRESULTS 100")}`,
          {
            headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
          }
        );
        if (venRes.ok) {
          const venData = await venRes.json();
          const vendors = venData.QueryResponse?.Vendor || [];
          itemsSynced += vendors.length;
        } else {
          itemsFailed++;
          errors.push("Failed to fetch vendors");
        }
      } catch (e: unknown) {
        itemsFailed++;
        errors.push(`Vendor sync error: ${e instanceof Error ? e.message : "Unknown"}`);
      }
    }

    // Sync customers → map to client directory
    if (syncType === "full" || syncType === "customers") {
      try {
        const cusRes = await fetch(
          `${QB_API_BASE}/company/${connection.companyId}/query?query=${encodeURIComponent("SELECT * FROM Customer MAXRESULTS 100")}`,
          {
            headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
          }
        );
        if (cusRes.ok) {
          const cusData = await cusRes.json();
          const customers = cusData.QueryResponse?.Customer || [];
          itemsSynced += customers.length;
        } else {
          itemsFailed++;
          errors.push("Failed to fetch customers");
        }
      } catch (e: unknown) {
        itemsFailed++;
        errors.push(`Customer sync error: ${e instanceof Error ? e.message : "Unknown"}`);
      }
    }

    // Determine final status based on counts:
    // "success" = 0 failures, "partial" = mixed, "error" = nothing succeeded.
    const status = itemsFailed > 0 ? (itemsSynced > 0 ? "partial" : "error") : "success";
    const errorMessage = errors.length > 0 ? errors.join("; ") : null;

    // Update sync log
    await (db as any).quickBooksSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status,
        itemsSynced,
        itemsFailed,
        errorMessage,
        completedAt: new Date(),
      },
    });

    // Update connection last sync
    await (db as any).quickBooksConnection.update({
      where: { id: connection.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: status,
        lastSyncMessage: errorMessage || `Synced ${itemsSynced} items`,
      },
    });

    return { success: true, syncLogId: syncLog.id };
  } catch (err: unknown) {
    return { success: false, error: (err instanceof Error ? err.message : null) || "Sync failed" };
  }
}

// ── Sync History ──

/**
 * Return a paginated list of past QuickBooks sync attempts.
 * Used by the QuickBooks settings page to show sync history.
 *
 * Returns an empty array (not throws) for unauthenticated callers or
 * if the table doesn't exist yet in this environment.
 *
 * @param limit - Maximum number of log entries to return (default: 10).
 * @returns Sync log entries ordered newest-first, with counts and timestamps.
 */
export async function getQuickBooksSyncLogs(limit = 10) {
  const session = await auth();
  if (!session?.user) return [];

  try {
    const logs = await (db as any).quickBooksSyncLog.findMany({
      orderBy: { startedAt: "desc" },
      take: limit,
      select: {
        id: true,
        syncType: true,
        status: true,
        itemsSynced: true,
        itemsFailed: true,
        errorMessage: true,
        startedAt: true,
        completedAt: true,
      },
    });
    return logs;
  } catch {
    return [];
  }
}
