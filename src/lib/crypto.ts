const worker = new Worker(new URL('./crypto.worker.ts', import.meta.url), { type: 'module' });

let messageCounter = 0;
const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

worker.onmessage = (e) => {
  const { id, type, ...rest } = e.data;
  const p = pending.get(id);
  if (!p) return;
  pending.delete(id);
  if (type === 'error') {
    p.reject(new Error(rest.error));
  } else {
    p.resolve(rest);
  }
};

function sendMessage(msg: Record<string, unknown>): Promise<unknown> {
  const id = `msg-${++messageCounter}`;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ ...msg, id });
  });
}

export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const result = await sendMessage({ type: 'deriveKey', password, salt }) as { key: CryptoKey };
  return result.key;
}

export async function encryptFile(data: ArrayBuffer, key: CryptoKey, nonce: Uint8Array): Promise<ArrayBuffer> {
  const result = await sendMessage({ type: 'encrypt', data, key, nonce }) as { data: ArrayBuffer };
  return result.data;
}

export async function decryptFile(data: ArrayBuffer, key: CryptoKey, nonce: Uint8Array): Promise<ArrayBuffer> {
  const result = await sendMessage({ type: 'decrypt', data, key, nonce }) as { data: ArrayBuffer };
  return result.data;
}

export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

export function generateNonce(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(12));
}

export async function hashFile(data: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}
