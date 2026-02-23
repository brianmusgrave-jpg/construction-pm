"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";

// ── QuickBooks OAuth Configuration ──
const QB_CLIENT_ID = process.env.QUICKBOOKS_CLIENT_ID || "";
const QB_CLIENT_SECRET = process.env.QUICKBOOKS_CLIENT_SECRET || "";
const QB_REDIRECT_URI = process.env.QUICKBOOKS_REDIRECT_URI || "";
const QB_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const QB_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const QB_API_BASE = "https://quickbooks.api.intuit.com/v3";

// ── Get OAuth URL ──
export async function getQuickBooksAuthUrl(): Promise<{ url: string | null; error?: string }> {
  const session = await auth();
  if (!session?.user) return { url: null, error: "Unauthorized" };
  if (!can(session.user.role || "VIEWER", "manage", "phase")) {
    return { url: null, error: "Insufficient permissions" };
  }

  if (!QB_CLIENT_ID || !QB_REDIRECT_URI) {
    return { url: null, error: "QuickBooks not configured" };
  }

  const state = crypto.randomUUID();
  const scopes = "com.intuit.quickbooks.accounting";
  const url = `${QB_AUTH_URL}?client_id=${QB_CLIENT_ID}&response_type=code&scope=${scopes}&redirect_uri=${encodeURIComponent(QB_REDIRECT_URI)}&state=${state}`;

  return { url };
}

// ── Exchange Auth Code for Tokens ──
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
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
        scope: tokens.scope || "com.intuit.quickbooks.accounting",
      },
      update: {
        companyName,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
        scope: tokens.scope || "com.intuit.quickbooks.accounting",
      },
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Connection failed" };
  }
}

// ── Get Connection Status ──
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

// ── Disconnect QuickBooks ──
export async function disconnectQuickBooks(): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role || "VIEWER", "manage", "phase")) {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    await (db as any).quickBooksConnection.deleteMany();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Disconnect failed" };
  }
}

// ── Update Sync Settings ──
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
    const connection = await (db as any).quickBooksConnection.findFirst();
    if (!connection) return { success: false, error: "No QuickBooks connection found" };

    await (db as any).quickBooksConnection.update({
      where: { id: connection.id },
      data: settings,
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Update failed" };
  }
}

// ── Refresh Token (internal helper) ──
async function refreshAccessToken(connectionId: string): Promise<string | null> {
  try {
    const connection = await (db as any).quickBooksConnection.findUnique({
      where: { id: connectionId },
    });
    if (!connection) return null;

    // Check if token is still valid
    if (new Date(connection.tokenExpiry) > new Date(Date.now() + 60000)) {
      return connection.accessToken;
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
        refresh_token: connection.refreshToken,
      }),
    });

    if (!res.ok) return null;

    const tokens = await res.json();
    await (db as any).quickBooksConnection.update({
      where: { id: connectionId },
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || connection.refreshToken,
        tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
      },
    });

    return tokens.access_token;
  } catch {
    return null;
  }
}

// ── Trigger Sync ──
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
      } catch (e: any) {
        itemsFailed++;
        errors.push(`Invoice sync error: ${e.message}`);
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
      } catch (e: any) {
        itemsFailed++;
        errors.push(`Expense sync error: ${e.message}`);
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
      } catch (e: any) {
        itemsFailed++;
        errors.push(`Vendor sync error: ${e.message}`);
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
      } catch (e: any) {
        itemsFailed++;
        errors.push(`Customer sync error: ${e.message}`);
      }
    }

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
  } catch (err: any) {
    return { success: false, error: err.message || "Sync failed" };
  }
}

// ── Get Sync History ──
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
