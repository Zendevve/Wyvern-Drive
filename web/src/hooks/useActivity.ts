import { useQuery } from '@tanstack/react-query';
import { listAuditEvents, type AuditEvent, type AuditFilter } from '../lib/audit';
import type { AuditAction } from '../lib/auditActions';

const PRESETS: Record<string, number | undefined> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  all: undefined
};

export type TimeRange = keyof typeof PRESETS;

export const TIME_RANGE_OPTIONS: TimeRange[] = ['24h', '7d', '30d', 'all'];

export function sinceMsFor(range: TimeRange): number | undefined {
  const delta = PRESETS[range];
  if (delta === undefined) return undefined;
  return Date.now() - delta;
}

export function useActivity(
  range: TimeRange,
  selectedActions: AuditAction[],
  limit: number = 100
) {
  const filter: AuditFilter = {
    actions: selectedActions.length > 0 ? selectedActions : undefined,
    sinceMs: sinceMsFor(range),
    limit
  };
  return useQuery<AuditEvent[]>({
    queryKey: ['activity', range, [...selectedActions].sort(), limit],
    queryFn: () => listAuditEvents(filter),
    refetchOnWindowFocus: false,
    staleTime: 5_000
  });
}
