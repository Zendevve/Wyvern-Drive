'use strict';

const { Readable } = require('node:stream');
const express = require('express');
const yazl = require('yazl');
const { httpError } = require('../errors');
const { asyncHandler, requireSession, loadDrive, csrfProtect } = require('./middleware');

function parseParentId(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isInteger(n)) throw httpError('INVALID_PARENT');
  return n;
}

function archiveDisposition(name) {
  const fallback = String(name).replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${fallback}.zip"; filename*=UTF-8''${encodeURIComponent(name)}.zip`;
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
      // Soft delete: the entry moves to the trash (deleted_at set) and stays
      // addressable via /api/trash until purged.
      await fileService.deleteEntry({ drive: req.drive, entryId });
      res.status(204).end();
    })
  );

  router.post(
    '/:id/copy',
    csrfProtect(config),
    auth,
    asyncHandler(async (req, res) => {
      const entryId = Number(req.params.id);
      if (!Number.isInteger(entryId)) throw httpError('NOT_FOUND');
      const body = req.body || {};
      const parentId = parseParentId(body.parentId);
      const entry = await fileService.copyEntry({ drive: req.drive, entryId, parentId });
      res.status(201).json(entry);
    })
  );

  router.get(
    '/:id/archive',
    auth,
    asyncHandler(async (req, res) => {
      const entryId = Number(req.params.id);
      if (!Number.isInteger(entryId)) throw httpError('NOT_FOUND');

      // Pre-order list (parents before children, root first): walk once,
      // remembering each entry's relative path so children can join theirs.
      // All downloadFile calls happen before any bytes are written, so a 404
      // here still reaches the error middleware as a clean JSON response.
      const subtree = await fileService.getSubtreeEntries(req.drive, entryId);
      if (subtree.length === 0) throw httpError('NOT_FOUND');

      const zip = new yazl.ZipFile();
      const relPathByEntryId = new Map();
      let rootName = '';
      for (const entry of subtree) {
        const parentRel = entry.parentId == null ? '' : relPathByEntryId.get(entry.parentId);
        const relPath = parentRel === '' ? entry.name : `${parentRel}/${entry.name}`;
        relPathByEntryId.set(entry.id, relPath);
        if (entry.kind === 'folder') {
          zip.addEmptyDirectory(relPath);
        } else {
          const result = await fileService.downloadFile({ drive: req.drive, entryId: entry.id, range: null });
          // yazl's addReadStream pipes the source without forwarding its
          // errors, so an async-generator failure would be unhandled. Forward
          // them into the zip, whose error listener aborts the response.
          const readable = Readable.from(result.stream());
          readable.on('error', (err) => zip.emit('error', err));
          zip.addReadStream(readable, relPath, { size: result.sizeBytes });
        }
        if (entry.parentId == null) rootName = entry.name;
      }

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', archiveDisposition(rootName));
      zip.on('error', (err) => {
        if (res.writableEnded) return;
        // Abort the connection: the client sees a truncated zip instead of a
        // hanging response. Emitted when a chunk fetch fails mid-stream.
        res.destroy(err instanceof Error ? err : new Error('Archive stream error'));
      });
      zip.outputStream.pipe(res);
      zip.end();
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
