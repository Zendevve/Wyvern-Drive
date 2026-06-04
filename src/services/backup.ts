import type { DB } from '../db/database';
import type { Node, Chunk } from './fs-repo';

export interface Backup {
  version: 1;
  account_id: string;
  exported_at: number;
  nodes: Node[];
  chunks: Chunk[];
}

export interface RestoreResult {
  insertedNodes: number;
  insertedChunks: number;
}

function isNode(value: any): value is Node {
  if (!value || typeof value !== 'object') return false;
  return (
    typeof value.id === 'string' &&
    (value.parent_id === null || typeof value.parent_id === 'string') &&
    typeof value.account_id === 'string' &&
    typeof value.name === 'string' &&
    (value.kind === 'file' || value.kind === 'folder') &&
    (value.size_bytes === null || typeof value.size_bytes === 'number') &&
    (value.mime_type === null || typeof value.mime_type === 'string') &&
    typeof value.created_at === 'number' &&
    typeof value.updated_at === 'number'
  );
}

function isChunk(value: any): value is Chunk {
  if (!value || typeof value !== 'object') return false;
  return (
    typeof value.id === 'number' &&
    typeof value.node_id === 'string' &&
    typeof value.discord_message_id === 'string' &&
    typeof value.index === 'number' &&
    typeof value.size_bytes === 'number' &&
    typeof value.cdn_url === 'string'
  );
}

export function exportBackup(db: DB, accountId: string): Backup {
  const nodes = db
    .prepare(`SELECT * FROM nodes WHERE account_id = ? ORDER BY created_at ASC`)
    .all(accountId) as Node[];
  const chunks = nodes.length
    ? db
        .prepare(
          `SELECT c.* FROM chunks c
           INNER JOIN nodes n ON n.id = c.node_id
           WHERE n.account_id = ?
           ORDER BY c.node_id, c."index"`
        )
        .all(accountId) as Chunk[]
    : [];
  return {
    version: 1,
    account_id: accountId,
    exported_at: Date.now(),
    nodes,
    chunks,
  };
}

export function restoreBackup(db: DB, accountId: string, payload: unknown): RestoreResult {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Backup must be an object');
  }
  const p = payload as Partial<Backup>;
  if (p.version !== 1) {
    throw new Error(`Unsupported backup version: ${p.version}`);
  }
  if (p.account_id !== accountId) {
    throw new Error('Backup account_id does not match requester');
  }
  if (!Array.isArray(p.nodes) || !Array.isArray(p.chunks)) {
    throw new Error('Backup must contain nodes and chunks arrays');
  }
  for (const n of p.nodes) {
    if (!isNode(n)) {
      throw new Error('Backup contains a malformed node entry');
    }
    if (n.account_id !== accountId) {
      throw new Error('Backup contains a node with foreign account_id');
    }
  }
  for (const c of p.chunks) {
    if (!isChunk(c)) {
      throw new Error('Backup contains a malformed chunk entry');
    }
  }

  const insertNode = db.prepare(
    `INSERT OR IGNORE INTO nodes (id, parent_id, account_id, name, kind, size_bytes, mime_type, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertChunk = db.prepare(
    `INSERT OR IGNORE INTO chunks (id, node_id, discord_message_id, "index", size_bytes, cdn_url)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const tx = db.transaction(() => {
    let n = 0;
    for (const node of p.nodes as Node[]) {
      const r = insertNode.run(
        node.id,
        node.parent_id,
        node.account_id,
        node.name,
        node.kind,
        node.size_bytes,
        node.mime_type,
        node.created_at,
        node.updated_at
      );
      n += r.changes;
    }
    let c = 0;
    for (const chunk of p.chunks as Chunk[]) {
      const r = insertChunk.run(
        chunk.id,
        chunk.node_id,
        chunk.discord_message_id,
        chunk.index,
        chunk.size_bytes,
        chunk.cdn_url
      );
      c += r.changes;
    }
    return { insertedNodes: n, insertedChunks: c };
  });
  return tx();
}
