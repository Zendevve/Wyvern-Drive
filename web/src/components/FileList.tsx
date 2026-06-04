import { useNavigate } from 'react-router-dom';
import type { Node } from '../api/fs';
import { formatBytes, formatTimestamp, getFileIcon } from './icons';

interface FileListProps {
  nodes: Node[];
  selectedId: string | null;
  onSelect: (node: Node) => void;
}

export function FileList({ nodes, selectedId, onSelect }: FileListProps) {
  const navigate = useNavigate();

  function handleRowClick(node: Node) {
    onSelect(node);
    if (node.kind === 'folder') {
      navigate(`/drive/${node.id}`);
    }
  }

  return (
    <div className="drive-list" role="table" aria-label="Files and folders">
      <div className="drive-list-head" role="row">
        <div role="columnheader">Name</div>
        <div role="columnheader">Size</div>
        <div role="columnheader">Type</div>
        <div role="columnheader">Modified</div>
      </div>
      {nodes.map((node) => {
        const Icon = getFileIcon(node);
        return (
          <div
            key={node.id}
            role="row"
            className="drive-list-row"
            aria-selected={node.id === selectedId}
            onClick={() => handleRowClick(node)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleRowClick(node);
            }}
            tabIndex={0}
          >
            <div className="drive-list-name" role="cell">
              <Icon width={16} height={16} />
              <span className="drive-list-name-text" title={node.name}>{node.name}</span>
            </div>
            <div className="mono" role="cell">
              {node.kind === 'folder' ? '—' : formatBytes(node.size_bytes)}
            </div>
            <div role="cell">{node.kind === 'folder' ? 'Folder' : (node.mime_type || 'File')}</div>
            <div role="cell">{formatTimestamp(node.updated_at)}</div>
          </div>
        );
      })}
    </div>
  );
}
