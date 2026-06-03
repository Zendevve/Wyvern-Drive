import { loadMediaBlob } from './media';

const PBKDF2_ITERATIONS = 600_000;

export const ONE_HOUR = 3600000;
export const ONE_DAY = 86400000;
export const SEVEN_DAYS = 604800000;
export const THIRTY_DAYS = 2592000000;

interface SharePayload {
  k: string;
  s: string;
  n: string;
  e: number;
  p: boolean;
}

function toBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveShareKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptFileKey(fileKey: CryptoKey, shareKey: CryptoKey): Promise<{ cipher: Uint8Array; nonce: Uint8Array }> {
  const rawKeyBuffer = await crypto.subtle.exportKey('raw', fileKey);
  const rawKey = new Uint8Array(rawKeyBuffer);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce as unknown as BufferSource, tagLength: 128 },
    shareKey,
    rawKey.buffer as ArrayBuffer
  );
  return { cipher: new Uint8Array(cipher), nonce };
}

async function decryptFileKey(
  encryptedKey: Uint8Array,
  salt: Uint8Array,
  nonce: Uint8Array,
  password: string
): Promise<CryptoKey | null> {
  try {
    const shareKey = await deriveShareKey(password, salt);
    const dataBuf = new ArrayBuffer(encryptedKey.length);
    new Uint8Array(dataBuf).set(encryptedKey);
    const rawKey = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: nonce as unknown as BufferSource, tagLength: 128 },
      shareKey,
      dataBuf
    );
    return crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  } catch {
    return null;
  }
}

export async function generateShareLink(
  fileId: string,
  _fileName: string,
  fileKey: CryptoKey,
  password?: string,
  expiresIn?: number
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  let encryptedKeyData: Uint8Array;
  let nonce: Uint8Array;

  if (password) {
    const shareKey = await deriveShareKey(password, salt);
    const result = await encryptFileKey(fileKey, shareKey);
    encryptedKeyData = result.cipher;
    nonce = result.nonce;
  } else {
    const rawKey = await crypto.subtle.exportKey('raw', fileKey);
    encryptedKeyData = new Uint8Array(rawKey);
    nonce = new Uint8Array(12);
  }

  const payload: SharePayload = {
    k: toBase64(encryptedKeyData),
    s: toBase64(salt),
    n: toBase64(nonce),
    e: expiresIn ? Date.now() + expiresIn : 0,
    p: !!password,
  };

  const encoded = btoa(JSON.stringify(payload));
  return `/share/${fileId}#${encoded}`;
}

export function parseShareLink(url: string): { fileId: string; payload: SharePayload } | null {
  try {
    const match = url.match(/\/share\/([^#]+)#(.+)$/);
    if (!match) return null;

    const fileId = match[1];
    const payload: SharePayload = JSON.parse(atob(match[2]));
    return { fileId, payload };
  } catch {
    return null;
  }
}

export async function verifySharePassword(
  encryptedKey: string,
  salt: string,
  nonce: string,
  password: string
): Promise<CryptoKey | null> {
  return decryptFileKey(
    fromBase64(encryptedKey),
    fromBase64(salt),
    fromBase64(nonce),
    password
  );
}

export async function accessShare(
  fileId: string,
  key: CryptoKey,
  webhookUrl: string
): Promise<Blob> {
  return loadMediaBlob(fileId, key, webhookUrl);
}
