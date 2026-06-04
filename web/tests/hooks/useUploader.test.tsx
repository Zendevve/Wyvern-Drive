import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUploader } from '../../src/hooks/useUploader';
import { useUploadsStore } from '../../src/store/uploads';

const apiFetchMock = vi.fn();
const uploadFileMock = vi.fn();

vi.mock('../../src/lib/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  ApiError: class ApiError extends Error {
    status: number;
    body: unknown;
    constructor(status: number, body: unknown, message?: string) {
      super(message ?? `Request failed with status ${status}`);
      this.status = status;
      this.body = body;
    }
  },
  setUnauthorizedHandler: vi.fn()
}));

vi.mock('../../src/api/upload', () => ({
  uploadFile: (...args: unknown[]) => uploadFileMock(...args),
  extractMessageIdFromUrl: (url: string) => {
    const match = url.match(/\/attachments\/\d+\/([a-zA-Z0-9_-]+)/);
    if (!match) throw new Error('Could not extract message ID');
    return match[1];
  }
}));

function makeFile(name: string): File {
  return new File([`content of ${name}`], name, { type: 'text/plain' });
}

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  useUploadsStore.setState({ items: [] });
  apiFetchMock.mockReset();
  uploadFileMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

function installUploadMock(urlFor: (name: string) => string): void {
  uploadFileMock.mockImplementation((file: File, onProgress?: (p: number) => void) => {
    const promise = (async () => {
      onProgress?.(50);
      await Promise.resolve();
      onProgress?.(100);
      return {
        filename: file.name,
        mimeType: file.type || 'text/plain',
        size: file.size,
        chunks: [{ index: 0, url: urlFor(file.name), size: file.size }]
      };
    })();
    return { promise, handle: { abort: vi.fn() } };
  });
}

describe('useUploader', () => {
  it('enqueues each file and records its chunks via /fs/file/created', async () => {
    installUploadMock((name) => `https://cdn.discordapp.com/attachments/123/msg-${name}/file.bin`);
    apiFetchMock.mockResolvedValue({ node_id: 'n1' });

    const { result } = renderHook(() => useUploader(), { wrapper: Wrapper });
    const files = ['a-txt', 'b-txt', 'c-txt'].map(makeFile);

    await act(async () => {
      await result.current.enqueueFiles(files, null);
    });

    expect(uploadFileMock).toHaveBeenCalledTimes(3);
    expect(apiFetchMock).toHaveBeenCalledTimes(3);
    expect(apiFetchMock.mock.calls[0][0]).toBe('/fs/file/created');
    const body = JSON.parse(apiFetchMock.mock.calls[0][1].body as string);
    expect(body.name).toBe('a-txt');
    expect(body.parent_id).toBeNull();
    expect(body.size_bytes).toBeGreaterThan(0);
    expect(body.mime_type).toBe('text/plain');
    expect(body.chunks).toEqual([
      {
        discordMessageId: 'msg-a-txt',
        index: 0,
        sizeBytes: body.size_bytes,
        cdnUrl: expect.stringContaining('msg-a-txt')
      }
    ]);
  });

  it('limits concurrency to 3 in-flight uploads', async () => {
    let active = 0;
    let peak = 0;
    uploadFileMock.mockImplementation((file: File) => {
      active += 1;
      peak = Math.max(peak, active);
      const promise = (async () => {
        await new Promise((resolve) => setTimeout(resolve, 12));
        active -= 1;
        return {
          filename: file.name,
          mimeType: 'text/plain',
          size: file.size,
          chunks: [{ index: 0, url: `https://cdn.discordapp.com/attachments/1/m-${file.name}/x`, size: file.size }]
        };
      })();
      return { promise, handle: { abort: vi.fn() } };
    });
    apiFetchMock.mockResolvedValue({ node_id: 'n' });

    const { result } = renderHook(() => useUploader(), { wrapper: Wrapper });
    const files = Array.from({ length: 6 }, (_, i) => makeFile(`f${i}.txt`));

    await act(async () => {
      await result.current.enqueueFiles(files, null);
    });

    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(1);
    expect(uploadFileMock).toHaveBeenCalledTimes(6);
  });

  it('marks uploads as errored when /upload rejects', async () => {
    uploadFileMock.mockImplementation(() => ({
      promise: Promise.reject(new Error('network down')),
      handle: { abort: vi.fn() }
    }));

    const { result } = renderHook(() => useUploader(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.enqueueFiles([makeFile('bad.txt')], null);
    });

    const items = useUploadsStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('error');
    expect(items[0].error).toContain('network down');
  });

  it('does not call /fs/file/created when /upload fails', async () => {
    uploadFileMock.mockImplementation(() => ({
      promise: Promise.reject(new Error('boom')),
      handle: { abort: vi.fn() }
    }));

    const { result } = renderHook(() => useUploader(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.enqueueFiles([makeFile('x.txt')], null);
    });
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it('marks uploads as done after both /upload and /fs/file/created succeed', async () => {
    installUploadMock((name) => `https://cdn.discordapp.com/attachments/1/msg-${name}/x`);
    apiFetchMock.mockResolvedValue({ node_id: 'n' });

    const { result } = renderHook(() => useUploader(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.enqueueFiles([makeFile('ok.txt')], null);
    });
    const items = useUploadsStore.getState().items;
    expect(items[0].status).toBe('done');
  });
});
