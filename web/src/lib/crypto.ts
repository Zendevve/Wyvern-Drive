export async function deriveAccountId(webhookUrl: string): Promise<string> {
  const bytes = new TextEncoder().encode(webhookUrl);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const NONCE_LENGTH = 12;
export const TAG_LENGTH = 16;
export const KEY_LENGTH_BITS = 256;
export const PBKDF2_ITERATIONS = 310_000;
export const SALT_LENGTH = 16;
export const DEK_LENGTH_BITS = 256;

export interface KdfParams {
  kdf: 'argon2id' | 'pbkdf2';
  m?: number;
  t?: number;
  p?: number;
  iterations?: number;
  salt: ArrayBuffer;
}

export interface EncryptedChunk {
  nonce: Uint8Array;
  tag: Uint8Array;
  ciphertext: ArrayBuffer;
}

export interface MasterKeyHandle {
  kek: CryptoKey;
  dek?: CryptoKey;
  wrappedDek?: ArrayBuffer;
  kdfParams: KdfParams;
  createdAt: number;
}

function bufToArrayBuffer(view: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(view.byteLength);
  new Uint8Array(out).set(view);
  return out;
}

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
}

export function generateSalt(n: number = SALT_LENGTH): ArrayBuffer {
  return bufToArrayBuffer(randomBytes(n));
}

export async function importRawAesKey(
  raw: ArrayBuffer | Uint8Array,
  usages: KeyUsage[] = ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
): Promise<CryptoKey> {
  const buf = raw instanceof Uint8Array ? bufToArrayBuffer(raw) : raw;
  return crypto.subtle.importKey('raw', buf, { name: 'AES-GCM' }, false, usages);
}

export async function deriveKeyPbkdf2(
  passphrase: string,
  salt: ArrayBuffer | Uint8Array,
  iterations: number = PBKDF2_ITERATIONS
): Promise<CryptoKey> {
  const passKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const saltBuf = salt instanceof Uint8Array ? bufToArrayBuffer(salt) : salt;
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBuf, iterations, hash: 'SHA-256' },
    passKey,
    KEY_LENGTH_BITS
  );
  return importRawAesKey(bits, ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']);
}

export async function deriveKeyArgon2id(
  passphrase: string,
  salt: ArrayBuffer | Uint8Array,
  m: number = 64 * 1024,
  t: number = 3,
  p: number = 4
): Promise<CryptoKey> {
  const saltBuf = salt instanceof Uint8Array ? bufToArrayBuffer(salt) : salt;
  const worker = new Worker(new URL('../workers/argon2.worker.ts', import.meta.url), {
    type: 'module'
  });
  try {
    const raw = await new Promise<ArrayBuffer>((resolve, reject) => {
      const onMessage = (event: MessageEvent) => {
        const data = event.data as
          | { type: 'derived'; raw: ArrayBuffer }
          | { type: 'error'; message: string };
        if (data.type === 'derived') {
          worker.removeEventListener('message', onMessage);
          worker.removeEventListener('error', onError);
          resolve(data.raw);
        } else if (data.type === 'error') {
          worker.removeEventListener('message', onMessage);
          worker.removeEventListener('error', onError);
          reject(new Error(data.message));
        }
      };
      const onError = (event: ErrorEvent) => {
        worker.removeEventListener('message', onMessage);
        worker.removeEventListener('error', onError);
        reject(new Error(event.message || 'argon2 worker error'));
      };
      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', onError);
      worker.postMessage({ type: 'derive', passphrase, salt: saltBuf, m, t, p });
    });
    return importRawAesKey(raw, ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']);
  } finally {
    worker.terminate();
  }
}

export async function encryptChunk(
  plaintext: ArrayBuffer | Uint8Array,
  key: CryptoKey,
  aad: ArrayBuffer | Uint8Array
): Promise<EncryptedChunk> {
  const dataBuf = plaintext instanceof Uint8Array ? bufToArrayBuffer(plaintext) : plaintext;
  const aadBuf = aad instanceof Uint8Array ? bufToArrayBuffer(aad) : aad;
  const nonce = randomBytes(NONCE_LENGTH);
  const out = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: aadBuf },
    key,
    dataBuf
  );
  const outBytes = new Uint8Array(out);
  const ctLen = outBytes.byteLength - TAG_LENGTH;
  if (ctLen < 0) throw new Error('encryptChunk: invalid ciphertext length');
  const ciphertext = outBytes.slice(0, ctLen);
  const tag = outBytes.slice(ctLen);
  return { nonce, tag, ciphertext: ciphertext.buffer };
}

export async function decryptChunk(
  chunk: EncryptedChunk,
  key: CryptoKey,
  aad: ArrayBuffer | Uint8Array
): Promise<ArrayBuffer> {
  const aadBuf = aad instanceof Uint8Array ? bufToArrayBuffer(aad) : aad;
  const merged = new Uint8Array(chunk.ciphertext.byteLength + TAG_LENGTH);
  merged.set(new Uint8Array(chunk.ciphertext), 0);
  merged.set(chunk.tag, chunk.ciphertext.byteLength);
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: chunk.nonce, additionalData: aadBuf },
    key,
    merged
  );
}

export async function generateDek(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: DEK_LENGTH_BITS },
    true,
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  );
}

export async function wrapDek(dek: CryptoKey, kek: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.wrapKey('raw', dek, kek, { name: 'AES-KW' });
}

export async function unwrapDek(wrapped: ArrayBuffer, kek: CryptoKey): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey(
    'raw',
    wrapped,
    kek,
    { name: 'AES-KW' },
    { name: 'AES-GCM' },
    true,
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  );
}

export async function computeAad(fileId: string, chunkIndex: number): Promise<ArrayBuffer> {
  const bytes = new TextEncoder().encode(`${fileId}:${chunkIndex}`);
  return crypto.subtle.digest('SHA-256', bytes);
}

export function areBuffersEqual(a: ArrayBuffer | Uint8Array, b: ArrayBuffer | Uint8Array): boolean {
  const av = a instanceof Uint8Array ? a : new Uint8Array(a);
  const bv = b instanceof Uint8Array ? b : new Uint8Array(b);
  if (av.byteLength !== bv.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < av.byteLength; i++) diff |= av[i] ^ bv[i];
  return diff === 0;
}
