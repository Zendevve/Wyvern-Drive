'use strict';

const express = require('express');

// Anti-confusion metadata: Wyvern stores chunks as Discord attachments posted
// through one per-user Discord webhook. The field lets operators tell this
// architecture apart from the pre-migration bot-managed private channels.
const STORAGE_MODE = 'discord-webhooks-per-user';
const USES_WEBHOOKS = true;

/**
 * Build the setup status contract. `missing` is a list of required variable
 * names; `invalid` is a list of { key, message } validation problems. Both
 * are empty in a fully configured server.
 */
function buildSetupStatus(missing = [], invalid = []) {
  return {
    setupRequired: missing.length > 0 || invalid.length > 0,
    usesWebhooks: USES_WEBHOOKS,
    storageMode: STORAGE_MODE,
    missing,
    invalid,
  };
}

/**
 * Read-only first-run status route. Mounted in both the full app (with empty
 * diagnostics, so setupRequired is false) and the limited setup app (with the
 * real diagnostics). This module only serves the read-only status contract;
 * the setup app separately mounts /api/setup/credentials (see setup-config.js),
 * which writes only validated non-secret-defaulted values and never returns
 * them. Per-user webhook setup happens on the authenticated /connect page,
 * never here, and secrets stay server-side.
 */
function createSetupStatusRoutes({ missing = [], invalid = [] }) {
  const router = express.Router();
  router.get('/status', (req, res) => {
    res.json(buildSetupStatus(missing, invalid));
  });
  return router;
}

module.exports = { createSetupStatusRoutes, buildSetupStatus, STORAGE_MODE, USES_WEBHOOKS };
