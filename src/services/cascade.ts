import type { DB } from '../db/database';
import {
  collectChunkMessageIds,
  collectDescendantIds,
  deleteNodes,
  getNode,
} from './fs-repo';
import { deleteMessage } from './discord';

export interface CascadeResult {
  deletedNodes: number;
  deletedMessages: string[];
}

const BATCH_SIZE = 100;
const CONCURRENCY = 3;

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      const item = items[idx];
      results[idx] = await worker(item);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function cascadeDelete(
  db: DB,
  webhookUrl: string,
  accountId: string,
  nodeId: string
): Promise<CascadeResult> {
  const node = getNode(db, accountId, nodeId);
  if (!node) {
    throw new Error('Node not found');
  }

  const descendantIds = collectDescendantIds(db, accountId, nodeId);
  const messageIds = collectChunkMessageIds(db, accountId, descendantIds);

  for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
    const batch = messageIds.slice(i, i + BATCH_SIZE);
    await runWithConcurrency(batch, CONCURRENCY, (mid) => deleteMessage(webhookUrl, mid));
  }

  const totalDeleted = descendantIds.length;
  db.transaction(() => deleteNodes(db, accountId, descendantIds))();
  return { deletedNodes: totalDeleted, deletedMessages: messageIds };
}
