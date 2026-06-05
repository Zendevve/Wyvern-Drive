import { randomUUID, createHash } from 'node:crypto';
import { uploadChunk } from './discord';
import type { DiscordAttachment } from './discord';

export type SessionStatus = 'open' | 'complete' | 'failed' | 'cancelled';

export interface UploadSession {
  id: string;
  accountId: string;
  filename: string;
  mimeType: string;
  totalSize: number;
  chunkSize: number;
  createdAt: number;
  updatedAt: number;
  status: SessionStatus;
  offset: number;
  chunks: Array<{
    index: number;
    offset: number;
    size: number;
    url: string;
    discordMessageId: string;
    sha256: string;
  }>;
  idempotency: Map<string, { status: number; body: unknown }>;
  rateLimitRemaining?: number;
  rateLimitResetAfter?: number;
  lastError?: string;
}

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const sessions = new Map<string, UploadSession>();

function purgeExpired(): void {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.updatedAt > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}

export interface CreateSessionInput {
  accountId: string;
  filename: string;
  mimeType: string;
  totalSize: number;
  chunkSize: number;
}

export function createSession(input: CreateSessionInput): UploadSession {
  purgeExpired();
  const id = randomUUID();
  const now = Date.now();
  const session: UploadSession = {
    id,
    accountId: input.accountId,
    filename: input.filename,
    mimeType: input.mimeType,
    totalSize: input.totalSize,
    chunkSize: input.chunkSize,
    createdAt: now,
    updatedAt: now,
    status: 'open',
    offset: 0,
    chunks: [],
    idempotency: new Map()
  };
  sessions.set(id, session);
  return session;
}

export function getSession(id: string): UploadSession | undefined {
  purgeExpired();
  return sessions.get(id);
}

export function listSessionsForAccount(accountId: string): UploadSession[] {
  purgeExpired();
  return Array.from(sessions.values()).filter((s) => s.accountId === accountId);
}

export function cancelSession(id: string): boolean {
  const s = sessions.get(id);
  if (!s) return false;
  s.status = 'cancelled';
  s.updatedAt = Date.now();
  return true;
}

export function deleteSession(id: string): boolean {
  return sessions.delete(id);
}

export interface AppendChunkInput {
  sessionId: string;
  offset: number;
  data: Buffer;
  webhookUrl: string;
  chunkIndex: number;
  idempotencyKey: string;
}

export interface AppendChunkResult {
  status: 'appended' | 'duplicate' | 'rejected';
  session: UploadSession;
  discordAttachment?: DiscordAttachment;
  rateLimitRemaining?: number;
  rateLimitResetAfter?: number;
}

export async function appendChunk(input: AppendChunkInput): Promise<AppendChunkResult> {
  const session = sessions.get(input.sessionId);
  if (!session) {
    throw new Error('Session not found');
  }
  if (session.status !== 'open') {
    throw new Error(`Session is ${session.status}, cannot append`);
  }

  if (input.idempotencyKey && session.idempotency.has(input.idempotencyKey)) {
    const cached = session.idempotency.get(input.idempotencyKey)!;
    return {
      status: 'duplicate',
      session,
      discordAttachment: (cached.body as { attachment?: DiscordAttachment })?.attachment,
      rateLimitRemaining: session.rateLimitRemaining,
      rateLimitResetAfter: session.rateLimitResetAfter
    };
  }

  if (input.offset !== session.offset) {
    throw new Error(
      `Offset mismatch: expected ${session.offset}, got ${input.offset}. ` +
        `Use HEAD to discover the correct offset.`
    );
  }

  let attachment: DiscordAttachment;
  try {
    const partFileName = `${session.filename}.part${input.chunkIndex}`;
    attachment = await uploadChunk(input.webhookUrl, input.data, partFileName);
  } catch (err) {
    session.lastError = err instanceof Error ? err.message : String(err);
    session.updatedAt = Date.now();
    throw err;
  }

  const sha256 = createHash('sha256').update(input.data).digest('hex');

  const chunkRecord = {
    index: input.chunkIndex,
    offset: input.offset,
    size: input.data.length,
    url: attachment.url,
    discordMessageId: attachment.id,
    sha256
  };
  session.chunks.push(chunkRecord);
  session.offset += input.data.length;
  session.updatedAt = Date.now();

  if (input.idempotencyKey) {
    session.idempotency.set(input.idempotencyKey, {
      status: 200,
      body: { attachment }
    });
  }

  return {
    status: 'appended',
    session,
    discordAttachment: attachment,
    rateLimitRemaining: session.rateLimitRemaining,
    rateLimitResetAfter: session.rateLimitResetAfter
  };
}

export function updateRateLimit(
  sessionId: string,
  remaining: number | undefined,
  resetAfter: number | undefined
): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  if (remaining !== undefined) session.rateLimitRemaining = remaining;
  if (resetAfter !== undefined) session.rateLimitResetAfter = resetAfter;
}

export function markComplete(sessionId: string): UploadSession | undefined {
  const session = sessions.get(sessionId);
  if (!session) return undefined;
  if (session.offset !== session.totalSize) {
    throw new Error(
      `Cannot complete: session.offset (${session.offset}) != totalSize (${session.totalSize})`
    );
  }
  session.status = 'complete';
  session.updatedAt = Date.now();
  return session;
}

export function chunkIdempotencyKey(sessionId: string, offset: number, chunkIndex: number): string {
  return createHash('sha256')
    .update(`${sessionId}:${offset}:${chunkIndex}`)
    .digest('hex');
}

export function sessionToResponse(s: UploadSession) {
  return {
    id: s.id,
    filename: s.filename,
    mimeType: s.mimeType,
    totalSize: s.totalSize,
    chunkSize: s.chunkSize,
    offset: s.offset,
    status: s.status,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    rateLimitRemaining: s.rateLimitRemaining,
    rateLimitResetAfter: s.rateLimitResetAfter,
    lastError: s.lastError,
    chunkCount: s.chunks.length
  };
}
