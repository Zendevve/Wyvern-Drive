import { useEffect, useState } from 'react';
import { Breadcrumb, type Crumb } from '../components/Breadcrumb';
import { FileCard } from '../components/FileCard';
import { FileList } from '../components/FileList';
import { Button } from '../components/Button';
import { getNode, type Node } from '../api/fs';
import { useFolder } from '../hooks/useFolder';
import { useSelectionStore } from '../store/selection';
import { Folder } from '../components/icons';

interface DrivePageProps {
  parentId: string | null;
}

type View = 'grid' | 'list';

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
  const chain = useBreadcrumbChain(parentId);
  const [view, setView] = useState<View>('grid');
  const headerTitle = chain[chain.length - 1]?.name ?? 'My Drive';

  useEffect(() => {
    clearSelection();
  }, [parentId, clearSelection]);

  function handleSelect(node: Node) {
    setSelected(node.id);
  }

  return (
    <>
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
          <p>Drop files anywhere in this area to upload.</p>
        </div>
      ) : view === 'grid' ? (
        <div className="drive-grid">
          {data?.items.map((node) => (
            <FileCard
              key={node.id}
              node={node}
              selected={node.id === selectedId}
              onSelect={handleSelect}
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
    </>
  );
}
