import { readJwt } from '../lib/storage';

export interface CreateSessionRequest {
  filename: string;
  mimeType: string;
  totalSize: number;
  chunkSize: number;
}

export interface SessionState {
  id: string;
  filename: string;
  mimeType: string;
  totalSize: number;
  chunkSize: number;
  offset: number;
  status: 'open' | 'complete' | 'failed' | 'cancelled';
  createdAt: number;
  updatedAt: number;
  rateLimitRemaining?: number;
  rateLimitResetAfter?: number;
  lastError?: string;
  chunkCount: number;
}

export interface AppendResponse {
  status: 'appended' | 'duplicate' | 'rejected';
  offset: number;
  chunk: { index: number; url: string; size: number } | null;
}

export interface RateLimitInfo {
  remaining?: number;
  resetAfter?: number;
}

const SESSION_URL = '/api/upload/session';

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const jwt = readJwt();
  return {
    ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    ...extra
  };
}

export async function createUploadSession(
  body: CreateSessionRequest
): Promise<SessionState> {
  const res = await fetch(SESSION_URL, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`createUploadSession failed: ${res.status} ${err}`);
  }
  return (await res.json()) as SessionState;
}

export async function getSessionOffset(
  sessionId: string
): Promise<{ offset: number; totalSize: number; status: SessionState['status'] }> {
  const res = await fetch(`${SESSION_URL}/${sessionId}`, {
    method: 'HEAD',
    headers: authHeaders()
  });
  if (!res.ok) {
    if (res.status === 404) throw new Error('session_not_found');
    throw new Error(`getSessionOffset failed: ${res.status}`);
  }
  return {
    offset: Number(res.headers.get('Upload-Offset') ?? 0),
    totalSize: Number(res.headers.get('Upload-Length') ?? 0),
    status: (res.headers.get('Upload-Status') as SessionState['status']) ?? 'open'
  };
}

export async function finalizeSession(sessionId: string): Promise<SessionState> {
  const res = await fetch(`${SESSION_URL}/${sessionId}/finalize`, {
    method: 'POST',
    headers: authHeaders()
  });
  if (!res.ok) {
    throw new Error(`finalizeSession failed: ${res.status}`);
  }
  return (await res.json()) as SessionState;
}

export async function cancelSession(sessionId: string): Promise<void> {
  await fetch(`${SESSION_URL}/${sessionId}/cancel`, {
    method: 'POST',
    headers: authHeaders()
  });
}

export interface AppendOptions {
  signal?: AbortSignal;
  onRetryAfter?: (seconds: number) => void;
}

export async function appendChunk(
  sessionId: string,
  offset: number,
  data: Blob,
  chunkIndex: number,
  idempotencyKey: string,
  options: AppendOptions = {}
): Promise<AppendResponse> {
  const res = await fetch(`${SESSION_URL}/${sessionId}`, {
    method: 'PATCH',
    headers: authHeaders({
      'Content-Type': 'application/octet-stream',
      'Upload-Offset': String(offset),
      'Idempotency-Key': idempotencyKey
    }),
    body: data,
    signal: options.signal
  });

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('Retry-After') ?? '1');
    options.onRetryAfter?.(retryAfter);
    throw new RateLimitedError(retryAfter);
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`appendChunk failed: ${res.status} ${err}`);
  }

  return (await res.json()) as AppendResponse;
}

export class RateLimitedError extends Error {
  retryAfter: number;
  constructor(retryAfter: number) {
    super(`rate_limited:${retryAfter}`);
    this.retryAfter = retryAfter;
    this.name = 'RateLimitedError';
  }
}

export function chunkIdempotencyKey(sessionId: string, offset: number, chunkIndex: number): string {
  // Lightweight non-crypto hash for client-side idempotency key. Server uses
  // SHA-256 internally; client doesn't need cryptographic strength here.
  let h = 0x811c9dc5;
  const s = `${sessionId}:${offset}:${chunkIndex}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function extractRateLimitInfo(res: Response): RateLimitInfo {
  const remaining = res.headers.get('X-RateLimit-Remaining');
  const resetAfter = res.headers.get('X-RateLimit-Reset-After');
  return {
    remaining: remaining !== null ? Number(remaining) : undefined,
    resetAfter: resetAfter !== null ? Number(resetAfter) : undefined
  };
}
