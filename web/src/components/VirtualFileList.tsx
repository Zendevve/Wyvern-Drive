import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Node } from '../api/fs';
import { formatBytes, formatTimestamp, getFileIcon } from './icons';

interface VirtualFileListProps {
  nodes: Node[];
  selectedId: string | null;
  onSelect: (node: Node) => void;
  onHover?: (node: Node) => void;
  rowHeight?: number;
  overscan?: number;
}

export function VirtualFileList({
  nodes,
  selectedId,
  onSelect,
  onHover,
  rowHeight = 40,
  overscan = 6
}: VirtualFileListProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setViewportHeight(entry.contentRect.height);
      }
    });
    ro.observe(el);
    setViewportHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const onScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  const totalHeight = nodes.length * rowHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visibleCount = Math.ceil(viewportHeight / rowHeight) + overscan * 2;
  const endIndex = Math.min(nodes.length, startIndex + visibleCount);
  const offsetY = startIndex * rowHeight;

  const slice = useMemo(() => nodes.slice(startIndex, endIndex), [nodes, startIndex, endIndex]);

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
      <div
        ref={containerRef}
        className="drive-list-viewport"
        onScroll={onScroll}
        style={{ height: '100%', overflowY: 'auto' }}
        data-testid="virtual-file-list-viewport"
      >
        <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              transform: `translateY(${offsetY}px)`
            }}
          >
            {slice.map((node) => {
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
                  onMouseEnter={() => onHover?.(node)}
                  style={{ height: `${rowHeight}px` }}
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
        </div>
      </div>
    </div>
  );
}
