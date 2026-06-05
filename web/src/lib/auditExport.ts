import { AUDIT_ACTION_LABELS, type AuditAction } from './auditActions';
import type { AuditEvent } from './audit';

const CSV_HEADERS = [
  'id',
  'action',
  'action_label',
  'outcome',
  'target_id',
  'target_type',
  'correlation_id',
  'created_at',
  'created_at_iso',
  'metadata_json'
] as const;

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

function actionLabel(action: AuditAction): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

export function auditEventsToJSON(events: AuditEvent[]): string {
  return JSON.stringify(
    events.map((e) => ({
      ...e,
      created_at_iso: new Date(e.created_at).toISOString()
    })),
    null,
    2
  );
}

export function auditEventsToCSV(events: AuditEvent[]): string {
  const rows: string[] = [];
  rows.push(CSV_HEADERS.join(','));
  for (const e of events) {
    const row = [
      e.id,
      e.action,
      actionLabel(e.action),
      e.outcome,
      e.target_id ?? '',
      e.target_type ?? '',
      e.correlation_id,
      String(e.created_at),
      new Date(e.created_at).toISOString(),
      JSON.stringify(e.metadata ?? {})
    ];
    rows.push(row.map((v) => escapeCsv(String(v))).join(','));
  }
  return rows.join('\n');
}

export function downloadAuditExport(events: AuditEvent[], format: 'json' | 'csv'): void {
  const content = format === 'json' ? auditEventsToJSON(events) : auditEventsToCSV(events);
  const mime = format === 'json' ? 'application/json' : 'text/csv';
  const filename = `wyvern-audit-${new Date().toISOString().replace(/[:.]/g, '-')}.${format}`;
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
