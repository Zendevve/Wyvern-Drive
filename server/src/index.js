'use strict';

const path = require('node:path');
const { loadConfig } = require('./config');
const { openDatabase, closeDatabase } = require('./db/connection');
const { migrate } = require('./db/migrate');
const { createRepositories } = require('./db/repositories');
const { createSessionStore } = require('./auth/session-store');
const { createDiscordOAuth } = require('./auth/discord-oauth');
const { createDiscordStorage } = require('./storage/discord-storage');
const { createFileService } = require('./services/file-service');
const { createApp } = require('./http/app');

async function main() {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    console.error(`Wyvern server ${err.message}`);
    process.exit(1);
  }

  const db = await openDatabase(config.dbUrl);
  await migrate(db, path.join(__dirname, 'db', 'migrations'));

  const repositories = createRepositories(db);
  const sessionStore = createSessionStore(repositories);
  const oauth = createDiscordOAuth(config);
  const discordStorage = createDiscordStorage(config, { chunkSizeBytes: config.chunkSizeBytes });
  const fileService = createFileService({ db, repositories, discordStorage, config });

  const app = createApp({ config, db, repositories, sessionStore, oauth, discordStorage, fileService });

  const server = app.listen(config.port, () => {
    console.log(`Wyvern server listening on ${config.appOrigin}`);
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
