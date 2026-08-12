'use strict';

const STATUS_BY_CODE = {
  AUTH_REQUIRED: 401,
  FORBIDDEN: 403,
  CSRF_FAILED: 403,
  NOT_FOUND: 404,
  INVALID_NAME: 400,
  INVALID_PARENT: 400,
  NAME_CONFLICT: 409,
  INVALID_MOVE: 400,
  INVALID_WEBHOOK: 400,
  STORAGE_ALREADY_CONFIGURED: 409,
  STORAGE_MIGRATION_REQUIRED: 409,
  WEBHOOK_LIMIT: 409,
  WEBHOOK_IN_USE: 409,
  QUOTA_EXCEEDED: 413,
  UPLOAD_FAILED: 500,
  STORAGE_UNAVAILABLE: 502,
  CHECKSUM_MISMATCH: 502,
  SHARE_NOT_FOUND: 404,
  RATE_LIMITED: 429,
  // Auxiliary codes for client/server errors outside the enumerated set.
  BAD_REQUEST: 400,
  INVALID_DATE: 400,
  INTERNAL: 500,
};

const DEFAULT_MESSAGES = {
  AUTH_REQUIRED: 'Authentication required',
  FORBIDDEN: 'Forbidden',
  CSRF_FAILED: 'CSRF validation failed',
  NOT_FOUND: 'Not found',
  INVALID_NAME: 'Invalid name',
  INVALID_PARENT: 'Invalid parent',
  NAME_CONFLICT: 'A folder or file with this name already exists',
  INVALID_MOVE: 'Cannot move an entry into itself or one of its descendants',
  INVALID_WEBHOOK: 'Invalid Discord webhook URL',
  STORAGE_ALREADY_CONFIGURED: 'Storage is already configured for this drive',
  STORAGE_MIGRATION_REQUIRED: 'This drive was created with the legacy bot storage and must be migrated by the operator',
  WEBHOOK_LIMIT: 'Webhook limit reached for this drive',
  WEBHOOK_IN_USE: 'Webhook is in use by stored content',
  QUOTA_EXCEEDED: 'Quota exceeded',
  UPLOAD_FAILED: 'Upload failed',
  STORAGE_UNAVAILABLE: 'Storage backend unavailable',
  CHECKSUM_MISMATCH: 'Checksum mismatch',
  SHARE_NOT_FOUND: 'Share not found or expired',
  RATE_LIMITED: 'Too many requests',
  BAD_REQUEST: 'Bad request',
  INVALID_DATE: 'Invalid expiration date',
  INTERNAL: 'Internal server error',
};

class WyvernError extends Error {
  constructor(code, message, status) {
    super(message || DEFAULT_MESSAGES[code] || 'Error');
    this.name = 'WyvernError';
    this.code = code;
    this.status = status || STATUS_BY_CODE[code] || 500;
  }
}

/** Convenience factory: httpError('NOT_FOUND') or httpError('NAME_CONFLICT', 'custom message'). */
function httpError(code, message, status) {
  return new WyvernError(code, message, status);
}

/**
 * Convert any thrown value into a stable JSON error body plus status.
 * Body shape is always { error: { code, message } }; stack traces are never
 * included.
 */
function toErrorBody(err) {
  if (err instanceof WyvernError) {
    return { status: err.status, body: { error: { code: err.code, message: err.message } } };
  }
  // express.json / cookie-parser style parse failures carry err.status/err.type.
  if (err && typeof err === 'object' && typeof err.type === 'string' && err.type.startsWith('entity.')) {
    const status = err.status === 413 ? 413 : 400;
    return { status, body: { error: { code: 'BAD_REQUEST', message: 'Malformed request body' } } };
  }
  if (err && typeof err === 'object' && err.status >= 400 && err.status < 500) {
    return { status: err.status, body: { error: { code: 'BAD_REQUEST', message: 'Bad request' } } };
  }
  // Plain errors that carry a known code (e.g. adapters setting err.code).
  if (err && typeof err === 'object' && typeof err.code === 'string' && STATUS_BY_CODE[err.code]) {
    const status = STATUS_BY_CODE[err.code];
    return { status, body: { error: { code: err.code, message: err.message || DEFAULT_MESSAGES[err.code] } } };
  }
  return { status: 500, body: { error: { code: 'INTERNAL', message: DEFAULT_MESSAGES.INTERNAL } } };
}

module.exports = {
  WyvernError,
  httpError,
  toErrorBody,
  STATUS_BY_CODE,
  DEFAULT_MESSAGES,
};
