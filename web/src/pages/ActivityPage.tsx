import { useState, useMemo, useCallback } from 'react';
import { AUDIT_ACTION_LABELS, AUDIT_ACTIONS, type AuditAction } from '../lib/auditActions';
import { useActivity, TIME_RANGE_OPTIONS, type TimeRange } from '../hooks/useActivity';
import { downloadAuditExport } from '../lib/auditExport';

export function ActivityPage() {
  const [range, setRange] = useState<TimeRange>('7d');
  const [selected, setSelected] = useState<AuditAction[]>([]);
  const { data: events = [], isLoading, isError, error } = useActivity(range, selected, 100);

  const toggle = useCallback((action: AuditAction) => {
    setSelected((prev) =>
      prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action]
    );
  }, []);

  const clearFilters = useCallback(() => setSelected([]), []);

  const hasFilters = selected.length > 0;

  const handleExport = useCallback(
    (format: 'json' | 'csv') => {
      if (events.length === 0) return;
      downloadAuditExport(events, format);
    },
    [events]
  );

  const subtitle = useMemo(() => {
    if (isLoading) return 'Loading…';
    if (isError) return `Error: ${(error as Error)?.message ?? 'Unknown'}`;
    if (events.length === 0) return hasFilters ? 'No matching events' : 'No events yet';
    return `${events.length} event${events.length === 1 ? '' : 's'}`;
  }, [events.length, isLoading, isError, error, hasFilters]);

  return (
    <div className="activity-page">
      <header className="activity-header">
        <div>
          <h1 className="activity-title">Activity</h1>
          <p className="activity-subtitle">{subtitle}</p>
        </div>
        <div className="activity-export-group">
          <button
            type="button"
            className="activity-export-btn"
            onClick={() => handleExport('json')}
            disabled={events.length === 0}
            aria-label="Export activity as JSON"
          >
            Export JSON
          </button>
          <button
            type="button"
            className="activity-export-btn"
            onClick={() => handleExport('csv')}
            disabled={events.length === 0}
            aria-label="Export activity as CSV"
          >
            Export CSV
          </button>
        </div>
      </header>

      <div className="activity-filters" role="toolbar" aria-label="Activity filters">
        <div className="activity-range-group" role="group" aria-label="Time range">
          {TIME_RANGE_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              className={`activity-range-btn${r === range ? ' is-active' : ''}`}
              onClick={() => setRange(r)}
              aria-pressed={r === range}
            >
              {r === 'all' ? 'All time' : `Last ${r}`}
            </button>
          ))}
        </div>
        <div className="activity-action-group" role="group" aria-label="Action types">
          {AUDIT_ACTIONS.map((a) => (
            <button
              key={a}
              type="button"
              className={`activity-action-chip${selected.includes(a) ? ' is-active' : ''}`}
              onClick={() => toggle(a)}
              aria-pressed={selected.includes(a)}
            >
              {AUDIT_ACTION_LABELS[a]}
            </button>
          ))}
          {hasFilters && (
            <button
              type="button"
              className="activity-action-chip is-clear"
              onClick={clearFilters}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <ol className="activity-list" aria-label="Activity events">
        {events.map((e) => (
          <li key={e.id} className={`activity-item outcome-${e.outcome}`}>
            <div className="activity-item-main">
              <span className="activity-item-action">{AUDIT_ACTION_LABELS[e.action]}</span>
              <span className={`activity-item-outcome outcome-${e.outcome}`}>
                {e.outcome}
              </span>
            </div>
            <div className="activity-item-meta">
              <time dateTime={new Date(e.created_at).toISOString()} className="activity-item-time">
                {new Date(e.created_at).toLocaleString()}
              </time>
              {e.target_id && (
                <span className="activity-item-target" title={e.target_id}>
                  target: {e.target_id.slice(0, 12)}…
                </span>
              )}
              <span className="activity-item-correlation" title={e.correlation_id}>
                {e.correlation_id.slice(0, 8)}
              </span>
            </div>
            {Object.keys(e.metadata ?? {}).length > 0 && (
              <details className="activity-item-details">
                <summary>Details</summary>
                <pre className="activity-item-metadata">
                  {JSON.stringify(e.metadata, null, 2)}
                </pre>
              </details>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
