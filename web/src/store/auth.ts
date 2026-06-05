import { create } from 'zustand';
import { apiFetch, setUnauthorizedHandler } from '../lib/api';
import { deriveAccountId } from '../lib/crypto';
import { clearJwt, readJwt, writeJwt } from '../lib/storage';
import { newCorrelationId, recordAuditEvent, withAudit } from '../lib/auditMiddleware';
import { hasMasterPassword } from '../lib/secretStore';
import { useCryptoStore } from './crypto';

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

function accountIdForLogging(trimmed: string): string {
  try {
    return deriveAccountIdSync(trimmed);
  } catch {
    return trimmed.slice(0, 16);
  }
}

function deriveAccountIdSync(trimmed: string): string {
  // Best-effort sync hash for audit log target_id; full derive is async.
  // Falls back to a stable hash of the trimmed string.
  let h = 5381;
  for (let i = 0; i < trimmed.length; i++) {
    h = ((h << 5) + h + trimmed.charCodeAt(i)) | 0;
  }
  return `acct-${(h >>> 0).toString(16)}`;
}

export const useAuthStore = create<AuthState>((set) => ({
  jwt: null,
  webhookUrl: null,
  accountId: null,
  status: 'unknown',

  async login(webhookUrl) {
    const trimmed = webhookUrl.trim();
    const masterSet = await hasMasterPassword().catch(() => false);
    if (masterSet && !useCryptoStore.getState().handle) {
      throw new Error('Vault is locked. Unlock the vault before signing in.');
    }
    await withAudit(
      { correlationId: newCorrelationId() },
      {
        action: 'login',
        targetType: 'account',
        metadata: () => ({ webhook_length: trimmed.length })
      },
      async () => {
        const { token } = await apiFetch<{ token: string }>('/auth/webhook', {
          method: 'POST',
          body: JSON.stringify({ webhookUrl: trimmed })
        });
        writeJwt(token);
        const accountId = await deriveAccountId(trimmed);
        set({ jwt: token, webhookUrl: trimmed, accountId, status: 'authenticated' });
        return accountId;
      }
    );
  },

  logout() {
    const correlationId = newCorrelationId();
    const currentAccount = useAuthStore.getState().accountId;
    try {
      useCryptoStore.getState().wipe();
    } catch {
      // ignore
    }
    clearJwt();
    set({ jwt: null, webhookUrl: null, accountId: null, status: 'unauthenticated' });
    void recordAuditEvent({
      action: 'logout',
      target_id: currentAccount,
      target_type: 'account',
      outcome: 'success',
      correlation_id: correlationId,
      metadata: { phase: 'end' }
    });
  },

  async restore() {
    const correlationId = newCorrelationId();
    const token = readJwt();
    if (!token) {
      set({ status: 'unauthenticated' });
      return;
    }
    const masterSet = await hasMasterPassword().catch(() => false);
    if (masterSet && !useCryptoStore.getState().handle) {
      set({ status: 'unauthenticated' });
      return;
    }
    const payload = decodeJwt(token);
    if (!payload?.webhookUrl) {
      clearJwt();
      set({ status: 'unauthenticated' });
      await recordAuditEvent({
        action: 'session_restore',
        target_id: null,
        target_type: 'session',
        outcome: 'error',
        correlation_id: correlationId,
        metadata: { reason: 'invalid_token_payload' }
      });
      return;
    }
    const accountId = await deriveAccountId(payload.webhookUrl);
    set({
      jwt: token,
      webhookUrl: payload.webhookUrl,
      accountId,
      status: 'authenticated'
    });
    await recordAuditEvent({
      action: 'session_restore',
      target_id: accountIdForLogging(payload.webhookUrl),
      target_type: 'session',
      outcome: 'success',
      correlation_id: correlationId,
      metadata: {}
    });
  }
}));

export function initAuthUnauthorizedHandler(): void {
  setUnauthorizedHandler(() => {
    useAuthStore.getState().logout();
  });
}
