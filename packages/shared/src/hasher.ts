// SHA-256 via WebCrypto. Works in browsers and Node 20+.

export async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  // Copy into a fresh ArrayBuffer so Node's WebCrypto always sees a plain ArrayBuffer
  // (avoids the SharedArrayBuffer/offset edge case some hosts throw on).
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const buf = await crypto.subtle.digest('SHA-256', copy.buffer);
  return new Uint8Array(buf);
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const raw = await sha256(bytes);
  return toHex(raw);
}

export async function hashChunk(bytes: Uint8Array): Promise<string> {
  return sha256Hex(bytes);
}

// Merkle-style: sort child hashes, concat, hash again.
export async function hashChildren(children: { name: string; hash: string }[]): Promise<string> {
  const sorted = [...children].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const joined = sorted.map((c) => c.hash).join('');
  const enc = new TextEncoder().encode(joined);
  return sha256Hex(enc);
}

function toHex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    s += bytes[i]!.toString(16).padStart(2, '0');
  }
  return s;
}
