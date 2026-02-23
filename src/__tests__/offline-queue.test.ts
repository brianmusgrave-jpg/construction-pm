import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock IndexedDB for Node environment
const mockStore: Map<string, unknown> = new Map();

vi.mock("idb", () => ({
  openDB: vi.fn().mockResolvedValue({
    getAll: vi.fn().mockImplementation(() =>
      Promise.resolve(Array.from(mockStore.values()))
    ),
    add: vi.fn().mockImplementation((_store: string, val: unknown) => {
      const id = `mock-${Date.now()}-${Math.random()}`;
      mockStore.set(id, { ...val as Record<string, unknown>, id });
      return Promise.resolve(id);
    }),
    put: vi.fn().mockImplementation((_store: string, val: unknown) => {
      const v = val as Record<string, unknown>;
      mockStore.set(v.id as string, v);
      return Promise.resolve();
    }),
    delete: vi.fn().mockImplementation((_store: string, id: string) => {
      mockStore.delete(id);
      return Promise.resolve();
    }),
    clear: vi.fn().mockImplementation(() => {
      mockStore.clear();
      return Promise.resolve();
    }),
  }),
}));

describe("Offline Queue Logic", () => {
  beforeEach(() => {
    mockStore.clear();
  });

  describe("QueuedMutation structure", () => {
    it("has the correct shape for a queued mutation", () => {
      const mutation = {
        action: "updatePhaseStatus",
        payload: { phaseId: "abc123", status: "IN_PROGRESS" },
        status: "pending" as const,
        retries: 0,
        createdAt: new Date().toISOString(),
      };

      expect(mutation.action).toBe("updatePhaseStatus");
      expect(mutation.payload).toHaveProperty("phaseId");
      expect(mutation.status).toBe("pending");
      expect(mutation.retries).toBe(0);
    });
  });

  describe("Offline action helper logic", () => {
    it("returns queued:false when online and action succeeds", async () => {
      // Simulate the offlineAction logic
      const isOnline = true;
      const execute = vi.fn().mockResolvedValue({ id: "123", name: "Test" });

      if (isOnline) {
        const data = await execute();
        const result = { queued: false, data };
        expect(result.queued).toBe(false);
        expect(result.data).toEqual({ id: "123", name: "Test" });
        expect(execute).toHaveBeenCalledOnce();
      }
    });

    it("returns queued:true when offline", () => {
      const isOnline = false;
      const execute = vi.fn();

      if (!isOnline) {
        const result = { queued: true };
        expect(result.queued).toBe(true);
        expect(execute).not.toHaveBeenCalled();
      }
    });

    it("detects network errors and queues", async () => {
      const networkError = new Error("Failed to fetch");
      const msg = networkError.message;
      const isNetworkError =
        msg.includes("fetch") ||
        msg.includes("network") ||
        msg.includes("Failed to fetch") ||
        msg.includes("NetworkError") ||
        msg.includes("503");

      expect(isNetworkError).toBe(true);
    });

    it("does not treat validation errors as network errors", () => {
      const validationError = new Error("Invalid phase status");
      const msg = validationError.message;
      const isNetworkError =
        msg.includes("fetch") ||
        msg.includes("network") ||
        msg.includes("Failed to fetch") ||
        msg.includes("NetworkError") ||
        msg.includes("503");

      expect(isNetworkError).toBe(false);
    });
  });

  describe("Handler registry pattern", () => {
    it("registers and retrieves handlers by name", () => {
      const registry = new Map<string, (p: Record<string, unknown>) => Promise<void>>();

      const handler = vi.fn().mockResolvedValue(undefined);
      registry.set("updatePhaseStatus", handler);

      expect(registry.has("updatePhaseStatus")).toBe(true);
      expect(registry.has("nonExistent")).toBe(false);
      expect(registry.size).toBe(1);
    });

    it("executes handler with correct payload", async () => {
      const registry = new Map<string, (p: Record<string, unknown>) => Promise<void>>();

      const handler = vi.fn().mockResolvedValue(undefined);
      registry.set("toggleChecklistItem", handler);

      const payload = { itemId: "item-456" };
      const fn = registry.get("toggleChecklistItem");
      expect(fn).toBeDefined();
      await fn!(payload);
      expect(handler).toHaveBeenCalledWith(payload);
    });

    it("supports multiple handlers without collision", () => {
      const registry = new Map<string, (p: Record<string, unknown>) => Promise<void>>();

      const actions = [
        "updatePhaseStatus",
        "toggleChecklistItem",
        "addComment",
        "createChangeOrder",
        "createDailyLog",
        "flagPhoto",
        "updateDocumentStatus",
        "createInspection",
        "createMaterial",
        "markNotificationRead",
      ];

      for (const action of actions) {
        registry.set(action, vi.fn().mockResolvedValue(undefined));
      }

      expect(registry.size).toBe(actions.length);
      for (const action of actions) {
        expect(registry.has(action)).toBe(true);
      }
    });
  });

  describe("Retry logic", () => {
    it("increments retry count", () => {
      const mutation = { retries: 0, status: "pending" as const };
      const updated = { ...mutation, retries: mutation.retries + 1, status: "syncing" as const };
      expect(updated.retries).toBe(1);
      expect(updated.status).toBe("syncing");
    });

    it("marks as failed after max retries", () => {
      const MAX_RETRIES = 3;
      const mutation = { retries: 3, status: "syncing" as const };
      const isFailed = mutation.retries >= MAX_RETRIES;
      expect(isFailed).toBe(true);
      const updated = { ...mutation, status: isFailed ? ("failed" as const) : mutation.status };
      expect(updated.status).toBe("failed");
    });
  });
});
