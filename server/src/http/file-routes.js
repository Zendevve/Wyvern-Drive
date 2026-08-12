'use strict';

const express = require('express');
const busboy = require('busboy');
const { WyvernError, httpError } = require('../errors');
const { asyncHandler, requireSession, loadDrive, csrfProtect } = require('./middleware');

function parseParentId(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isInteger(n)) throw httpError('INVALID_PARENT');
  return n;
}

function contentDisposition(name, { inline = false } = {}) {
  const fallback = String(name).replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const disposition = inline ? 'inline' : 'attachment';
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/**
 * Parse a single `Range: bytes=…` request header. Supports `a-b`, `a-` and
 * `-n` forms, clamped to the file size. Returns null (caller serves 200 full)
 * for malformed, multi-range, or unsatisfiable ranges.
 */
function parseRange(raw, size) {
  if (typeof raw !== 'string' || !/^bytes=/i.test(raw)) return null;
  const spec = raw.slice(6).trim();
  if (spec.includes(',')) return null; // multi-range: unsupported
  const m = /^(\d*)-(\d*)$/.exec(spec);
  if (!m) return null;
  let start;
  let end;
  if (m[1] === '') {
    if (m[2] === '') return null;
    const n = Number(m[2]);
    if (!Number.isInteger(n) || n <= 0) return null;
    start = Math.max(size - n, 0);
    end = size - 1;
  } else {
    start = Number(m[1]);
    if (!Number.isInteger(start) || start < 0) return null;
    if (m[2] === '') {
      end = size - 1;
    } else {
      end = Number(m[2]);
      if (!Number.isInteger(end) || end < start) return null;
    }
  }
  if (start >= size) return null; // unsatisfiable: serve the full body
  end = Math.min(end, size - 1);
  if (start > end) return null;
  return { start, end };
}

/** Multipart `fileSize` field: invalid numbers are ignored (treated as absent). */
function parseFileSize(raw) {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) return undefined;
  return n;
}

async function sendFileStream(res, result, { inline = false } = {}) {
  res.status(result.status === 206 ? 206 : 200);
  res.setHeader('Content-Type', result.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', contentDisposition(result.name, { inline }));
  if (result.status === 206) {
    res.setHeader('Content-Range', `bytes ${result.start}-${result.end}/${result.sizeBytes}`);
    res.setHeader('Content-Length', String(result.contentLength));
  } else {
    res.setHeader('Content-Length', String(result.sizeBytes));
  }
  for await (const buf of result.stream()) {
    res.write(buf);
  }
  res.end();
}

function createFileRoutes({ config, repositories, sessionStore, fileService }) {
  const router = express.Router();
  const auth = [requireSession(sessionStore), loadDrive(repositories)];

  router.post(
    '/upload',
    csrfProtect(config),
    auth,
    asyncHandler(async (req, res) => {
      const contentType = req.headers['content-type'] || '';
      if (!contentType.includes('multipart/form-data')) {
        throw new WyvernError('UPLOAD_FAILED', 'Expected multipart/form-data', 400);
      }

      const outcome = await new Promise((resolve, reject) => {
        const bb = busboy({ headers: req.headers, limits: { files: 1 } });
        let parentId = '';
        let uploadToken = '';
        let fileSize = '';
        let uploadPromise = null;
        let settled = false;
        const settle = (value, isError) => {
          if (settled) return;
          settled = true;
          try {
            req.unpipe(bb);
          } catch {
            /* noop */
          }
          bb.destroy();
          if (isError) reject(value);
          else resolve(value);
        };

        bb.on('field', (name, value) => {
          if (name === 'parentId') parentId = value;
          else if (name === 'uploadToken') uploadToken = value;
          else if (name === 'fileSize') fileSize = value;
        });
        bb.on('file', (name, file, info) => {
          if (name !== 'file') {
            file.resume();
            return;
          }
          uploadPromise = Promise.resolve()
            .then(() =>
              fileService.uploadFile({
                drive: req.drive,
                parentId: parseParentId(parentId),
                fileStream: file,
                filename: info.filename,
                mimeType: info.mimeType,
                uploadToken: uploadToken === '' ? undefined : uploadToken,
                expectedSizeBytes: parseFileSize(fileSize),
              })
            )
            .then((entry) => settle({ entry }, false))
            .catch((err) => settle(err, true));
        });
        bb.on('close', () => {
          if (!uploadPromise) settle({ entry: null }, false);
        });
        bb.on('error', (err) => settle(err, true));
        bb.on('filesLimit', () => {});
        req.pipe(bb);
      });

      if (!outcome.entry) {
        throw new WyvernError('UPLOAD_FAILED', 'No file part in upload request', 400);
      }
      res.status(201).json(outcome.entry);
    })
  );

  router.get(
    '/:id/download',
    auth,
    asyncHandler(async (req, res) => {
      const entryId = Number(req.params.id);
      if (!Number.isInteger(entryId)) throw httpError('NOT_FOUND');
      res.setHeader('Accept-Ranges', 'bytes');

      // Full download first so sizeBytes can clamp any requested range.
      const full = await fileService.downloadFile({ drive: req.drive, entryId, range: null });
      const range = parseRange(req.headers.range, full.sizeBytes);
      const result = range
        ? await fileService.downloadFile({ drive: req.drive, entryId, range })
        : full;

      await sendFileStream(res, result, { inline: req.query.inline === '1' });
    })
  );

  router.post(
    '/:id/share',
    csrfProtect(config),
    auth,
    asyncHandler(async (req, res) => {
      const entryId = Number(req.params.id);
      if (!Number.isInteger(entryId)) throw httpError('NOT_FOUND');
      const body = req.body || {};
      const share = await fileService.createShare({
        drive: req.drive,
        entryId,
        expiresAt: body.expiresAt === undefined ? null : body.expiresAt,
      });
      res.status(201).json(share);
    })
  );

  router.get(
    '/:id/shares',
    auth,
    asyncHandler(async (req, res) => {
      const entryId = Number(req.params.id);
      if (!Number.isInteger(entryId)) throw httpError('NOT_FOUND');
      const shares = await fileService.listShares({ drive: req.drive, entryId });
      res.json({ shares });
    })
  );

  return router;
}

/**
 * GET /api/uploads/:uploadToken — resume/progress lookup for a client-generated
 * upload token. Lives in its own factory because file-routes is mounted at
 * /api/files and cannot express the /api/uploads/:uploadToken path; app.js
 * mounts this router at /api/uploads.
 */
function createUploadRoutes({ repositories, sessionStore, fileService }) {
  const router = express.Router();
  const auth = [requireSession(sessionStore), loadDrive(repositories)];

  router.get(
    '/:uploadToken',
    auth,
    asyncHandler(async (req, res) => {
      const progress = await fileService.getUploadProgressByToken({
        drive: req.drive,
        uploadToken: req.params.uploadToken,
      });
      res.json(progress);
    })
  );

  return router;
}

module.exports = { createFileRoutes, createUploadRoutes };
