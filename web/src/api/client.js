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
 */
export function uploadFile({ parentId, file, onProgress }) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('parentId', parentId == null ? '' : String(parentId));
    formData.append('file', file, file.name);

    const xhr = new XMLHttpRequest();
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
}

export function downloadUrl(entryId) {
  return `/api/files/${entryId}/download`;
}

export function shareDownloadUrl(token) {
  return `/s/${token}`;
}

export const api = {
  me: () => apiFetch('/api/auth/me'),
  drive: () => apiFetch('/api/drive'),
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
