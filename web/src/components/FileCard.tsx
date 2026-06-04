import { useNavigate } from 'react-router-dom';
import type { Node } from '../api/fs';
import { formatBytes, getFileIcon } from './icons';

interface FileCardProps {
  node: Node;
  selected: boolean;
  onSelect: (node: Node) => void;
}

export function FileCard({ node, selected, onSelect }: FileCardProps) {
  const navigate = useNavigate();
  const Icon = getFileIcon(node);

  function handleClick() {
    onSelect(node);
    if (node.kind === 'folder') {
      navigate(`/drive/${node.id}`);
    }
  }

  return (
    <button
      type="button"
      className={`file-card${selected ? ' is-selected' : ''}`}
      onClick={handleClick}
      aria-pressed={selected}
    >
      <div className="file-card-icon">
        <Icon width={20} height={20} />
      </div>
      <div className="file-card-name" title={node.name}>{node.name}</div>
      <div className="file-card-meta">
        {node.kind === 'folder' ? 'Folder' : formatBytes(node.size_bytes)}
      </div>
    </button>
  );
}
