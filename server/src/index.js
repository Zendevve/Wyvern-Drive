'use strict';

const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const { resolveEnvFile } = require('./config/env-file');

// Load server/.env before any config validation so the documented
// `Copy-Item .env.example .env; npm start` flow reads the file. Skipped in
// test mode: the test suite sets every variable explicitly and must stay
// hermetic against a developer's local .env.
if (process.env.NODE_ENV !== 'test') {
  require('dotenv').config({ path: resolveEnvFile() });
}

const { loadConfig, diagnoseConfig } = require('./config');
const { openDatabase, closeDatabase } = require('./db/connection');
const { migrate } = require('./db/migrate');
const { createRepositories } = require('./db/repositories');
const { createSessionStore } = require('./auth/session-store');
const { createDiscordOAuth } = require('./auth/discord-oauth');
const { createDiscordWebhookStorage } = require('./storage/discord-webhook-storage');
const { createFileService } = require('./services/file-service');
const { createApp } = require('./http/app');
const { createSetupApp } = require('./http/setup-app');

/**
 * Create the parent directory of a file-backed SQLite path before opening it.
 * `:memory:` databases have no directory. sqlite3 will not create missing
 * parent directories on its own, so a fresh `DB_URL=./data/wyvern.db` would
 * otherwise fail on first run.
 */
function ensureDatabaseParent(dbUrl) {
  if (dbUrl === ':memory:') return;
  const dir = path.dirname(dbUrl);
  if (dir && dir !== '.') {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function main() {
  let diagnostics;
  try {
    diagnostics = diagnoseConfig(process.env);
  } catch (err) {
    console.error(`Wyvern server ${err.message}`);
    process.exit(1);
  }

  const setupRequired =
    diagnostics.missing.length > 0 || diagnostics.invalid.length > 0;

  if (setupRequired) {
    // Limited setup mode: status endpoint, authenticated credential-write
    // route, and the production SPA. No SQLite, migrations, OAuth, storage
    // adapter, or protected file routes.
    const setupToken = crypto.randomBytes(24).toString('base64url');
    console.log(`Wyvern server setup token: ${setupToken}`);
    const app = createSetupApp({
      missing: diagnostics.missing,
      invalid: diagnostics.invalid,
      setupToken,
      envFile: resolveEnvFile(),
      initialEnv: { ...process.env },
    });
    const server = app.listen(diagnostics.config.port, () => {
      const addr = server.address();
      const boundPort = addr && typeof addr === 'object' ? addr.port : diagnostics.config.port;
      console.log(`Wyvern server listening on http://localhost:${boundPort} (setup mode)`);
    });
    server.on('error', (err) => {
      console.error(`Wyvern server failed to start: ${err.message}`);
      process.exit(1);
    });
    return;
  }

  const config = loadConfig(process.env);
  ensureDatabaseParent(config.dbUrl);

  const db = await openDatabase(config.dbUrl);
  await migrate(db, path.join(__dirname, 'db', 'migrations'));

  const repositories = createRepositories(db);
  const sessionStore = createSessionStore(repositories);
  const oauth = createDiscordOAuth(config);
  const discordStorage = createDiscordWebhookStorage(config, { chunkSizeBytes: config.chunkSizeBytes });
  const fileService = createFileService({ db, repositories, discordStorage, config });

  const app = createApp({ config, db, repositories, sessionStore, oauth, discordStorage, fileService });

  // Fire-and-forget boot retention sweep: purge expired trash for every drive
  // once the server is up. Every step is guarded so a failing sweep (e.g. a
  // storage outage) logs and never crashes or delays boot.
  const runBootRetentionSweep = async () => {
    try {
      const driveIds = await repositories.listDriveIds();
      for (const { id } of driveIds) {
        try {
          const drive = await repositories.getDriveById(id);
          if (drive) {
            await fileService.purgeExpiredTrash({ drive });
          }
        } catch (err) {
          console.error(`Retention sweep failed for drive ${id}: ${err && err.message}`);
        }
      }
    } catch (err) {
      console.error(`Retention sweep failed: ${err && err.message}`);
    }
  };

  // Fire-and-forget orphan-upload sweep: a page refresh orphans the client's
  // in-memory upload queue, leaving an uploading/failed entry that can never
  // resume; after the 24h TTL it is hard-purged (entry, chunks, blocks,
  // Discord messages) so drive stats never count phantom files. Runs at boot
  // and every 6 hours, guarded per drive like the retention sweep.
  const runOrphanUploadSweep = async () => {
    try {
      const driveIds = await repositories.listDriveIds();
      for (const { id } of driveIds) {
        try {
          const drive = await repositories.getDriveById(id);
          if (drive) {
            await fileService.purgeStaleUploads({ drive });
          }
        } catch (err) {
          console.error(`Orphan upload sweep failed for drive ${id}: ${err && err.message}`);
        }
      }
    } catch (err) {
      console.error(`Orphan upload sweep failed: ${err && err.message}`);
    }
  };
  // Fire-and-forget outbox replay: reconcile pending_posts intent rows left
  // by a crash between a batch POST and its block commit (delete orphaned
  // Discord messages, drop stale rows). Runs at boot and every 6 hours,
  // guarded like the other sweeps; skips rows whose upload is still live.
  const runPendingPostSweep = async () => {
    try {
      await fileService.reconcilePendingPosts();
    } catch (err) {
      console.error(`Pending-post sweep failed: ${err && err.message}`);
    }
  };

  // Fire-and-forget orphan-block sweep: reclaim content_blocks with zero live
  // chunk references (deleting a Discord message only when every block it
  // holds is dead), so orphaned storage stops pinning webhook removal. Same
  // cadence and guard style as the pending-post sweep.
  const runOrphanBlockSweep = async () => {
    try {
      await fileService.reconcileOrphanBlocks();
    } catch (err) {
      console.error(`Orphan-block sweep failed: ${err && err.message}`);
    }
  };
  // Fire-and-forget expired-session sweep: reclaim session rows whose TTL has
  // passed so the sessions table cannot grow unbounded. Runs at boot and every
  // 6 hours; a failure logs and never blocks requests. Lookup semantics are
  // unchanged — findByToken already treats an expired row as absent.
  const runExpiredSessionSweep = async () => {
    try {
      const { changes } = await sessionStore.deleteExpired();
      if (changes > 0) console.log(`Expired-session sweep: removed ${changes} session(s)`);
    } catch (err) {
      console.error(`Expired-session sweep failed: ${err && err.message}`);
    }
  };
  setInterval(() => {
    void runOrphanUploadSweep();
    void runPendingPostSweep();
    void runOrphanBlockSweep();
    void runExpiredSessionSweep();
  }, 6 * 60 * 60 * 1000).unref();

  const server = app.listen(config.port, () => {
    console.log(`Wyvern server listening on ${config.appOrigin}`);
    void runBootRetentionSweep();
    void runOrphanUploadSweep();
    void runPendingPostSweep();
    void runOrphanBlockSweep();
    void runExpiredSessionSweep();
  });
  server.on('error', async (err) => {
    console.error(`Wyvern server failed to start: ${err.message}`);
    await closeDatabase(db).catch(() => {});
    process.exit(1);
  });
}

main().catch((err) => {
  console.error(`Wyvern server failed to start: ${err && err.message}`);
  process.exit(1);
});
