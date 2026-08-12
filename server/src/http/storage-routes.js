'use strict';

const express = require('express');
const { asyncHandler, requireSession, loadDrive, csrfProtect } = require('./middleware');
const { httpError } = require('../errors');

/**
 * Per-user storage routes. A drive owns 1..maxWebhooksPerDrive webhooks
 * (rows in the `webhooks` table); the authenticated browser submits webhook
 * URLs exactly as-is, the service validates each against Discord, seals it
 * with AES-256-GCM under the master key, and persists only the ciphertext.
 * No loadDrive middleware on POST /webhook: first-time users have no drive
 * row yet, so the route creates one first. Responses carry only drive
 * summaries and webhook ids/dates — never a URL or any credential.
 */
function createStorageRoutes({ config, repositories, sessionStore, fileService }) {
  const router = express.Router();
  const auth = requireSession(sessionStore);
  const driveAuth = [requireSession(sessionStore), loadDrive(repositories)];

  router.post(
    '/webhook',
    auth,
    csrfProtect(config),
    asyncHandler(async (req, res) => {
      const rawUrl = req.body && req.body.webhookUrl;
      if (typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
        throw httpError('INVALID_WEBHOOK');
      }

      let drive = await repositories.getDriveByUser(req.user.id);
      if (drive && drive.legacy_discord_channel_id) {
        // Bot-era drive: not auto-migrated; the legacy channel value is the
        // operator's export path with the pre-migration implementation.
        throw httpError('STORAGE_MIGRATION_REQUIRED');
      }
      const created = !drive;
      if (!drive) {
        drive = await repositories.insertDrive({
          ownerId: req.user.id,
          quotaBytes: config.defaultQuotaBytes,
        });
      }

      await fileService.addWebhook({ drive, webhookUrl: rawUrl });
      const { webhooks } = await fileService.listWebhooks({ drive });
      const usedBytes = await repositories.sumUsedBytes(drive.id);
      res.status(created ? 201 : 200).json({
        id: drive.id,
        quotaBytes: drive.quota_bytes,
        usedBytes,
        webhooks,
      });
    })
  );

  router.get(
    '/webhooks',
    driveAuth,
    asyncHandler(async (req, res) => {
      const { webhooks } = await fileService.listWebhooks({ drive: req.drive });
      res.json({ webhooks });
    })
  );

  router.delete(
    '/webhooks/:id',
    csrfProtect(config),
    driveAuth,
    asyncHandler(async (req, res) => {
      const webhookId = Number(req.params.id);
      if (!Number.isInteger(webhookId)) throw httpError('NOT_FOUND');
      await fileService.removeWebhook({ drive: req.drive, webhookId });
      res.status(204).end();
    })
  );

  return router;
}

module.exports = { createStorageRoutes };
