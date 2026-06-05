import { useEffect, useRef } from 'react';

export interface CryptoWorkerHandle {
  derive(passphrase: string, salt: ArrayBuffer, params: { m: number; t: number; p: number }): Promise<ArrayBuffer>;
  terminate(): void;
}

let activeWorker: Worker | null = null;
let counter = 0;
const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

function ensureWorker(): Worker {
  if (activeWorker) return activeWorker;
  const worker = new Worker(new URL('../workers/argon2.worker.ts', import.meta.url), {
    type: 'module'
  });
  worker.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as { type: string; id?: string; raw?: ArrayBuffer; message?: string };
    if (!data.id) return;
    const p = pending.get(data.id);
    if (!p) return;
    pending.delete(data.id);
    if (data.type === 'derived') p.resolve(data.raw);
    else p.reject(new Error(data.message ?? 'argon2 worker error'));
  });
  activeWorker = worker;
  return worker;
}

function call<T>(payload: Record<string, unknown>): Promise<T> {
  const id = `${++counter}`;
  const worker = ensureWorker();
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    const transferables: Transferable[] = [];
    if (payload.salt instanceof ArrayBuffer) transferables.push(payload.salt);
    if (transferables.length) worker.postMessage({ ...payload, id }, transferables);
    else worker.postMessage({ ...payload, id });
  });
}

export function getCryptoWorker(): CryptoWorkerHandle {
  return {
    async derive(passphrase, salt, params) {
      const raw = await call<ArrayBuffer>({ type: 'derive', passphrase, salt, ...params });
      return raw;
    },
    terminate() {
      activeWorker?.terminate();
      activeWorker = null;
      for (const p of pending.values()) p.reject(new Error('worker terminated'));
      pending.clear();
    }
  };
}

export function useCryptoWorker(): CryptoWorkerHandle {
  const ref = useRef<CryptoWorkerHandle | null>(null);
  if (!ref.current) ref.current = getCryptoWorker();
  useEffect(() => {
    return () => {
      ref.current?.terminate();
      ref.current = null;
    };
  }, []);
  return ref.current!;
}

export function __resetCryptoWorkerForTests(): void {
  if (activeWorker) {
    activeWorker.terminate();
    activeWorker = null;
  }
  for (const p of pending.values()) p.reject(new Error('reset'));
  pending.clear();
  counter = 0;
}
