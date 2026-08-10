import { ApiError, apiFetch, uploadFile } from './client';

describe('api client', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    document.cookie = '';
    delete global.fetch;
    delete global.XMLHttpRequest;
  });

  it('injects credentials and the CSRF token on mutating requests', async () => {
    document.cookie = 'wyvern_csrf=csrf-token-123';
    global.fetch = jest
      .fn()
      .mockResolvedValue({ status: 200, ok: true, text: async () => '{"ok":true}' });

    await apiFetch('/api/folders', {
      method: 'POST',
      body: JSON.stringify({ parentId: null, name: 'docs' }),
    });

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('/api/folders');
    expect(init.credentials).toBe('include');
    expect(init.headers['X-CSRF-Token']).toBe('csrf-token-123');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('does not attach a CSRF header to GET requests', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ status: 200, ok: true, text: async () => '{}' });

    await apiFetch('/api/auth/me');

    const [, init] = fetch.mock.calls[0];
    expect(init.headers['X-CSRF-Token']).toBeUndefined();
  });

  it('parses server error bodies into ApiError', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 409,
      ok: false,
      text: async () =>
        JSON.stringify({
          error: { code: 'NAME_CONFLICT', message: 'A file with that name already exists' },
        }),
    });

    const err = await apiFetch('/api/entries/1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'x' }),
    }).catch((e) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(409);
    expect(err.code).toBe('NAME_CONFLICT');
    expect(err.message).toContain('already exists');
  });

  it('returns null for 204 responses', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ status: 204, ok: true, text: async () => '' });

    const result = await apiFetch('/api/auth/logout', { method: 'POST' });
    expect(result).toBeNull();
  });

  it('uploads via XMLHttpRequest and reports progress', async () => {
    class FakeXHR {
      constructor() {
        this.upload = {};
      }
      open() {}
      setRequestHeader() {}
      send() {
        this.upload.onprogress({
          lengthComputable: true,
          loaded: 50,
          total: 100,
        });
        this.status = 201;
        this.responseText = JSON.stringify({ id: 7, name: 'a.txt' });
        this.onload();
      }
    }
    global.XMLHttpRequest = FakeXHR;
    document.cookie = 'wyvern_csrf=c2';

    const onProgress = jest.fn();
    const entry = await uploadFile({
      parentId: null,
      file: new File(['hello world'], 'a.txt', { type: 'text/plain' }),
      onProgress,
    });

    expect(entry.id).toBe(7);
    expect(onProgress).toHaveBeenCalledWith(50, 100);
  });

  it('rejects uploads with a parsed ApiError on failure', async () => {
    class FakeXHR {
      constructor() {
        this.upload = {};
      }
      open() {}
      setRequestHeader() {}
      send() {
        this.status = 502;
        this.responseText = JSON.stringify({
          error: { code: 'STORAGE_UNAVAILABLE', message: 'Discord is unreachable' },
        });
        this.onload();
      }
    }
    global.XMLHttpRequest = FakeXHR;

    const err = await uploadFile({
      parentId: null,
      file: new File(['hello'], 'a.txt', { type: 'text/plain' }),
    }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(502);
    expect(err.code).toBe('STORAGE_UNAVAILABLE');
  });
});
