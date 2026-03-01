/**
 * @file src/lib/audio/queue.ts
 * @description IndexedDB offline queue for Keeney Mode voice memos.
 *
 * When offline, recorded memos are stored locally with their recording
 * timestamp. On reconnect, the queue syncs to the server preserving
 * chronological accuracy.
 *
 * Sprint 21 — Keeney Mode
 */

const DB_NAME = "keeney-queue";
const DB_VERSION = 1;
const STORE_NAME = "memos";

export type QueuedMemoStatus = "queued" | "syncing" | "done" | "failed";

export interface QueuedMemo {
  id: string;
  audioBlob: Blob;
  recordedAt: string; // ISO timestamp — recording time, not sync time
  commandType: string;
  photoBlob?: Blob;
  status: QueuedMemoStatus;
  retryCount: number;
  lastError?: string;
}

// ── Database helpers ─────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("recordedAt", "recordedAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function generateId(): string {
  return `memo_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Add a voice memo to the offline queue.
 */
export async function enqueueMemo(
  audioBlob: Blob,
  commandType: string,
  photoBlob?: Blob
): Promise<string> {
  const db = await openDB();
  const id = generateId();

  const memo: QueuedMemo = {
    id,
    audioBlob,
    recordedAt: new Date().toISOString(),
    commandType,
    photoBlob,
    status: "queued",
    retryCount: 0,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).add(memo);
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get all queued memos (status = "queued" or "failed").
 */
export async function getQueuedMemos(): Promise<QueuedMemo[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => {
      const memos = (request.result as QueuedMemo[]).filter(
        (m) => m.status === "queued" || m.status === "failed"
      );
      resolve(memos.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)));
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get count of pending (queued + failed) memos.
 */
export async function getQueueCount(): Promise<number> {
  const memos = await getQueuedMemos();
  return memos.length;
}

/**
 * Update a memo's status in the queue.
 */
export async function updateMemoStatus(
  id: string,
  status: QueuedMemoStatus,
  error?: string
): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const memo = getReq.result as QueuedMemo | undefined;
      if (!memo) { resolve(); return; }

      memo.status = status;
      if (error) memo.lastError = error;
      if (status === "failed") memo.retryCount += 1;

      store.put(memo);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Remove a completed memo from the queue.
 */
export async function removeMemo(id: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Sync all queued memos to the server.
 * Processes sequentially in chronological order.
 * Returns count of successfully synced memos.
 */
export async function syncQueue(
  onProgress?: (synced: number, total: number) => void
): Promise<number> {
  const memos = await getQueuedMemos();
  if (memos.length === 0) return 0;

  let synced = 0;

  for (const memo of memos) {
    // Skip if too many retries
    if (memo.retryCount >= 3) continue;

    try {
      await updateMemoStatus(memo.id, "syncing");

      // Upload audio to transcribe endpoint
      const formData = new FormData();
      formData.append("audio", memo.audioBlob, "memo.webm");
      formData.append("commandType", memo.commandType);

      const res = await fetch("/api/voice/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      // Mark as done and remove
      await updateMemoStatus(memo.id, "done");
      await removeMemo(memo.id);
      synced++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sync failed";
      await updateMemoStatus(memo.id, "failed", msg);
    }

    onProgress?.(synced, memos.length);
  }

  return synced;
}

/**
 * Check if the browser is online.
 */
export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}
