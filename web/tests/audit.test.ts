import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  recordAuditEvent,
  listAuditEvents,
  countAuditEvents,
  clearAuditEvents
} from '../src/lib/audit';
import { auditEventsToJSON, auditEventsToCSV, downloadAuditExport } from '../src/lib/auditExport';

describe('audit store', () => {
  beforeEach(async () => {
    await clearAuditEvents();
  });

  it('records an event with generated id and timestamp', async () => {
    const e = await recordAuditEvent({
      action: 'login',
      target_id: 'acct-1',
      target_type: 'account',
      outcome: 'success',
      correlation_id: 'cor-1',
      metadata: { foo: 'bar' }
    });
    expect(e.id).toBeTruthy();
    expect(e.created_at).toBeGreaterThan(0);
    expect(e.action).toBe('login');
  });

  it('lists events newest-first', async () => {
    const a = await recordAuditEvent({
      action: 'login',
      target_id: null,
      target_type: null,
      outcome: 'success',
      correlation_id: 'c1',
      metadata: {}
    });
    await new Promise((r) => setTimeout(r, 5));
    const b = await recordAuditEvent({
      action: 'logout',
      target_id: null,
      target_type: null,
      outcome: 'success',
      correlation_id: 'c2',
      metadata: {}
    });
    const list = await listAuditEvents();
    expect(list[0].id).toBe(b.id);
    expect(list[1].id).toBe(a.id);
  });

  it('filters by action and time range', async () => {
    const now = Date.now();
    await recordAuditEvent({
      action: 'login',
      target_id: null,
      target_type: null,
      outcome: 'success',
      correlation_id: 'c1',
      metadata: {}
    });
    await recordAuditEvent({
      action: 'delete',
      target_id: 'f1',
      target_type: 'file',
      outcome: 'error',
      correlation_id: 'c2',
      metadata: {}
    });
    const onlyDeletes = await listAuditEvents({ actions: ['delete'] });
    expect(onlyDeletes).toHaveLength(1);
    expect(onlyDeletes[0].action).toBe('delete');

    const future = await listAuditEvents({ sinceMs: now + 60_000 });
    expect(future).toHaveLength(0);
  });

  it('respects limit', async () => {
    for (let i = 0; i < 5; i++) {
      await recordAuditEvent({
        action: 'settings_change',
        target_id: null,
        target_type: 'settings',
        outcome: 'success',
        correlation_id: `c${i}`,
        metadata: { i }
      });
    }
    const list = await listAuditEvents({ limit: 2 });
    expect(list).toHaveLength(2);
  });

  it('counts events', async () => {
    expect(await countAuditEvents()).toBe(0);
    await recordAuditEvent({
      action: 'login',
      target_id: null,
      target_type: null,
      outcome: 'success',
      correlation_id: 'c1',
      metadata: {}
    });
    expect(await countAuditEvents()).toBe(1);
  });
});

describe('audit export', () => {
  it('JSON output is parseable and includes all fields', () => {
    const events = [
      {
        id: 'a',
        action: 'login' as const,
        target_id: null,
        target_type: null,
        outcome: 'success' as const,
        correlation_id: 'c',
        metadata: { k: 'v' },
        created_at: 1_700_000_000_000
      }
    ];
    const json = auditEventsToJSON(events);
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe('a');
    expect(parsed[0].created_at_iso).toBe(new Date(1_700_000_000_000).toISOString());
  });

  it('CSV output has header and one row per event', () => {
    const events = [
      {
        id: 'a',
        action: 'login' as const,
        target_id: null,
        target_type: null,
        outcome: 'success' as const,
        correlation_id: 'c',
        metadata: { k: 'v' },
        created_at: 1_700_000_000_000
      },
      {
        id: 'b',
        action: 'delete' as const,
        target_id: 'f1',
        target_type: 'file',
        outcome: 'error' as const,
        correlation_id: 'c2',
        metadata: { msg: 'boom' },
        created_at: 1_700_000_000_500
      }
    ];
    const csv = auditEventsToCSV(events);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0].startsWith('id,action,action_label,outcome')).toBe(true);
    expect(lines[1].split(',')[0]).toBe('a');
  });

  it('CSV escapes commas, quotes, and newlines in metadata', () => {
    const events = [
      {
        id: 'a',
        action: 'upload' as const,
        target_id: null,
        target_type: null,
        outcome: 'success' as const,
        correlation_id: 'c',
        metadata: { name: 'hello, "world"\nfoo' },
        created_at: 1
      }
    ];
    const csv = auditEventsToCSV(events);
    expect(csv).toMatch(/"\{""name"":""hello, \\""world\\""\\nfoo""\}/);
  });

  it('downloadAuditExport is callable in browser (skipped under jsdom)', () => {
    if (typeof URL.createObjectURL === 'undefined') return;
    expect(() => downloadAuditExport([], 'json')).not.toThrow();
  });
});
