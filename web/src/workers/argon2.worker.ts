/// <reference lib="webworker" />
import argon2 from 'argon2-browser/dist/argon2-bundled.min.js';

interface DeriveRequest {
  type: 'derive';
  passphrase: string;
  salt: ArrayBuffer;
  m: number;
  t: number;
  p: number;
  hashLen?: number;
}

interface VerifyRequest {
  type: 'verify';
  passphrase: string;
  encoded: string;
}

type Request = DeriveRequest | VerifyRequest;

const ctx = self as DedicatedWorkerGlobalScope;

ctx.addEventListener('message', (event: MessageEvent<Request>) => {
  const req = event.data;
  if (req.type === 'derive') {
    void handleDerive(req);
  } else if (req.type === 'verify') {
    void handleVerify(req);
  }
});

async function handleDerive(req: DeriveRequest): Promise<void> {
  try {
    const saltBytes = new Uint8Array(req.salt);
    const saltB64 = bytesToBase64(saltBytes);
    const result = await (argon2 as unknown as {
      hash: (p: {
        pass: string;
        salt: string;
        time: number;
        mem: number;
        parallelism: number;
        hashLen: number;
        type: number;
      }) => Promise<{ hash: Uint8Array }>;
    }).hash({
      pass: req.passphrase,
      salt: saltB64,
      time: req.t,
      mem: req.m,
      parallelism: req.p,
      hashLen: req.hashLen ?? 32,
      type: 2
    });
    const ab = new ArrayBuffer(result.hash.byteLength);
    new Uint8Array(ab).set(result.hash);
    ctx.postMessage({ type: 'derived', raw: ab }, { transfer: [ab] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'argon2 derive failed';
    ctx.postMessage({ type: 'error', message });
  }
}

async function handleVerify(req: VerifyRequest): Promise<void> {
  try {
    await (argon2 as unknown as {
      verify: (p: { pass: string; encoded: string }) => Promise<unknown>;
    }).verify({ pass: req.passphrase, encoded: req.encoded });
    ctx.postMessage({ type: 'verified', ok: true });
  } catch {
    ctx.postMessage({ type: 'verified', ok: false });
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.byteLength; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export {};
