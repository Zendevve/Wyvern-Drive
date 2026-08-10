'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { run, all, exec } = require('./connection');

/**
 * Apply numbered .sql migration files from `dir` in order, inside a
 * transaction each. Enables foreign keys. Any failure aborts startup.
 */
async function migrate(db, dir) {
  await exec(db, 'PRAGMA foreign_keys = ON');
  await exec(db, `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const files = fs
    .readdirSync(dir)
    .filter((f) => /^\d+.*\.sql$/.test(f))
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

  const appliedRows = await all(db, 'SELECT version FROM schema_migrations');
  const applied = new Set(appliedRows.map((r) => r.version));

  for (const file of files) {
    const version = parseInt(file, 10);
    if (applied.has(version)) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    await exec(db, 'BEGIN');
    try {
      await exec(db, sql);
      await run(db, 'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)', [
        version,
        new Date().toISOString(),
      ]);
      await exec(db, 'COMMIT');
    } catch (err) {
      await exec(db, 'ROLLBACK');
      throw new Error(`migration ${file} failed: ${err.message}`);
    }
  }
}

module.exports = { migrate };
