import { recordAuditEvent, type AuditEvent } from './audit';
import type { AuditAction, AuditOutcome } from './auditActions';

export { recordAuditEvent };

export function newCorrelationId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `cor-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface AuditContext {
  correlationId: string;
  targetId?: string | null;
  targetType?: string | null;
  metadata?: Record<string, unknown>;
}

export interface WithAuditOptions {
  action: AuditAction;
  targetId?: string | null;
  targetType?: string | null;
  metadata?: () => Record<string, unknown>;
}

export async function withAudit<T>(
  ctx: AuditContext,
  options: WithAuditOptions,
  fn: (correlationId: string) => Promise<T>
): Promise<T> {
  const meta = options.metadata ? options.metadata() : ctx.metadata ?? {};
  await recordAuditEvent({
    action: options.action,
    target_id: options.targetId ?? ctx.targetId ?? null,
    target_type: options.targetType ?? ctx.targetType ?? null,
    outcome: 'success',
    correlation_id: ctx.correlationId,
    metadata: { phase: 'start', ...meta }
  });
  try {
    const result = await fn(ctx.correlationId);
    const endMeta = options.metadata ? options.metadata() : ctx.metadata ?? {};
    await recordAuditEvent({
      action: options.action,
      target_id: options.targetId ?? ctx.targetId ?? null,
      target_type: options.targetType ?? ctx.targetType ?? null,
      outcome: 'success',
      correlation_id: ctx.correlationId,
      metadata: { phase: 'end', ...endMeta }
    });
    return result;
  } catch (err) {
    const endMeta = options.metadata ? options.metadata() : ctx.metadata ?? {};
    const message = err instanceof Error ? err.message : String(err);
    await recordAuditEvent({
      action: options.action,
      target_id: options.targetId ?? ctx.targetId ?? null,
      target_type: options.targetType ?? ctx.targetType ?? null,
      outcome: 'error',
      correlation_id: ctx.correlationId,
      metadata: { phase: 'end', error: message, ...endMeta }
    });
    throw err;
  }
}

export type { AuditEvent, AuditAction, AuditOutcome };
