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
      const usedBytes = await repositories.sumReadyBytes(req.drive.id);
      res.json({ id: req.drive.id, quotaBytes: req.drive.quota_bytes, usedBytes });
    })
  );

  return router;
}

module.exports = { createDriveRoutes };
