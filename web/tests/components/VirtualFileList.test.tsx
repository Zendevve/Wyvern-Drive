import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VirtualFileList } from '../../src/components/VirtualFileList';
import type { Node } from '../../src/api/fs';

function makeNode(id: string, overrides: Partial<Node> = {}): Node {
  return {
    id,
    account_id: 'test-account',
    name: `file-${id}.txt`,
    kind: 'file',
    size_bytes: 1024,
    mime_type: 'text/plain',
    parent_id: null,
    created_at: 1700000000,
    updated_at: 1700000000,
    ...overrides
  };
}

function makeNodes(count: number): Node[] {
  return Array.from({ length: count }, (_, i) => makeNode(`n${i}`));
}

function renderList(nodes: Node[], props: { onHover?: (n: Node) => void; onSelect?: (n: Node) => void } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <VirtualFileList
          nodes={nodes}
          selectedId={null}
          onSelect={props.onSelect ?? vi.fn()}
          onHover={props.onHover}
          rowHeight={40}
        />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('VirtualFileList', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get() {
        return 400;
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders only the visible window of rows for large lists', () => {
    const nodes = makeNodes(2000);
    const { container } = renderList(nodes);
    const renderedRows = container.querySelectorAll('[role="row"]:not(.drive-list-head [role="row"])');
    const rows = Array.from(renderedRows).filter((el) => el.classList.contains('drive-list-row'));
    expect(nodes.length).toBe(2000);
    expect(rows.length).toBeLessThan(50);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('expands total height to fit all items', () => {
    const nodes = makeNodes(1000);
    const { container } = renderList(nodes);
    const spacer = container.querySelector('.drive-list-viewport > div') as HTMLElement;
    expect(spacer).toBeTruthy();
    expect(spacer.style.height).toBe(`${1000 * 40}px`);
  });

  it('renders small lists fully (no virtualization when count <= threshold)', () => {
    const nodes = makeNodes(10);
    const { container } = renderList(nodes);
    const rows = container.querySelectorAll('.drive-list-row');
    expect(rows.length).toBe(10);
  });

  it('calls onHover with the hovered node', () => {
    const nodes = makeNodes(5);
    const onHover = vi.fn();
    const { container } = renderList(nodes, { onHover });
    const firstRow = container.querySelector('.drive-list-row') as HTMLElement;
    expect(firstRow).toBeTruthy();
    fireEvent.mouseEnter(firstRow);
    expect(onHover).toHaveBeenCalledWith(nodes[0]);
  });

  it('updates visible window on scroll', async () => {
    const nodes = makeNodes(2000);
    const { container } = renderList(nodes);
    const viewport = container.querySelector('.drive-list-viewport') as HTMLElement;
    expect(viewport).toBeTruthy();
    await act(async () => {
      fireEvent.scroll(viewport, { target: { scrollTop: 2000 } });
    });
    const rows = container.querySelectorAll('.drive-list-row');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(100);
  });
});
