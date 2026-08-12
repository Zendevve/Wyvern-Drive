'use strict';

const express = require('express');
const { asyncHandler, requireSession, csrfProtect } = require('./middleware');
const { httpError } = require('../errors');

/**
 * Per-user storage connection routes. The authenticated browser submits a
 * webhook URL exactly once; the server validates it against Discord, seals it
 * with AES-256-GCM under the master key, and persists only the ciphertext.
 * No loadDrive middleware here: first-time users have no drive row yet.
 * The response is only the drive summary — never the URL or any credential.
 */
function createStorageRoutes({ config, repositories, sessionStore, discordStorage }) {
  const router = express.Router();
  const auth = requireSession(sessionStore);

  router.post(
    '/webhook',
    auth,
    csrfProtect(config),
    asyncHandler(async (req, res) => {
      const rawUrl = req.body && req.body.webhookUrl;
      if (typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
        throw httpError('INVALID_WEBHOOK');
      }

      const drive = await repositories.getDriveByUser(req.user.id);
      if (drive && drive.legacy_discord_channel_id) {
        // Bot-era drive: not auto-migrated; the legacy channel value is the
        // operator's export path with the pre-migration implementation.
        throw httpError('STORAGE_MIGRATION_REQUIRED');
      }
      if (drive && (drive.webhook_ciphertext || drive.webhook_nonce || drive.webhook_auth_tag)) {
        // Never rotate a credential behind existing chunks.
        throw httpError('STORAGE_ALREADY_CONFIGURED');
      }

      const sealed = await discordStorage.validateAndSealWebhook(rawUrl);

      if (drive) {
        await repositories.updateDriveWebhook(drive.id, sealed);
        const usedBytes = await repositories.sumUsedBytes(drive.id);
        res.status(200).json({ id: drive.id, quotaBytes: drive.quota_bytes, usedBytes });
        return;
      }

      const created = await repositories.insertDrive({
        ownerId: req.user.id,
        webhookCiphertext: sealed.webhook_ciphertext,
        webhookNonce: sealed.webhook_nonce,
        webhookAuthTag: sealed.webhook_auth_tag,
        quotaBytes: config.defaultQuotaBytes,
      });
      res.status(201).json({ id: created.id, quotaBytes: created.quota_bytes, usedBytes: 0 });
    })
  );

  return router;
}

module.exports = { createStorageRoutes };
