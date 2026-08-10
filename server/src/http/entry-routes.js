'use strict';

const express = require('express');
const { httpError } = require('../errors');
const { asyncHandler, requireSession, loadDrive, csrfProtect } = require('./middleware');

function parseParentId(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isInteger(n)) throw httpError('INVALID_PARENT');
  return n;
}

function createEntryRoutes({ config, repositories, sessionStore, fileService }) {
  const router = express.Router();
  const auth = [requireSession(sessionStore), loadDrive(repositories)];

  router.get(
    '/',
    auth,
    asyncHandler(async (req, res) => {
      const parentId = parseParentId(req.query.parentId);
      const entries = await fileService.listEntries({
        drive: req.drive,
        parentId,
        query: typeof req.query.query === 'string' ? req.query.query : '',
        kind: typeof req.query.kind === 'string' ? req.query.kind : 'all',
        sort: typeof req.query.sort === 'string' ? req.query.sort : 'name',
        direction: typeof req.query.direction === 'string' ? req.query.direction : 'asc',
      });
      res.json({ entries });
    })
  );

  router.patch(
    '/:id',
    csrfProtect(config),
    auth,
    asyncHandler(async (req, res) => {
      const entryId = Number(req.params.id);
      if (!Number.isInteger(entryId)) throw httpError('NOT_FOUND');
      const body = req.body || {};

      let result = null;
      if (typeof body.name === 'string') {
        result = await fileService.renameEntry({ drive: req.drive, entryId, name: body.name });
      }
      if (Object.prototype.hasOwnProperty.call(body, 'parentId')) {
        const parentId = body.parentId === null ? null : Number(body.parentId);
        if (!Number.isInteger(parentId) && body.parentId !== null) throw httpError('INVALID_PARENT');
        result = await fileService.moveEntry({ drive: req.drive, entryId, parentId });
      }
      if (result === null) {
        const entry = await repositories.getEntryById(entryId);
        if (!entry || entry.drive_id !== req.drive.id) throw httpError('NOT_FOUND');
        result = {
          id: entry.id,
          parentId: entry.parent_id,
          kind: entry.kind,
          name: entry.name,
          sizeBytes: entry.size_bytes,
          mimeType: entry.mime_type,
          status: entry.status,
          createdAt: entry.created_at,
          updatedAt: entry.updated_at,
        };
      }
      res.json(result);
    })
  );

  router.delete(
    '/:id',
    csrfProtect(config),
    auth,
    asyncHandler(async (req, res) => {
      const entryId = Number(req.params.id);
      if (!Number.isInteger(entryId)) throw httpError('NOT_FOUND');
      await fileService.deleteEntry({ drive: req.drive, entryId });
      res.status(204).end();
    })
  );

  return router;
}

/** POST /api/folders — folder creation lives on its own mount path. */
function createFolderRoutes({ config, repositories, sessionStore, fileService }) {
  const router = express.Router();
  const auth = [requireSession(sessionStore), loadDrive(repositories)];

  router.post(
    '/',
    csrfProtect(config),
    auth,
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      const parentId = body.parentId === undefined || body.parentId === null ? null : Number(body.parentId);
      if (!Number.isInteger(parentId) && body.parentId !== null && body.parentId !== undefined) {
        throw httpError('INVALID_PARENT');
      }
      const entry = await fileService.createFolder({
        drive: req.drive,
        parentId,
        name: body.name,
      });
      res.status(201).json(entry);
    })
  );

  return router;
}

module.exports = { createEntryRoutes, createFolderRoutes };
