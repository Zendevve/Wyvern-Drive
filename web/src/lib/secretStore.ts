import {
  computeAad,
  deriveKeyArgon2id,
  deriveKeyPbkdf2,
  generateSalt,
  type KdfParams,
  type MasterKeyHandle
} from './crypto';
import { recordAuditEvent, newCorrelationId } from './auditMiddleware';

const DB_NAME = 'wyvern-drive-secrets';
const DB_VERSION = 2;
const STORE = 'secret_store';
const ENTRY_ID = 'main' as const;
const WEBHOOK_AAD_CONTEXT = 'wyvern-webhook-secret-v1';
const MAX_UNLOCK_ATTEMPTS = 5;

const PLAINTEXT_WEBHOOK_KEYS = ['wyvern.webhookUrl', 'webhookUrl', 'webhook_url'];

export interface SecretStoreEntry {
  id: typeof ENTRY_ID;
  ciphertext: ArrayBuffer;
  iv: ArrayBuffer;
  aad: ArrayBuffer;
  kdf: 'argon2id' | 'pbkdf2';
  kdfParams: { m?: number; t?: number; p?: number; iterations?: number; salt: ArrayBuffer };
  version: 1;
  attempts: number;
  lockedUntil: number;
  createdAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function isSupported(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  if (!isSupported()) return Promise.reject(new Error('IndexedDB not supported'));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open secret DB'));
    req.onblocked = () => reject(new Error('Secret DB open blocked'));
  });
  return dbPromise;
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IDB tx failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IDB tx aborted'));
  });
}

async function readEntry(): Promise<SecretStoreEntry | null> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readonly');
  const req = tx.objectStore(STORE).get(ENTRY_ID);
  return await new Promise<SecretStoreEntry | null>((resolve, reject) => {
    req.onsuccess = () => resolve((req.result as SecretStoreEntry | undefined) ?? null);
    req.onerror = () => reject(req.error ?? new Error('read failed'));
  });
}

async function writeEntry(entry: SecretStoreEntry): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put(entry);
  await txDone(tx);
}

async function deleteEntry(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).delete(ENTRY_ID);
  await txDone(tx);
}

export function deriveKekForKdf(
  passphrase: string,
  kdf: 'argon2id' | 'pbkdf2',
  params: { m?: number; t?: number; p?: number; iterations?: number; salt: ArrayBuffer }
): Promise<CryptoKey> {
  if (kdf === 'argon2id') {
    return deriveKeyArgon2id(
      passphrase,
      params.salt,
      params.m ?? 64 * 1024,
      params.t ?? 3,
      params.p ?? 4
    );
  }
  return deriveKeyPbkdf2(passphrase, params.salt, params.iterations ?? 310_000);
}

async function webhookAad(): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(WEBHOOK_AAD_CONTEXT));
}

function wipeLocalStoragePlaintext(): void {
  if (typeof localStorage === 'undefined') return;
  for (const key of PLAINTEXT_WEBHOOK_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

export async function hasMasterPassword(): Promise<boolean> {
  if (!isSupported()) return false;
  try {
    const entry = await readEntry();
    return entry !== null;
  } catch {
    return false;
  }
}

export interface SetMasterPasswordOptions {
  passphrase: string;
  webhookUrl: string;
  kdf?: 'argon2id' | 'pbkdf2';
  kdfOverride?: { m?: number; t?: number; p?: number; iterations?: number };
}

export interface SetMasterPasswordResult {
  handle: MasterKeyHandle;
  usedFallbackKdf: boolean;
}

export async function setMasterPassword(
  opts: SetMasterPasswordOptions
): Promise<SetMasterPasswordResult> {
  const kdf: 'argon2id' | 'pbkdf2' = opts.kdf ?? 'argon2id';
  const salt = generateSalt(16);
  const kdfParams: KdfParams = {
    kdf,
    salt,
    ...(kdf === 'argon2id'
      ? {
          m: opts.kdfOverride?.m ?? 64 * 1024,
          t: opts.kdfOverride?.t ?? 3,
          p: opts.kdfOverride?.p ?? 4
        }
      : { iterations: opts.kdfOverride?.iterations ?? 310_000 })
  };
  const kek = await deriveKekForKdf(opts.passphrase, kdf, kdfParams);
  const aad = await webhookAad();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad },
    kek,
    new TextEncoder().encode(opts.webhookUrl)
  );
  const entry: SecretStoreEntry = {
    id: ENTRY_ID,
    ciphertext: encBuf,
    iv: iv.buffer as ArrayBuffer,
    aad,
    kdf,
    kdfParams: {
      salt,
      m: kdfParams.m,
      t: kdfParams.t,
      p: kdfParams.p,
      iterations: kdfParams.iterations
    },
    version: 1,
    attempts: 0,
    lockedUntil: 0,
    createdAt: Date.now()
  };
  await writeEntry(entry);
  wipeLocalStoragePlaintext();
  await recordAuditEvent({
    action: 'master_password_set',
    target_id: null,
    target_type: 'secret_store',
    outcome: 'success',
    correlation_id: newCorrelationId(),
    metadata: { kdf }
  });
  return {
    handle: { kek, kdfParams: entry.kdfParams, createdAt: entry.createdAt },
    usedFallbackKdf: kdf === 'pbkdf2'
  };
}

export interface UnlockResult {
  handle: MasterKeyHandle;
  webhookUrl: string;
}

export async function unlock(passphrase: string): Promise<UnlockResult> {
  const entry = await readEntry();
  if (!entry) throw new Error('No master password set');
  if (Date.now() < entry.lockedUntil) {
    throw new Error('Account locked due to too many failed attempts');
  }
  const kek = await deriveKekForKdf(passphrase, entry.kdf, entry.kdfParams);
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(entry.iv), additionalData: entry.aad },
      kek,
      entry.ciphertext
    );
    const webhookUrl = new TextDecoder().decode(plain);
    if (entry.attempts > 0) {
      await writeEntry({ ...entry, attempts: 0, lockedUntil: 0 });
    }
    await recordAuditEvent({
      action: 'master_password_unlock',
      target_id: null,
      target_type: 'secret_store',
      outcome: 'success',
      correlation_id: newCorrelationId(),
      metadata: {}
    });
    return {
      webhookUrl,
      handle: { kek, kdfParams: entry.kdfParams, createdAt: entry.createdAt }
    };
  } catch (err) {
    const attempts = entry.attempts + 1;
    const wipeStore = attempts >= MAX_UNLOCK_ATTEMPTS;
    const lockedUntil = wipeStore ? Date.now() + 60_000 : entry.lockedUntil;
    await writeEntry({ ...entry, attempts, lockedUntil });
    await recordAuditEvent({
      action: 'master_password_unlock_failed',
      target_id: null,
      target_type: 'secret_store',
      outcome: 'error',
      correlation_id: newCorrelationId(),
      metadata: { attempt: attempts, kdf: entry.kdf }
    });
    if (wipeStore) {
      await wipe();
      throw new Error('Too many failed attempts. Secret store wiped.');
    }
    throw err instanceof Error ? err : new Error('Unlock failed');
  }
}

export async function wipe(): Promise<void> {
  if (!isSupported()) return;
  try {
    await deleteEntry();
  } catch {
    // ignore
  }
  wipeLocalStoragePlaintext();
}

export { computeAad };
