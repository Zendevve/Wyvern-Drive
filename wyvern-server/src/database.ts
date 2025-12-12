/**
 * Database Abstraction Layer
 * Supports both SQLite (local dev) and Postgres (production via Supabase)
 */

import Database from 'better-sqlite3'
import pg from 'pg'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Database interface - all methods are async for Postgres compatibility
export interface IDatabase {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>
  queryOne<T = unknown>(sql: string, params?: unknown[]): Promise<T | null>
  execute(sql: string, params?: unknown[]): Promise<{ lastInsertRowid?: number; changes?: number }>
  transaction<T>(fn: () => Promise<T>): Promise<T>
  close(): Promise<void>
}

// SQLite Adapter (sync operations wrapped in promises)
class SQLiteAdapter implements IDatabase {
  private db: Database.Database

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.initSchema()
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        parent_id INTEGER,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('file', 'directory')),
        size INTEGER DEFAULT 0,
        content TEXT,
        encrypted INTEGER DEFAULT 0,
        encryption_salt TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (parent_id) REFERENCES files(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
      CREATE INDEX IF NOT EXISTS idx_files_parent_id ON files(parent_id);

      CREATE TABLE IF NOT EXISTS file_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id INTEGER NOT NULL,
        version_number INTEGER NOT NULL,
        content TEXT NOT NULL,
        size INTEGER NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_versions_file_id ON file_versions(file_id);
    `)
    console.log('📦 SQLite database initialized')
  }

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    const stmt = this.db.prepare(sql)
    return stmt.all(...params) as T[]
  }

  async queryOne<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
    const stmt = this.db.prepare(sql)
    return (stmt.get(...params) as T) || null
  }

  async execute(sql: string, params: unknown[] = []): Promise<{ lastInsertRowid?: number; changes?: number }> {
    const stmt = this.db.prepare(sql)
    const result = stmt.run(...params)
    return { lastInsertRowid: Number(result.lastInsertRowid), changes: result.changes }
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    // SQLite transactions are sync, but we wrap for consistency
    const txn = this.db.transaction(async () => await fn())
    return txn() as T
  }

  async close(): Promise<void> {
    this.db.close()
  }
}

// Postgres Adapter (Supabase)
class PostgresAdapter implements IDatabase {
  private pool: pg.Pool

  constructor(connectionString: string) {
    this.pool = new pg.Pool({ connectionString })
    this.initSchema()
  }

  private async initSchema() {
    const client = await this.pool.connect()
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS files (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          parent_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('file', 'directory')),
          size INTEGER DEFAULT 0,
          content TEXT,
          encrypted INTEGER DEFAULT 0,
          encryption_salt TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
        CREATE INDEX IF NOT EXISTS idx_files_parent_id ON files(parent_id);

        CREATE TABLE IF NOT EXISTS file_versions (
          id SERIAL PRIMARY KEY,
          file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
          version_number INTEGER NOT NULL,
          content TEXT NOT NULL,
          size INTEGER NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_versions_file_id ON file_versions(file_id);
      `)
      console.log('📦 Postgres database initialized')
    } finally {
      client.release()
    }
  }

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    // Convert SQLite placeholders (?) to Postgres ($1, $2, ...)
    const pgSql = this.convertPlaceholders(sql)
    const result = await this.pool.query(pgSql, params)
    return result.rows as T[]
  }

  async queryOne<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params)
    return rows[0] || null
  }

  async execute(sql: string, params: unknown[] = []): Promise<{ lastInsertRowid?: number; changes?: number }> {
    const pgSql = this.convertPlaceholders(sql)
    // For INSERT, try to get RETURNING id
    const returningMatch = pgSql.match(/INSERT/i)
    let finalSql = pgSql
    if (returningMatch && !pgSql.includes('RETURNING')) {
      finalSql = pgSql.replace(/;?\s*$/, ' RETURNING id')
    }

    const result = await this.pool.query(finalSql, params)
    return {
      lastInsertRowid: result.rows[0]?.id,
      changes: result.rowCount || 0
    }
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const result = await fn()
      await client.query('COMMIT')
      return result
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }

  async close(): Promise<void> {
    await this.pool.end()
  }

  private convertPlaceholders(sql: string): string {
    let index = 0
    return sql.replace(/\?/g, () => `$${++index}`)
  }
}

// Factory function to create the appropriate adapter
function createDatabase(): IDatabase {
  const databaseUrl = process.env.DATABASE_URL

  if (databaseUrl && databaseUrl.startsWith('postgres')) {
    console.log('🔌 Using Postgres (Supabase)')
    return new PostgresAdapter(databaseUrl)
  } else {
    const sqlitePath = process.env.SQLITE_PATH || path.join(__dirname, '../../wyvern.db')
    console.log('🔌 Using SQLite:', sqlitePath)
    return new SQLiteAdapter(sqlitePath)
  }
}

export const db = createDatabase()
