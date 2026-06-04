import { create } from 'zustand';
import { apiFetch, setUnauthorizedHandler } from '../lib/api';
import { deriveAccountId } from '../lib/crypto';
import { clearJwt, readJwt, writeJwt } from '../lib/storage';

export type AuthStatus = 'unknown' | 'unauthenticated' | 'authenticated';

interface AuthState {
  jwt: string | null;
  webhookUrl: string | null;
  accountId: string | null;
  status: AuthStatus;
  login: (webhookUrl: string) => Promise<void>;
  logout: () => void;
  restore: () => Promise<void>;
}

interface JwtPayload {
  webhookUrl?: string;
  exp?: number;
}

function decodeJwt(token: string): JwtPayload | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const padded = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(padded + '==='.slice((padded.length + 3) % 4));
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  jwt: null,
  webhookUrl: null,
  accountId: null,
  status: 'unknown',

  async login(webhookUrl) {
    const trimmed = webhookUrl.trim();
    const { token } = await apiFetch<{ token: string }>('/auth/webhook', {
      method: 'POST',
      body: JSON.stringify({ webhookUrl: trimmed })
    });
    writeJwt(token);
    const accountId = await deriveAccountId(trimmed);
    set({ jwt: token, webhookUrl: trimmed, accountId, status: 'authenticated' });
  },

  logout() {
    clearJwt();
    set({ jwt: null, webhookUrl: null, accountId: null, status: 'unauthenticated' });
  },

  async restore() {
    const token = readJwt();
    if (!token) {
      set({ status: 'unauthenticated' });
      return;
    }
    const payload = decodeJwt(token);
    if (!payload?.webhookUrl) {
      clearJwt();
      set({ status: 'unauthenticated' });
      return;
    }
    const accountId = await deriveAccountId(payload.webhookUrl);
    set({
      jwt: token,
      webhookUrl: payload.webhookUrl,
      accountId,
      status: 'authenticated'
    });
  }
}));

export function initAuthUnauthorizedHandler(): void {
  setUnauthorizedHandler(() => {
    useAuthStore.getState().logout();
  });
}
