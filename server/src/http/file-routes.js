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

function contentDisposition(name) {
  const fallback = String(name).replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

async function sendFileStream(res, result) {
  res.status(200);
  res.setHeader('Content-Type', result.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', contentDisposition(result.name));
  res.setHeader('Content-Length', String(result.sizeBytes));
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
      const result = await fileService.downloadFile({ drive: req.drive, entryId });
      await sendFileStream(res, result);
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

module.exports = { createFileRoutes };
