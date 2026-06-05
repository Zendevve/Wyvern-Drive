const DB_NAME = 'wyvern-drive-queue';
const DB_VERSION = 1;
const QUEUE_STORE = 'operations';

export interface QueueOperation {
  id: string;
  idempotency_key: string;
  type: 'upload' | 'create_folder' | 'rename' | 'delete';
  payload: Record<string, any>;
  status: 'pending' | 'in_flight' | 'succeeded' | 'failed' | 'cancelled';
  retries: number;
  error: string | null;
  created_at: number;
  updated_at: number;
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
        if (!db.objectStoreNames.contains(QUEUE_STORE)) {
          const store = db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
          store.createIndex('by-status', 'status');
          store.createIndex('by-created_at', 'created_at');
          store.createIndex('by-idempotency_key', 'idempotency_key');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('Failed to open queue DB'));
      req.onblocked = () => reject(new Error('Queue DB open blocked by another connection'));
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

export async function saveOperation(op: QueueOperation): Promise<QueueOperation> {
  if (!isSupported()) return op;
  const db = await openDb();
  const tx = db.transaction(QUEUE_STORE, 'readwrite');
  await promisify(tx.objectStore(QUEUE_STORE).put(op));
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Queue transaction failed'));
  });
  return op;
}

export async function getOperation(id: string): Promise<QueueOperation | null> {
  if (!isSupported()) return null;
  const db = await openDb();
  const tx = db.transaction(QUEUE_STORE, 'readonly');
  const res = await promisify<QueueOperation | undefined>(tx.objectStore(QUEUE_STORE).get(id));
  return res ?? null;
}

export async function listPendingOrInFlight(): Promise<QueueOperation[]> {
  if (!isSupported()) return [];
  const all = await listAllOperations();
  return all.filter((op) => op.status === 'pending' || op.status === 'in_flight');
}

export async function deleteOperation(id: string): Promise<void> {
  if (!isSupported()) return;
  const db = await openDb();
  const tx = db.transaction(QUEUE_STORE, 'readwrite');
  await promisify(tx.objectStore(QUEUE_STORE).delete(id));
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Queue transaction failed'));
  });
}

export async function clearOperations(): Promise<void> {
  if (!isSupported()) return;
  const db = await openDb();
  const tx = db.transaction(QUEUE_STORE, 'readwrite');
  await promisify(tx.objectStore(QUEUE_STORE).clear());
}

export async function listAllOperations(): Promise<QueueOperation[]> {
  if (!isSupported()) return [];
  const db = await openDb();
  const tx = db.transaction(QUEUE_STORE, 'readonly');
  const store = tx.objectStore(QUEUE_STORE);
  const all = await promisify<QueueOperation[]>(store.getAll() as IDBRequest<QueueOperation[]>);
  return all.sort((a, b) => a.created_at - b.created_at);
}

export function __resetQueueDbPromise(): void {
  dbPromise = null;
}
