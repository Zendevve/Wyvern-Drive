/**
 * Wyvern Drive API client.
 *
 * All network calls in the web package go through this module. The browser
 * never talks to Discord directly: every request is same-origin and the
 * server holds all credentials.
 */

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function readCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/**
 * Cookie-authenticated fetch wrapper. Injects the readable CSRF cookie as
 * X-CSRF-Token on state-changing requests and parses the server's
 * { error: { code, message } } bodies into ApiError.
 */
export async function apiFetch(path, options = {}) {
  const { headers, ...rest } = options;
  const init = {
    credentials: 'include',
    ...rest,
    headers: { ...(headers || {}) },
  };
  if (
    init.body &&
    typeof init.body === 'string' &&
    !init.headers['Content-Type']
  ) {
    init.headers['Content-Type'] = 'application/json';
  }
  if (MUTATING_METHODS.has((init.method || 'GET').toUpperCase())) {
    const csrf = readCookie('wyvern_csrf');
    if (csrf) {
      init.headers['X-CSRF-Token'] = csrf;
    }
  }
  const response = await fetch(path, init);
  if (response.status === 204) {
    return null;
  }
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }
  if (!response.ok) {
    const err = (body && body.error) || {};
    throw new ApiError(
      response.status,
      err.code || 'UNKNOWN',
      err.message || `Request failed with status ${response.status}`
    );
  }
  return body;
}

/**
 * Upload a single file as multipart/form-data over XMLHttpRequest so the
 * browser can report upload progress. Resolves to the ready entry JSON.
 *
 * `uploadToken` (client-generated UUID) lets the server resume a previous
 * upload attempt; `fileSize` seeds the entry's expected size so the upload
 * queue can report post-upload server progress while chunks are stored.
 */
export function uploadFile({ parentId, file, uploadToken, fileSize, onProgress }) {
  let xhr = null;
  const promise = new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('parentId', parentId == null ? '' : String(parentId));
    formData.append('file', file, file.name);
    if (uploadToken) {
      formData.append('uploadToken', uploadToken);
    }
    if (fileSize != null) {
      formData.append('fileSize', String(fileSize));
    }

    xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/files/upload');
    xhr.withCredentials = true;
    const csrf = readCookie('wyvern_csrf');
    if (csrf) {
      xhr.setRequestHeader('X-CSRF-Token', csrf);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(event.loaded, event.total);
      }
    };
    // Aborting (the queue's Cancel control) settles the promise so the
    // caller's await never hangs on a request the browser has dropped.
    xhr.onabort = () =>
      reject(new ApiError(0, 'ABORTED', 'Upload cancelled'));
    xhr.onload = () => {
      let body = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body);
        return;
      }
      const err = (body && body.error) || {};
      reject(
        new ApiError(
          xhr.status,
          err.code || 'UNKNOWN',
          err.message || `Upload failed with status ${xhr.status}`
        )
      );
    };
    xhr.onerror = () =>
      reject(new ApiError(0, 'NETWORK_ERROR', 'Network error during upload'));
    xhr.send(formData);
  });
  promise.abort = () => {
    if (xhr) {
      xhr.abort();
    }
  };
  return promise;
}

export function downloadUrl(entryId, { inline } = {}) {
  return `/api/files/${entryId}/download${inline ? '?inline=1' : ''}`;
}

/** Server-side upload progress for a resume token ({ status, postedBytes, expectedBytes }). */
export function uploadProgress(uploadToken) {
  return apiFetch(`/api/uploads/${encodeURIComponent(uploadToken)}`);
}

/** Streaming ZIP of a folder (or single file) subtree. */
export function archiveUrl(entryId) {
  return `/api/entries/${entryId}/archive`;
}

/**
 * MIME types the preview dialog can render inline: image, video, audio,
 * plain text/JSON, and PDF.
 */
export function isPreviewableMime(mime) {
  if (!mime) {
    return false;
  }
  const type = String(mime).toLowerCase();
  return (
    type.startsWith('image/') ||
    type.startsWith('video/') ||
    type.startsWith('audio/') ||
    type.startsWith('text/') ||
    type === 'application/json' ||
    type === 'application/pdf'
  );
}

export function shareDownloadUrl(token) {
  return `/s/${token}`;
}

export const api = {
  setupStatus: () => apiFetch('/api/setup/status'),
  setupMeta: () => apiFetch('/api/setup/meta'),
  saveSetupCredentials: ({ clientId, clientSecret, appOrigin, setupToken } = {}) => {
    const body = {};
    if (clientId) body.clientId = clientId;
    if (clientSecret) body.clientSecret = clientSecret;
    if (appOrigin) body.appOrigin = appOrigin;
    const headers = {};
    if (setupToken) headers['X-Wyvern-Setup-Token'] = setupToken;
    return apiFetch('/api/setup/credentials', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  },
  me: () => apiFetch('/api/auth/me'),
  drive: () => apiFetch('/api/drive'),
  driveStats: () => apiFetch('/api/drive/stats'),
  uploadCancel: (uploadToken) =>
    apiFetch(`/api/uploads/${encodeURIComponent(uploadToken)}/cancel`, {
      method: 'POST',
    }),
  configureWebhook: (webhookUrl) =>
    apiFetch('/api/storage/webhook', {
      method: 'POST',
      body: JSON.stringify({ webhookUrl }),
    }),
  webhooks: {
    list: () => apiFetch('/api/storage/webhooks'),
    add: (webhookUrl) =>
      apiFetch('/api/storage/webhook', {
        method: 'POST',
        body: JSON.stringify({ webhookUrl }),
      }),
    remove: (id) =>
      apiFetch(`/api/storage/webhooks/${id}`, { method: 'DELETE' }),
  },
  trash: {
    list: () => apiFetch('/api/trash'),
    restore: (id) => apiFetch(`/api/trash/${id}/restore`, { method: 'POST' }),
    purge: (id) => apiFetch(`/api/trash/${id}`, { method: 'DELETE' }),
  },
  copyEntry: (id, parentId) =>
    apiFetch(`/api/entries/${id}/copy`, {
      method: 'POST',
      body: JSON.stringify({ parentId }),
    }),
  entries: (params = {}) => {
    const q = new URLSearchParams();
    if (params.parentId != null) {
      q.set('parentId', String(params.parentId));
    }
    if (params.query) {
      q.set('query', params.query);
    }
    q.set('kind', params.kind || 'all');
    q.set('sort', params.sort || 'name');
    q.set('direction', params.direction || 'asc');
    const qs = q.toString();
    return apiFetch(`/api/entries${qs ? `?${qs}` : ''}`);
  },
  createFolder: (parentId, name) =>
    apiFetch('/api/folders', {
      method: 'POST',
      body: JSON.stringify({ parentId, name }),
    }),
  updateEntry: (id, changes) =>
    apiFetch(`/api/entries/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(changes),
    }),
  deleteEntry: (id) =>
    apiFetch(`/api/entries/${id}`, { method: 'DELETE' }),
  createShare: (id, expiresAt) =>
    apiFetch(`/api/files/${id}/share`, {
      method: 'POST',
      body: JSON.stringify({ expiresAt: expiresAt || null }),
    }),
  listShares: (id) => apiFetch(`/api/files/${id}/shares`),
  revokeShare: (shareId) =>
    apiFetch(`/api/shares/${shareId}`, { method: 'DELETE' }),
  publicShare: (token) => apiFetch(`/api/shares/${token}`),
  logout: () => apiFetch('/api/auth/logout', { method: 'POST' }),
};
