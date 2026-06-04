import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../src/lib/api';
import { getNode, listChildren } from '../../src/api/fs';

function mockFetchOnce(body: unknown, init: { status?: number; ok?: boolean; contentType?: string } = {}) {
  const status = init.status ?? 200;
  const ok = init.ok ?? (status >= 200 && status < 300);
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    text: () => Promise.resolve(text),
    headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? (init.contentType ?? 'application/json') : null) }
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('listChildren', () => {
  it('calls /api/fs/list with no query string for root', async () => {
    const fetchMock = mockFetchOnce({ items: [] });
    const result = await listChildren(null);
    expect(result).toEqual({ items: [] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/fs/list');
  });

  it('encodes the parent_id in the query string', async () => {
    const fetchMock = mockFetchOnce({ items: [{ id: 'a' }] });
    const result = await listChildren('folder/with special&chars');
    expect(result.items[0].id).toBe('a');
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/fs/list?parent_id=folder%2Fwith%20special%26chars');
  });
});

describe('getNode', () => {
  it('calls /api/fs/node with the id query', async () => {
    const fetchMock = mockFetchOnce({ node: { id: 'abc', kind: 'file' }, chunks: [] });
    const result = await getNode('abc');
    expect(result.node.id).toBe('abc');
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/fs/node?id=abc');
  });
});

describe('error handling', () => {
  it('throws ApiError with status + body on non-2xx JSON response', async () => {
    mockFetchOnce({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404, ok: false });
    let caught: unknown;
    try {
      await getNode('missing');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ApiError);
    const apiErr = caught as ApiError;
    expect(apiErr.status).toBe(404);
    expect((apiErr.body as { code: string }).code).toBe('NOT_FOUND');
    expect(apiErr.message).toContain('404');
  });

  it('parses text bodies that are not JSON', async () => {
    mockFetchOnce('plain text error', { status: 500, ok: false, contentType: 'text/plain' });
    let caught: unknown;
    try {
      await getNode('x');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ApiError);
    const apiErr = caught as ApiError;
    expect(apiErr.status).toBe(500);
    expect(apiErr.body).toBe('plain text error');
  });
});
