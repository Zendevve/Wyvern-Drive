import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDatabase, closeDatabase, getDatabasePath } from './database';
import fs from 'fs';

describe('Database Initialization', () => {
  beforeAll(() => {
    // Set environment variable to test database path
    process.env.DATABASE_URL = 'data/test_wyvern.db';
    
    // Clean up test DB if it exists
    const testDbPath = getDatabasePath();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  afterAll(() => {
    closeDatabase();
    const testDbPath = getDatabasePath();
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (e) {
        // Ignore files that are locked/being deleted
      }
    }
  });

  it('should initialize and return a database connection in WAL mode', () => {
    const db = getDatabase();
    expect(db).toBeDefined();

    const journalMode = db.pragma('journal_mode', { simple: true });
    expect(journalMode).toBe('wal');
  });

  it('should create all required tables', () => {
    const db = getDatabase();
    const tables = ['users', 'user_profiles', 'files', 'file_versions', 'file_chunks', 'shares'];
    
    for (const table of tables) {
      const stmt = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`);
      const row = stmt.get(table);
      expect(row).toBeDefined();
      expect((row as any).name).toBe(table);
    }
  });

  it('should successfully perform basic insert and select on users', () => {
    const db = getDatabase();
    const insertStmt = db.prepare(`
      INSERT INTO users (id, email, password_hash, created_at)
      VALUES (?, ?, ?, ?)
    `);
    
    insertStmt.run('user-1', 'test@example.com', 'hashedpassword', new Date().toISOString());

    const selectStmt = db.prepare(`SELECT * FROM users WHERE id = ?`);
    const user = selectStmt.get('user-1') as any;
    
    expect(user).toBeDefined();
    expect(user.email).toBe('test@example.com');
    expect(user.password_hash).toBe('hashedpassword');
  });
});
