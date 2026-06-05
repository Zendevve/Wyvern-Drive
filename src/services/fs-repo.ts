import crypto from 'crypto';
import type { DB } from '../db/database';

export type NodeKind = 'file' | 'folder';

export interface Node {
  id: string;
  parent_id: string | null;
  account_id: string;
  name: string;
  kind: NodeKind;
  size_bytes: number | null;
  mime_type: string | null;
  created_at: number;
  updated_at: number;
}

export interface Chunk {
  id: number;
  node_id: string;
  discord_message_id: string;
  index: number;
  size_bytes: number;
  cdn_url: string;
}

export interface NewNode {
  accountId: string;
  parentId: string | null;
  name: string;
  kind: NodeKind;
  sizeBytes?: number | null;
  mimeType?: string | null;
}

export class UniqueViolationError extends Error {
  code = 'UNIQUE_VIOLATION';
  constructor(public readonly field: string, message?: string) {
    super(message || `Unique constraint violated on ${field}`);
  }
}

function nowMs(): number {
  return Date.now();
}

function accountIdFor(webhookUrl: string): string {
  return crypto.createHash('sha256').update(webhookUrl).digest('hex');
}

export { accountIdFor };

export function createNode(db: DB, params: NewNode): Node {
  const id = crypto.randomUUID();
  const ts = nowMs();
  const stmt = db.prepare(
    `INSERT INTO nodes (id, parent_id, account_id, name, kind, size_bytes, mime_type, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  try {
    stmt.run(
      id,
      params.parentId,
      params.accountId,
      params.name,
      params.kind,
      params.sizeBytes ?? null,
      params.mimeType ?? null,
      ts,
      ts
    );
  } catch (err: any) {
    if (err && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new UniqueViolationError('sibling_name');
    }
    throw err;
  }
  return getNode(db, params.accountId, id)!;
}

export function getNode(db: DB, accountId: string, id: string): Node | null {
  const row = db
    .prepare(`SELECT * FROM nodes WHERE id = ? AND account_id = ?`)
    .get(id, accountId) as Node | undefined;
  return row || null;
}

export function listChildren(db: DB, accountId: string, parentId: string | null): Node[] {
  const rows = db
    .prepare(
      `SELECT * FROM nodes
       WHERE account_id = ? AND ${parentId === null ? 'parent_id IS NULL' : 'parent_id = ?'}
       ORDER BY (kind = 'folder') DESC, name COLLATE NOCASE ASC`
    )
    .all(...(parentId === null ? [accountId] : [accountId, parentId])) as Node[];
  return rows;
}

export function renameNode(db: DB, accountId: string, id: string, newName: string): Node {
  const ts = nowMs();
  try {
    const res = db
      .prepare(`UPDATE nodes SET name = ?, updated_at = ? WHERE id = ? AND account_id = ?`)
      .run(newName, ts, id, accountId);
    if (res.changes === 0) {
      throw new Error('NOT_FOUND');
    }
  } catch (err: any) {
    if (err && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new UniqueViolationError('sibling_name');
    }
    if (err && err.message === 'NOT_FOUND') {
      throw new Error('Node not found');
    }
    throw err;
  }
  return getNode(db, accountId, id)!;
}

export function deleteNode(db: DB, accountId: string, id: string): void {
  const res = db
    .prepare(`DELETE FROM nodes WHERE id = ? AND account_id = ?`)
    .run(id, accountId);
  if (res.changes === 0) {
    throw new Error('Node not found');
  }
}

export interface ChunkDescriptor {
  discordMessageId: string;
  index: number;
  sizeBytes: number;
  cdnUrl: string;
}

export function recordChunks(
  db: DB,
  accountId: string,
  nodeId: string,
  chunks: ChunkDescriptor[]
): void {
  const node = getNode(db, accountId, nodeId);
  if (!node) {
    throw new Error('Node not found');
  }
  if (node.kind !== 'file') {
    throw new Error('Chunks can only be recorded for file nodes');
  }
  const insert = db.prepare(
    `INSERT OR REPLACE INTO chunks (node_id, discord_message_id, "index", size_bytes, cdn_url)
     VALUES (?, ?, ?, ?, ?)`
  );
  const tx = db.transaction(() => {
    for (const c of chunks) {
      insert.run(nodeId, c.discordMessageId, c.index, c.sizeBytes, c.cdnUrl);
    }
  });
  tx();
}

export function getChunks(db: DB, accountId: string, nodeId: string): Chunk[] {
  const node = getNode(db, accountId, nodeId);
  if (!node) {
    throw new Error('Node not found');
  }
  return db
    .prepare(`SELECT * FROM chunks WHERE node_id = ? ORDER BY "index" ASC`)
    .all(nodeId) as Chunk[];
}

export function collectDescendantIds(db: DB, accountId: string, rootId: string): string[] {
  const rows = db
    .prepare(
      `WITH RECURSIVE descendants(id) AS (
         SELECT id FROM nodes WHERE id = ? AND account_id = ?
         UNION ALL
         SELECT n.id FROM nodes n
           INNER JOIN descendants d ON n.parent_id = d.id
           WHERE n.account_id = ?
       )
       SELECT id FROM descendants`
    )
    .all(rootId, accountId, accountId) as Array<{ id: string }>;
  return rows.map((r) => r.id);
}

export function collectChunkMessageIds(db: DB, accountId: string, nodeIds: string[]): string[] {
  if (nodeIds.length === 0) {
    return [];
  }
  const placeholders = nodeIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT c.discord_message_id
       FROM chunks c
       INNER JOIN nodes n ON n.id = c.node_id
       WHERE n.account_id = ? AND c.node_id IN (${placeholders})`
    )
    .all(accountId, ...nodeIds) as Array<{ discord_message_id: string }>;
  return rows.map((r) => r.discord_message_id);
}

export function deleteNodes(db: DB, accountId: string, nodeIds: string[]): number {
  if (nodeIds.length === 0) {
    return 0;
  }
  const placeholders = nodeIds.map(() => '?').join(',');
  const res = db
    .prepare(`DELETE FROM nodes WHERE account_id = ? AND id IN (${placeholders})`)
    .run(accountId, ...nodeIds);
  return res.changes;
}

export interface StorageStats {
  totalBytes: number;
  categories: {
    documents: number;
    images: number;
    videos: number;
    audio: number;
    others: number;
  };
}

export function getStorageStats(db: DB, accountId: string): StorageStats {
  const rows = db.prepare(
    `SELECT mime_type, SUM(size_bytes) as total_size
     FROM nodes
     WHERE account_id = ? AND kind = 'file' AND size_bytes IS NOT NULL
     GROUP BY mime_type`
  ).all(accountId) as Array<{ mime_type: string | null; total_size: number }>;

  let totalBytes = 0;
  let documents = 0;
  let images = 0;
  let videos = 0;
  let audio = 0;
  let others = 0;

  for (const row of rows) {
    const size = row.total_size;
    totalBytes += size;
    const mime = (row.mime_type || '').toLowerCase();
    if (
      mime.startsWith('text/') ||
      mime.includes('pdf') ||
      mime.includes('word') ||
      mime.includes('excel') ||
      mime.includes('powerpoint') ||
      mime.includes('office') ||
      mime.includes('zip') ||
      mime.includes('rar')
    ) {
      documents += size;
    } else if (mime.startsWith('image/')) {
      images += size;
    } else if (mime.startsWith('video/')) {
      videos += size;
    } else if (mime.startsWith('audio/')) {
      audio += size;
    } else {
      others += size;
    }
  }

  return {
    totalBytes,
    categories: { documents, images, videos, audio, others }
  };
}
