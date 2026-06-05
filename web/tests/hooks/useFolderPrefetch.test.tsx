import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useFolderPrefetch } from '../../src/hooks/useFolderPrefetch';

const listChildrenMock = vi.fn();

vi.mock('../../src/api/fs', () => ({
  listChildren: (...args: unknown[]) => listChildrenMock(...args)
}));

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe('useFolderPrefetch', () => {
  beforeEach(() => {
    listChildrenMock.mockReset();
    listChildrenMock.mockResolvedValue({ nodes: [] });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not call queryFn before debounce window elapses', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useFolderPrefetch(), { wrapper: makeWrapper(qc) });

    act(() => result.current.prefetch('folder-a'));
    expect(listChildrenMock).not.toHaveBeenCalled();
  });

  it('cancel() prevents any pending prefetch from firing', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useFolderPrefetch(), { wrapper: makeWrapper(qc) });

    act(() => result.current.prefetch('folder-b'));
    act(() => result.current.cancel());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(listChildrenMock).not.toHaveBeenCalled();
  });

  it('returns stable function references across renders', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result, rerender } = renderHook(() => useFolderPrefetch(), { wrapper: makeWrapper(qc) });
    const first = { prefetch: result.current.prefetch, cancel: result.current.cancel };
    rerender();
    expect(result.current.prefetch).toBe(first.prefetch);
    expect(result.current.cancel).toBe(first.cancel);
  });
});
