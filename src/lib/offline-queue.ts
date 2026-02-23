// Offline mutation queue — stores actions in IndexedDB when offline,
// replays them when connectivity returns.
//
// Usage in components:
//   import { queueMutation, getQueueStatus } from "@/lib/offline-queue";
//   await queueMutation({ action: "createComment", payload: { ... } });

const DB_NAME = "construction-pm-offline";
const DB_VERSION = 1;
const STORE_NAME = "mutations";

export interface QueuedMutation {
  id?: number;
  action: string;
  payload: Record<string, unknown>;
  timestamp: number;
  retries: number;
  status: "pending" | "syncing" | "failed";
  error?: string;
}

export interface QueueStatus {
  pending: number;
  failed: number;
  isOnline: boolean;
}

// ── IndexedDB helpers ──

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ── Public API ──

export async function queueMutation(
  mutation: Omit<QueuedMutation, "id" | "timestamp" | "retries" | "status">
): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const entry: QueuedMutation = {
      ...mutation,
      timestamp: Date.now(),
      retries: 0,
      status: "pending",
    };
    const req = store.add(entry);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

export async function getPendingMutations(): Promise<QueuedMutation[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("status");
    const req = index.getAll("pending");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getFailedMutations(): Promise<QueuedMutation[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("status");
    const req = index.getAll("failed");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function updateMutationStatus(
  id: number,
  status: QueuedMutation["status"],
  error?: string
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const entry = getReq.result as QueuedMutation;
      if (!entry) return resolve();
      entry.status = status;
      entry.retries = status === "syncing" ? entry.retries + 1 : entry.retries;
      if (error) entry.error = error;
      const putReq = store.put(entry);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function removeMutation(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getQueueStatus(): Promise<QueueStatus> {
  const [pending, failed] = await Promise.all([
    getPendingMutations(),
    getFailedMutations(),
  ]);
  return {
    pending: pending.length,
    failed: failed.length,
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  };
}

export async function clearQueue(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
