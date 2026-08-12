'use strict';

const express = require('express');
const { asyncHandler, requireSession, loadDrive } = require('./middleware');

function createDriveRoutes({ repositories, sessionStore }) {
  const router = express.Router();
  const auth = [requireSession(sessionStore), loadDrive(repositories)];

  router.get(
    '/',
    auth,
    asyncHandler(async (req, res) => {
      const usedBytes = await repositories.sumUsedBytes(req.drive.id);
      res.json({ id: req.drive.id, quotaBytes: req.drive.quota_bytes, usedBytes });
    })
  );

  router.get(
    '/stats',
    auth,
    asyncHandler(async (req, res) => {
      res.json(await repositories.driveStats(req.drive.id));
    })
  );

  return router;
}

module.exports = { createDriveRoutes };
