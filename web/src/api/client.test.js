import { ApiError, apiFetch, api, uploadFile, uploadProgress, archiveUrl, downloadUrl, isPreviewableMime } from './client';

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

  it('configureWebhook posts the URL as JSON to /api/storage/webhook with CSRF', async () => {
    document.cookie = 'wyvern_csrf=csrf-token-456';
    global.fetch = jest
      .fn()
      .mockResolvedValue({ status: 201, ok: true, text: async () => '{"id":1,"quotaBytes":10,"usedBytes":0}' });

    const result = await api.configureWebhook('https://discord.com/api/webhooks/123/test-token');

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('/api/storage/webhook');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(init.headers['X-CSRF-Token']).toBe('csrf-token-456');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({
      webhookUrl: 'https://discord.com/api/webhooks/123/test-token',
    });
    expect(result.id).toBe(1);
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

  it('sends uploadToken and fileSize on uploads that provide them', async () => {
    let seen = null;
    class FakeXHR {
      constructor() {
        this.upload = {};
      }
      open() {}
      setRequestHeader() {}
      send(formData) {
        seen = formData;
        this.status = 201;
        this.responseText = JSON.stringify({ id: 8, name: 'a.txt' });
        this.onload();
      }
    }
    global.XMLHttpRequest = FakeXHR;

    const entry = await uploadFile({
      parentId: 3,
      file: new File(['hello world'], 'a.txt', { type: 'text/plain' }),
      uploadToken: 'tok-abc',
      fileSize: 11,
    });
    expect(entry.id).toBe(8);
    expect(seen.get('uploadToken')).toBe('tok-abc');
    expect(seen.get('fileSize')).toBe('11');
    expect(seen.get('parentId')).toBe('3');
  });

  it('exposes an abort handle that rejects the upload with ABORTED', async () => {
    class FakeXHR {
      constructor() {
        this.upload = {};
      }
      open() {}
      setRequestHeader() {}
      send() {
        // The browser drops the request when abort() is called.
        if (this.aborted) {
          this.onabort();
        }
      }
      abort() {
        this.aborted = true;
        this.onabort();
      }
    }
    global.XMLHttpRequest = FakeXHR;

    const upload = uploadFile({
      parentId: null,
      file: new File(['hello'], 'a.txt', { type: 'text/plain' }),
    });
    expect(typeof upload.abort).toBe('function');

    const errPromise = upload.catch((e) => e);
    upload.abort();
    const err = await errPromise;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
    expect(err.code).toBe('ABORTED');
    expect(err.message).toBe('Upload cancelled');
  });

  it('cancels an upload server-side and fetches drive stats', async () => {
    document.cookie = 'wyvern_csrf=csrf-token-abc';
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ status: 204, ok: true, text: async () => '' })
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        text: async () =>
          JSON.stringify({
            files: 2,
            folders: 1,
            sizeBytes: 102400,
            storedBytes: 400,
            blocks: 2,
            messages: 1,
            webhooks: 1,
            compressionRatio: 256,
          }),
      });

    const cancelResult = await api.uploadCancel('tok/with space');
    expect(fetch.mock.calls[0][0]).toBe(
      '/api/uploads/tok%2Fwith%20space/cancel'
    );
    expect(fetch.mock.calls[0][1].method).toBe('POST');
    expect(fetch.mock.calls[0][1].headers['X-CSRF-Token']).toBe('csrf-token-abc');
    expect(cancelResult).toBeNull();

    const stats = await api.driveStats();
    expect(fetch.mock.calls[1][0]).toBe('/api/drive/stats');
    expect(stats).toEqual({
      files: 2,
      folders: 1,
      sizeBytes: 102400,
      storedBytes: 400,
      blocks: 2,
      messages: 1,
      webhooks: 1,
      compressionRatio: 256,
    });
  });

  it('builds download and archive URLs for inline previews and folder zips', () => {
    expect(downloadUrl(7)).toBe('/api/files/7/download');
    expect(downloadUrl(7, { inline: true })).toBe(
      '/api/files/7/download?inline=1'
    );
    expect(archiveUrl(9)).toBe('/api/entries/9/archive');
  });

  it('queries upload progress by token', async () => {
    document.cookie = 'wyvern_csrf=csrf-token-789';
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      text: async () =>
        JSON.stringify({ status: 'ready', postedBytes: 24, expectedBytes: 24 }),
    });

    const progress = await uploadProgress('tok%20with%20space/and-slash');

    expect(fetch.mock.calls[0][0]).toBe(
      '/api/uploads/tok%2520with%2520space%2Fand-slash'
    );
    expect(progress).toEqual({ status: 'ready', postedBytes: 24, expectedBytes: 24 });
  });

  it('classifies previewable MIME types', () => {
    expect(isPreviewableMime('image/png')).toBe(true);
    expect(isPreviewableMime('video/mp4')).toBe(true);
    expect(isPreviewableMime('audio/ogg')).toBe(true);
    expect(isPreviewableMime('text/plain')).toBe(true);
    expect(isPreviewableMime('application/json')).toBe(true);
    expect(isPreviewableMime('application/pdf')).toBe(true);
    expect(isPreviewableMime('application/zip')).toBe(false);
    expect(isPreviewableMime('')).toBe(false);
    expect(isPreviewableMime(null)).toBe(false);
  });
});
