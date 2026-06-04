import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { SCHEMA_SQL } from './schema';

export type DB = Database.Database;

export function openDatabase(dbPath?: string): DB {
  const target = dbPath || process.env.DB_PATH || path.join(process.cwd(), 'data', 'wyvern.db');
  const dir = path.dirname(target);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const db = new Database(target);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);
  return db;
}
