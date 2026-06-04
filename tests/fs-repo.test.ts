import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { openDatabase, type DB } from '../src/db/database';
import { SCHEMA_SQL } from '../src/db/schema';
import {
  createNode,
  getNode,
  listChildren,
  renameNode,
  deleteNode,
  recordChunks,
  getChunks,
  collectDescendantIds,
  collectChunkMessageIds,
  deleteNodes,
  UniqueViolationError,
} from '../src/services/fs-repo';

const ACCOUNT_A = 'account-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const ACCOUNT_B = 'account-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

function makeDb(): DB {
  const db = new Database(':memory:');
  db.pragma('journal_mode = MEMORY');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);
  return db;
}

describe('fs-repo foundation', () => {
  let db: DB;

  beforeEach(() => {
    db = makeDb();
  });

  afterEach(() => {
    db.close();
  });

  it('openDatabase initializes schema idempotently', () => {
    const path = require('os').tmpdir() + `/wyvern-${Date.now()}-${Math.random()}.db`;
    const a = openDatabase(path);
    const b = openDatabase(path);
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    a.close();
    b.close();
  });

  it('creates a folder, lists it, then creates a file under it', () => {
    const folder = createNode(db, { accountId: ACCOUNT_A, parentId: null, name: 'Docs', kind: 'folder' });
    expect(folder.kind).toBe('folder');
    expect(folder.parent_id).toBeNull();

    const file = createNode(db, {
      accountId: ACCOUNT_A,
      parentId: folder.id,
      name: 'note.txt',
      kind: 'file',
      sizeBytes: 12,
      mimeType: 'text/plain',
    });
    expect(file.parent_id).toBe(folder.id);

    const root = listChildren(db, ACCOUNT_A, null);
    expect(root.map((n) => n.name)).toEqual(['Docs']);

    const inside = listChildren(db, ACCOUNT_A, folder.id);
    expect(inside.map((n) => n.name)).toEqual(['note.txt']);
  });

  it('enforces sibling-name uniqueness', () => {
    createNode(db, { accountId: ACCOUNT_A, parentId: null, name: 'Folder', kind: 'folder' });
    expect(() =>
      createNode(db, { accountId: ACCOUNT_A, parentId: null, name: 'folder', kind: 'folder' })
    ).toThrow(UniqueViolationError);
  });

  it('renames a node and reflects the change in subsequent listings', () => {
    const f = createNode(db, { accountId: ACCOUNT_A, parentId: null, name: 'old', kind: 'folder' });
    const renamed = renameNode(db, ACCOUNT_A, f.id, 'new');
    expect(renamed.name).toBe('new');
    const list = listChildren(db, ACCOUNT_A, null);
    expect(list.map((n) => n.name)).toEqual(['new']);
  });

  it('does not allow reading or modifying another account node', () => {
    const f = createNode(db, { accountId: ACCOUNT_A, parentId: null, name: 'A-only', kind: 'folder' });
    expect(getNode(db, ACCOUNT_B, f.id)).toBeNull();
    expect(() => renameNode(db, ACCOUNT_B, f.id, 'hijack')).toThrow(/not found/i);
  });

  it('deletes a single node', () => {
    const f = createNode(db, { accountId: ACCOUNT_A, parentId: null, name: 'doomed', kind: 'folder' });
    deleteNode(db, ACCOUNT_A, f.id);
    expect(getNode(db, ACCOUNT_A, f.id)).toBeNull();
  });

  it('records chunks and retrieves them in order', () => {
    const f = createNode(db, { accountId: ACCOUNT_A, parentId: null, name: 'parent', kind: 'folder' });
    const file = createNode(db, {
      accountId: ACCOUNT_A,
      parentId: f.id,
      name: 'f.bin',
      kind: 'file',
      sizeBytes: 30,
    });
    recordChunks(db, ACCOUNT_A, file.id, [
      { discordMessageId: 'm1', index: 1, sizeBytes: 10, cdnUrl: 'u1' },
      { discordMessageId: 'm0', index: 0, sizeBytes: 10, cdnUrl: 'u0' },
      { discordMessageId: 'm2', index: 2, sizeBytes: 10, cdnUrl: 'u2' },
    ]);
    const chunks = getChunks(db, ACCOUNT_A, file.id);
    expect(chunks.map((c) => c.index)).toEqual([0, 1, 2]);
  });

  it('collectDescendantIds returns the root plus all transitive descendants', () => {
    const a = createNode(db, { accountId: ACCOUNT_A, parentId: null, name: 'a', kind: 'folder' });
    const b = createNode(db, { accountId: ACCOUNT_A, parentId: a.id, name: 'b', kind: 'folder' });
    const c = createNode(db, { accountId: ACCOUNT_A, parentId: b.id, name: 'c', kind: 'folder' });
    const d = createNode(db, { accountId: ACCOUNT_A, parentId: null, name: 'd', kind: 'folder' });
    const ids = collectDescendantIds(db, ACCOUNT_A, a.id);
    expect(new Set(ids)).toEqual(new Set([a.id, b.id, c.id]));
    expect(ids.includes(d.id)).toBe(false);
  });

  it('collectChunkMessageIds returns all discord message ids across nodes', () => {
    const f = createNode(db, { accountId: ACCOUNT_A, parentId: null, name: 'f', kind: 'folder' });
    const file1 = createNode(db, { accountId: ACCOUNT_A, parentId: f.id, name: 'a.bin', kind: 'file' });
    const file2 = createNode(db, { accountId: ACCOUNT_A, parentId: f.id, name: 'b.bin', kind: 'file' });
    recordChunks(db, ACCOUNT_A, file1.id, [{ discordMessageId: 'm1', index: 0, sizeBytes: 5, cdnUrl: 'u1' }]);
    recordChunks(db, ACCOUNT_A, file2.id, [
      { discordMessageId: 'm2', index: 0, sizeBytes: 5, cdnUrl: 'u2' },
      { discordMessageId: 'm3', index: 1, sizeBytes: 5, cdnUrl: 'u3' },
    ]);
    const ids = collectChunkMessageIds(db, ACCOUNT_A, [file1.id, file2.id]);
    expect(new Set(ids)).toEqual(new Set(['m1', 'm2', 'm3']));
  });

  it('deleteNodes bulk-deletes the given ids', () => {
    const f = createNode(db, { accountId: ACCOUNT_A, parentId: null, name: 'f', kind: 'folder' });
    const a = createNode(db, { accountId: ACCOUNT_A, parentId: f.id, name: 'a', kind: 'file' });
    const b = createNode(db, { accountId: ACCOUNT_A, parentId: f.id, name: 'b', kind: 'file' });
    const c = createNode(db, { accountId: ACCOUNT_A, parentId: null, name: 'c', kind: 'folder' });
    const removed = deleteNodes(db, ACCOUNT_A, [a.id, b.id]);
    expect(removed).toBe(2);
    expect(getNode(db, ACCOUNT_A, c.id)).not.toBeNull();
  });
});
