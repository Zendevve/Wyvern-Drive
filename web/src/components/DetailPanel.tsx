import type { Node } from '../api/fs';
import { useNode } from '../hooks/useFolder';
import { formatBytes, formatTimestamp } from './icons';

interface DetailPanelProps {
  node: Node | null;
  onDelete: (node: Node) => void;
}

export function DetailPanel({ node, onDelete }: DetailPanelProps) {
  if (!node) return null;
  const isFile = node.kind === 'file';
  const { data } = useNode(isFile ? node.id : null);
  const cdnUrl = data?.chunks?.[0]?.cdn_url;

  return (
    <aside className="detail-panel" aria-label="Details">
      <header className="detail-panel-head">
        <h3>Details</h3>
      </header>
      <dl className="detail-panel-list">
        <div>
          <dt>Name</dt>
          <dd className="detail-name">{node.name}</dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{node.kind === 'folder' ? 'Folder' : (node.mime_type || 'File')}</dd>
        </div>
        <div>
          <dt>Size</dt>
          <dd className="mono">{node.kind === 'folder' ? '—' : formatBytes(node.size_bytes)}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{formatTimestamp(node.created_at)}</dd>
        </div>
        <div>
          <dt>Modified</dt>
          <dd>{formatTimestamp(node.updated_at)}</dd>
        </div>
        {cdnUrl ? (
          <div>
            <dt>CDN URL</dt>
            <dd className="mono detail-cdn">{cdnUrl}</dd>
          </div>
        ) : null}
      </dl>
      <div className="detail-panel-actions">
        <button
          type="button"
          className="btn btn-destructive"
          onClick={() => onDelete(node)}
        >
          Delete
        </button>
      </div>
    </aside>
  );
}
