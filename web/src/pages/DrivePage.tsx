import { useEffect, useRef, useState } from 'react';
import { Breadcrumb, type Crumb } from '../components/Breadcrumb';
import { FileCard } from '../components/FileCard';
import { FileList } from '../components/FileList';
import { DropZone } from '../components/DropZone';
import { Modal } from '../components/Modal';
import { DetailPanel } from '../components/DetailPanel';
import { Button } from '../components/Button';
import { getNode, type Node } from '../api/fs';
import { deleteNode } from '../api/delete';
import { useFolder } from '../hooks/useFolder';
import { useUploader } from '../hooks/useUploader';
import { useSelectionStore } from '../store/selection';
import { useToastsStore } from '../store/toasts';
import { Folder } from '../components/icons';

interface DrivePageProps {
  parentId: string | null;
}

type View = 'grid' | 'list';

interface ContextMenuState {
  node: Node;
  x: number;
  y: number;
}

function useBreadcrumbChain(folderId: string | null): Crumb[] {
  const [chain, setChain] = useState<Crumb[]>([{ id: null, name: 'My Drive' }]);

  useEffect(() => {
    let cancelled = false;
    if (!folderId) {
      setChain([{ id: null, name: 'My Drive' }]);
      return () => {
        cancelled = true;
      };
    }
    async function build() {
      const acc: Crumb[] = [{ id: null, name: 'My Drive' }];
      let currentId: string | null = folderId;
      let safety = 0;
      while (currentId && safety++ < 50) {
        try {
          const { node } = await getNode(currentId);
          if (cancelled) return;
          if (!node) break;
          acc.splice(1, 0, { id: node.id, name: node.name });
          currentId = node.parent_id;
        } catch {
          break;
        }
      }
      if (!cancelled) setChain(acc);
    }
    void build();
    return () => {
      cancelled = true;
    };
  }, [folderId]);

  return chain;
}

export function DrivePage({ parentId }: DrivePageProps) {
  const { data, isLoading, error, refetch } = useFolder(parentId);
  const selectedId = useSelectionStore((s) => s.selectedId);
  const setSelected = useSelectionStore((s) => s.setSelected);
  const clearSelection = useSelectionStore((s) => s.clear);
  const pushToast = useToastsStore((s) => s.push);
  const chain = useBreadcrumbChain(parentId);
  const [view, setView] = useState<View>('grid');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Node | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploader = useUploader();
  const headerTitle = chain[chain.length - 1]?.name ?? 'My Drive';
  const selectedNode = data?.items.find((n) => n.id === selectedId) ?? null;

  useEffect(() => {
    clearSelection();
  }, [parentId, clearSelection]);

  useEffect(() => {
    function dismiss() {
      setContextMenu(null);
    }
    window.addEventListener('click', dismiss);
    return () => {
      window.removeEventListener('click', dismiss);
    };
  }, []);

  function handleSelect(node: Node) {
    setSelected(node.id);
  }

  function handleContextMenu(event: React.MouseEvent, node: Node) {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ node, x: event.clientX, y: event.clientY });
  }

  async function handleFiles(files: File[]) {
    try {
      await uploader.enqueueFiles(files, parentId);
    } catch (err) {
      pushToast({ kind: 'error', message: err instanceof Error ? err.message : 'Upload failed' });
    }
  }

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  function handleUploadChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (files && files.length > 0) {
      void handleFiles(Array.from(files));
    }
    event.target.value = '';
  }

  function openDelete(node: Node) {
    setContextMenu(null);
    setPendingDelete(node);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    const name = pendingDelete.name;
    setPendingDelete(null);
    try {
      const result = await deleteNode(id);
      pushToast({
        kind: 'success',
        message: `Deleted ${name} (${result.deleted_nodes} item${result.deleted_nodes === 1 ? '' : 's'})`
      });
      clearSelection();
      void refetch();
    } catch (err) {
      pushToast({ kind: 'error', message: err instanceof Error ? err.message : 'Delete failed' });
    }
  }

  return (
    <DropZone onFiles={handleFiles}>
      <div className={`drive-page-wrap${selectedNode ? ' has-detail' : ''}`}>
        <header className="drive-header">
          <h1>{headerTitle}</h1>
          <Breadcrumb chain={chain} />
          <div className="drive-header-spacer" />
          <div className="drive-view-toggle" role="group" aria-label="View mode">
            <button
              type="button"
              className={view === 'grid' ? 'is-active' : ''}
              onClick={() => setView('grid')}
              aria-pressed={view === 'grid'}
            >
              Grid
            </button>
            <button
              type="button"
              className={view === 'list' ? 'is-active' : ''}
              onClick={() => setView('list')}
              aria-pressed={view === 'list'}
            >
              List
            </button>
          </div>
          <div className="drive-upload-button">
            <Button onClick={handleUploadClick}>Upload</Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={handleUploadChange}
              aria-label="Upload files"
            />
          </div>
        </header>

        {isLoading ? (
          <div className="drive-skeleton" aria-busy="true" aria-label="Loading folder">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="drive-skeleton-card" />
            ))}
          </div>
        ) : error ? (
          <div className="drive-error" role="alert">
            <p>Could not load this folder. {error.message}</p>
            <Button variant="secondary" onClick={() => refetch()}>Retry</Button>
          </div>
        ) : data && data.items.length === 0 ? (
          <div className="drive-empty">
            <Folder className="drive-empty-icon" width={64} height={64} />
            <h2>Nothing here yet</h2>
            <p>Drop files anywhere in this area or use the Upload button.</p>
          </div>
        ) : view === 'grid' ? (
          <div className="drive-grid">
            {data?.items.map((node) => (
              <ContextCard
                key={node.id}
                node={node}
                selected={node.id === selectedId}
                onSelect={handleSelect}
                onContextMenu={handleContextMenu}
              />
            ))}
          </div>
        ) : (
          <FileList
            nodes={data?.items ?? []}
            selectedId={selectedId}
            onSelect={handleSelect}
          />
        )}
      </div>

      {contextMenu ? (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="context-menu-item is-destructive"
            onClick={() => openDelete(contextMenu.node)}
          >
            Delete
          </button>
        </div>
      ) : null}

      <Modal
        open={Boolean(pendingDelete)}
        title="Delete item?"
        onClose={() => setPendingDelete(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => void confirmDelete()}>Delete</Button>
          </>
        }
      >
        {pendingDelete ? (
          <p>
            Are you sure you want to delete <strong>{pendingDelete.name}</strong>?
            {pendingDelete.kind === 'folder'
              ? ' All contents inside this folder will also be deleted.'
              : ''}
          </p>
        ) : null}
      </Modal>

      {selectedNode ? <DetailPanel node={selectedNode} onDelete={openDelete} /> : null}
    </DropZone>
  );
}

interface ContextCardProps {
  node: Node;
  selected: boolean;
  onSelect: (node: Node) => void;
  onContextMenu: (event: React.MouseEvent, node: Node) => void;
}

function ContextCard({ node, selected, onSelect, onContextMenu }: ContextCardProps) {
  return (
    <div onContextMenu={(e) => onContextMenu(e, node)}>
      <FileCard node={node} selected={selected} onSelect={onSelect} />
    </div>
  );
}
