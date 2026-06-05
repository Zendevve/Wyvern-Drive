import { create } from 'zustand';
import type { MasterKeyHandle } from '../lib/crypto';
import { getCryptoWorker, type CryptoWorkerHandle } from '../hooks/useCryptoWorker';

export interface CryptoState {
  handle: MasterKeyHandle | null;
  worker: CryptoWorkerHandle | null;
  setHandle: (handle: MasterKeyHandle | null) => void;
  ensureWorker: () => CryptoWorkerHandle;
  wipe: () => void;
}

export const useCryptoStore = create<CryptoState>((set, get) => ({
  handle: null,
  worker: null,
  setHandle(handle) {
    set({ handle });
  },
  ensureWorker() {
    const existing = get().worker;
    if (existing) return existing;
    const worker = getCryptoWorker();
    set({ worker });
    return worker;
  },
  wipe() {
    const worker = get().worker;
    if (worker) {
      try {
        worker.terminate();
      } catch {
        // ignore
      }
    }
    set({ handle: null, worker: null });
  }
}));
