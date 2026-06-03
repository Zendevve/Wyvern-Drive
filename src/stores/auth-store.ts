import { create } from 'zustand';
import { deriveKey, generateSalt } from '../lib/crypto';

const AUTO_LOCK_MS = 15 * 60 * 1000;

interface AuthState {
  password: string | null;
  derivedKey: CryptoKey | null;
  salt: Uint8Array | null;
  isUnlocked: boolean;
  inactivityTimer: ReturnType<typeof setTimeout> | null;
  unlock: (password: string) => Promise<void>;
  lock: () => void;
  resetInactivityTimer: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  password: null,
  derivedKey: null,
  salt: null,
  isUnlocked: false,
  inactivityTimer: null,

  unlock: async (password: string) => {
    const salt = generateSalt();
    const key = await deriveKey(password, salt);
    set({ password, derivedKey: key, salt, isUnlocked: true });
    get().resetInactivityTimer();
  },

  lock: () => {
    const timer = get().inactivityTimer;
    if (timer) clearTimeout(timer);
    set({
      password: null,
      derivedKey: null,
      salt: null,
      isUnlocked: false,
      inactivityTimer: null,
    });
  },

  resetInactivityTimer: () => {
    const timer = get().inactivityTimer;
    if (timer) clearTimeout(timer);
    const newTimer = setTimeout(() => {
      get().lock();
    }, AUTO_LOCK_MS);
    set({ inactivityTimer: newTimer });
  },
}));
