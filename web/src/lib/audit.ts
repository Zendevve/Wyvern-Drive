import { isAuditAction, type AuditAction, type AuditOutcome } from './auditActions';

const DB_NAME = 'wyvern-drive-audit';
const DB_VERSION = 1;
const AUDIT_STORE = 'audit_log';

export interface AuditEvent {
  id: string;
  action: AuditAction;
  target_id: string | null;
  target_type: string | null;
  outcome: AuditOutcome;
  correlation_id: string;
  metadata: Record<string, unknown>;
  created_at: number;
}

export interface AuditFilter {
  actions?: AuditAction[];
  sinceMs?: number;
  limit?: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function isSupported(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  if (!isSupported()) {
    return Promise.reject(new Error('IndexedDB not supported in this environment'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(AUDIT_STORE)) {
          const store = db.createObjectStore(AUDIT_STORE, { keyPath: 'id' });
          store.createIndex('by-created_at', 'created_at');
          store.createIndex('by-action', 'action');
          store.createIndex('by-correlation', 'correlation_id');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('Failed to open audit DB'));
      req.onblocked = () => reject(new Error('Audit DB open blocked by another connection'));
    });
  }
  return dbPromise;
}

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IDBRequest failed'));
  });
}

export async function recordAuditEvent(
  event: Omit<AuditEvent, 'id' | 'created_at'>
): Promise<AuditEvent> {
  const full: AuditEvent = {
    ...event,
    id: crypto.randomUUID(),
    created_at: Date.now()
  };
  if (!isSupported()) return full;
  const db = await openDb();
  const tx = db.transaction(AUDIT_STORE, 'readwrite');
  await promisify(tx.objectStore(AUDIT_STORE).add(full));
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Audit transaction failed'));
  });
  return full;
}

export async function listAuditEvents(filter: AuditFilter = {}): Promise<AuditEvent[]> {
  if (!isSupported()) return [];
  const db = await openDb();
  const tx = db.transaction(AUDIT_STORE, 'readonly');
  const idx = tx.objectStore(AUDIT_STORE).index('by-created_at');
  const all = await promisify<AuditEvent[]>(idx.getAll() as IDBRequest<AuditEvent[]>);
  const reversed = all.sort((a, b) => b.created_at - a.created_at);
  return reversed.filter((e) => {
    if (filter.actions && filter.actions.length > 0 && !filter.actions.includes(e.action)) {
      return false;
    }
    if (typeof filter.sinceMs === 'number' && e.created_at < filter.sinceMs) {
      return false;
    }
    return true;
  }).slice(0, filter.limit ?? 100);
}

export async function countAuditEvents(): Promise<number> {
  if (!isSupported()) return 0;
  const db = await openDb();
  const tx = db.transaction(AUDIT_STORE, 'readonly');
  return promisify(tx.objectStore(AUDIT_STORE).count());
}

export async function clearAuditEvents(): Promise<void> {
  if (!isSupported()) return;
  const db = await openDb();
  const tx = db.transaction(AUDIT_STORE, 'readwrite');
  await promisify(tx.objectStore(AUDIT_STORE).clear());
}

export { isAuditAction };
export type { AuditAction, AuditOutcome };
