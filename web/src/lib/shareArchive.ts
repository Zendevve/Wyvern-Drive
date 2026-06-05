import JSZip from 'jszip';
import { computeAad, decryptChunk, deriveKeyArgon2id, encryptChunk, generateSalt } from './crypto';

export const SHARE_ARCHIVE_FORMAT_VERSION = 1;
export const SHARE_ARCHIVE_MIME = 'application/zip';

export interface ShareArchiveFileMeta {
  name: string;
  size: number;
  mime: string;
}

export interface ShareArchiveChunk {
  index: number;
  nonce: string;
  tag: string;
  ciphertext_offset: number;
  ciphertext_length: number;
  plaintext_length: number;
}

export interface ShareArchiveEncryption {
  kdf: 'argon2id';
  params: { m: number; t: number; p: number };
  salt: string;
  kdf_hint: string;
}

export interface ShareArchiveManifest {
  format_version: number;
  file: ShareArchiveFileMeta;
  chunks: ShareArchiveChunk[];
  encryption: ShareArchiveEncryption;
}

export interface BuildShareArchiveOptions {
  file: File | { name: string; size: number; mime: string; arrayBuffer: () => Promise<ArrayBuffer> };
  passphrase: string;
  m?: number;
  t?: number;
  p?: number;
}

const CHUNK_PLAINTEXT_SIZE = 24 * 1024 * 1024 - 28;

function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.byteLength; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function base64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export async function buildShareArchive(opts: BuildShareArchiveOptions): Promise<Blob> {
  const m = opts.m ?? 64 * 1024;
  const t = opts.t ?? 3;
  const p = opts.p ?? 4;
  const salt = generateSalt(16);
  const saltBytes = new Uint8Array(salt);
  const raw = await deriveKeyArgon2id(opts.passphrase, saltBytes, m, t, p);
  const chunksBinParts: Uint8Array[] = [];
  const chunkMetas: ShareArchiveChunk[] = [];
  const fileId = crypto.randomUUID();
  let runningOffset = 0;
  let index = 0;
  for (let offset = 0; offset < opts.file.size; offset += CHUNK_PLAINTEXT_SIZE) {
    const end = Math.min(offset + CHUNK_PLAINTEXT_SIZE, opts.file.size);
    const buf = await (opts.file as File).slice
      ? await (opts.file as File).slice(offset, end).arrayBuffer()
      : await opts.file.arrayBuffer().then((ab) => ab.slice(offset, end));
    const aad = await computeAad(fileId, index);
    const enc = await encryptChunk(buf, raw, aad);
    const blob = new Uint8Array(enc.nonce.byteLength + enc.ciphertext.byteLength + enc.tag.byteLength);
    blob.set(enc.nonce, 0);
    blob.set(new Uint8Array(enc.ciphertext), enc.nonce.byteLength);
    blob.set(enc.tag, enc.nonce.byteLength + enc.ciphertext.byteLength);
    chunksBinParts.push(blob);
    chunkMetas.push({
      index,
      nonce: bytesToBase64(enc.nonce),
      tag: bytesToBase64(enc.tag),
      ciphertext_offset: runningOffset + enc.nonce.byteLength,
      ciphertext_length: enc.ciphertext.byteLength,
      plaintext_length: end - offset
    });
    runningOffset += blob.byteLength;
    index += 1;
  }
  const manifest: ShareArchiveManifest = {
    format_version: SHARE_ARCHIVE_FORMAT_VERSION,
    file: { name: opts.file.name, size: opts.file.size, mime: opts.file.mime || 'application/octet-stream' },
    chunks: chunkMetas,
    encryption: {
      kdf: 'argon2id',
      params: { m, t, p },
      salt: bytesToBase64(saltBytes),
      kdf_hint: `argon2id m=${m}KiB t=${t} p=${p}`
    }
  };
  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('chunks.bin', concatBytes(chunksBinParts));
  zip.file(
    'meta.txt',
    'Encrypted with Wyvern Drive. Open in Wyvern Drive and supply the passphrase.'
  );
  void fileId;
  return zip.generateAsync({ type: 'blob', mimeType: SHARE_ARCHIVE_MIME });
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((a, p) => a + p.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.byteLength;
  }
  return out;
}

export interface ParsedShareArchive {
  manifest: ShareArchiveManifest;
  chunksBin: Uint8Array;
}

export async function parseShareArchive(blob: Blob): Promise<ParsedShareArchive> {
  const zip = await JSZip.loadAsync(blob);
  const manifestText = await zip.file('manifest.json')?.async('string');
  if (!manifestText) throw new Error('Invalid share archive: missing manifest.json');
  const manifest = JSON.parse(manifestText) as ShareArchiveManifest;
  if (manifest.format_version !== SHARE_ARCHIVE_FORMAT_VERSION) {
    throw new Error(`Unsupported share archive format version: ${manifest.format_version}`);
  }
  const chunksBinBuf = await zip.file('chunks.bin')?.async('arraybuffer');
  if (!chunksBinBuf) throw new Error('Invalid share archive: missing chunks.bin');
  return { manifest, chunksBin: new Uint8Array(chunksBinBuf) };
}

export interface DecryptShareArchiveOptions {
  blob: Blob;
  passphrase: string;
  fileId?: string;
}

export interface DecryptedShareFile {
  name: string;
  size: number;
  mime: string;
  bytes: ArrayBuffer;
}

export async function decryptShareArchive(opts: DecryptShareArchiveOptions): Promise<DecryptedShareFile> {
  const { manifest, chunksBin } = await parseShareArchive(opts.blob);
  const salt = base64ToBytes(manifest.encryption.salt);
  const { m, t, p } = manifest.encryption.params;
  const raw = await deriveKeyArgon2id(opts.passphrase, salt, m, t, p);
  const plaintextParts: Uint8Array[] = [];
  const fileId = opts.fileId ?? crypto.randomUUID();
  for (const chunk of manifest.chunks) {
    const start = chunk.ciphertext_offset;
    const end = start + chunk.ciphertext_length;
    const ct = chunksBin.slice(start, end);
    const tag = base64ToBytes(chunk.tag);
    const nonce = base64ToBytes(chunk.nonce);
    const aad = await computeAad(fileId, chunk.index);
    const plain = await decryptChunk({ nonce, tag, ciphertext: ct.buffer.slice(ct.byteOffset, ct.byteOffset + ct.byteLength) }, raw, aad);
    plaintextParts.push(new Uint8Array(plain));
  }
  return {
    name: manifest.file.name,
    size: manifest.file.size,
    mime: manifest.file.mime,
    bytes: concatBytes(plaintextParts).buffer
  };
}
