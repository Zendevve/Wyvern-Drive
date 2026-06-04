import { useUploadsStore } from '../store/uploads';
import { formatBytes } from './icons';

export function UploadQueuePanel() {
  const items = useUploadsStore((s) => s.items);
  const remove = useUploadsStore((s) => s.remove);
  const clearFinished = useUploadsStore((s) => s.clearFinished);

  if (items.length === 0) return null;

  const active = items.filter((i) => i.status === 'queued' || i.status === 'uploading');
  const finished = items.filter((i) => i.status === 'done' || i.status === 'error' || i.status === 'cancelled');

  return (
    <aside className="upload-queue" aria-label="Upload queue">
      <header className="upload-queue-head">
        <strong>Uploads</strong>
        {finished.length > 0 ? (
          <button type="button" className="upload-queue-clear" onClick={clearFinished}>
            Clear finished
          </button>
        ) : null}
      </header>
      <ul className="upload-queue-list">
        {items.map((item) => (
          <li key={item.id} className={`upload-queue-item upload-status-${item.status}`}>
            <div className="upload-queue-meta">
              <span className="upload-queue-name" title={item.name}>{item.name}</span>
              <span className="upload-queue-size mono">{formatBytes(item.size)}</span>
            </div>
            <div className="upload-queue-bar" aria-hidden>
              <div
                className="upload-queue-fill"
                style={{ width: `${Math.max(0, Math.min(100, item.progress))}%` }}
              />
            </div>
            <div className="upload-queue-foot">
              <span className="upload-queue-status">{statusLabel(item)}</span>
              {active.find((a) => a.id === item.id) || item.status === 'error' || item.status === 'cancelled' ? (
                <button
                  type="button"
                  className="upload-queue-cancel"
                  onClick={() => remove(item.id)}
                  aria-label="Remove from list"
                >
                  Remove
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function statusLabel(item: { status: string; progress: number; error?: string }): string {
  switch (item.status) {
    case 'queued':
      return 'Queued…';
    case 'uploading':
      return `${item.progress}%`;
    case 'done':
      return 'Done';
    case 'error':
      return item.error || 'Failed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return item.status;
  }
}
