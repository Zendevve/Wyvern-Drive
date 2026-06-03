import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbInstance: Database.Database | null = null;

export function getDatabasePath(): string {
  const envPath = process.env.DATABASE_URL;
  if (envPath) {
    if (path.isAbsolute(envPath)) {
      return envPath;
    }
    // Resolve relative to project root or package root
    return path.resolve(__dirname, '../../', envPath);
  }
  return path.resolve(__dirname, '../../data/wyvern.db');
}

export function getDatabase(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = getDatabasePath();
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  dbInstance = db;
  initializeSchema(db);

  return db;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

function initializeSchema(db: Database.Database): void {
  // users table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `).run();

  // user_profiles table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      id TEXT PRIMARY KEY,
      webhook_urls TEXT NOT NULL, -- stringified JSON array
      encryption_enabled INTEGER NOT NULL DEFAULT 0,
      server_boost_level TEXT DEFAULT 'none',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
    )
  `).run();

  // files table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL, -- 'file' or 'directory'
      size INTEGER NOT NULL DEFAULT 0,
      parent_id INTEGER, -- nullable
      content TEXT, -- JSON string of chunks
      encrypted INTEGER NOT NULL DEFAULT 0,
      encryption_salt TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES files(id) ON DELETE CASCADE
    )
  `).run();

  // file_versions table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS file_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      version_num INTEGER NOT NULL,
      name TEXT NOT NULL,
      size INTEGER NOT NULL,
      content TEXT NOT NULL,
      encrypted INTEGER NOT NULL DEFAULT 0,
      encryption_salt TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `).run();

  // file_chunks table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS file_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id INTEGER NOT NULL,
      chunk_index INTEGER NOT NULL,
      url TEXT NOT NULL,
      size INTEGER NOT NULL,
      message_id TEXT,
      channel_id TEXT,
      iv TEXT,
      compressed INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
    )
  `).run();

  // shares table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS shares (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      file_id INTEGER NOT NULL,
      password_hash TEXT, -- nullable
      expires_at TEXT, -- nullable
      storage_path TEXT, -- nullable
      download_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
    )
  `).run();

  // Try to add storage_path and download_count columns if they do not exist
  try {
    db.prepare('ALTER TABLE shares ADD COLUMN storage_path TEXT').run();
  } catch (e) {
    // Column already exists or other error
  }
  try {
    db.prepare('ALTER TABLE shares ADD COLUMN download_count INTEGER DEFAULT 0').run();
  } catch (e) {
    // Column already exists or other error
  }
}
