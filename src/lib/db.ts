import { openDB, type IDBPDatabase } from 'idb';
import type { FileRecord, ChunkRecord, AppConfig } from '../types';

const DB_NAME = 'wyvern-drive';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase | null = null;

export async function getDb(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('files')) {
        const filesStore = db.createObjectStore('files', { keyPath: 'id' });
        filesStore.createIndex('folderId', 'folderId');
        filesStore.createIndex('status', 'status');
        filesStore.createIndex('mimeType', 'mimeType');
        filesStore.createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('chunks')) {
        const chunksStore = db.createObjectStore('chunks', { keyPath: 'id' });
        chunksStore.createIndex('fileId', 'fileId');
        chunksStore.createIndex('messageId', 'messageId');
        chunksStore.createIndex('cdnExpiry', 'cdnExpiry');
      }
      if (!db.objectStoreNames.contains('folders')) {
        const foldersStore = db.createObjectStore('folders', { keyPath: 'id' });
        foldersStore.createIndex('parentId', 'parentId');
        foldersStore.createIndex('path', 'path');
      }
      if (!db.objectStoreNames.contains('config')) {
        db.createObjectStore('config', { keyPath: 'key' });
      }
    },
  });
  return dbInstance;
}

export async function putFile(file: FileRecord): Promise<void> {
  const db = await getDb();
  await db.put('files', file);
}

export async function getFile(id: string): Promise<FileRecord | undefined> {
  const db = await getDb();
  return db.get('files', id);
}

export async function getAllFiles(): Promise<FileRecord[]> {
  const db = await getDb();
  return db.getAll('files');
}

export async function putChunk(chunk: ChunkRecord): Promise<void> {
  const db = await getDb();
  await db.put('chunks', chunk);
}

export async function getChunksByFileId(fileId: string): Promise<ChunkRecord[]> {
  const db = await getDb();
  return db.getAllFromIndex('chunks', 'fileId', fileId);
}

export async function getConfig<T = unknown>(key: string): Promise<T | undefined> {
  const db = await getDb();
  const record = await db.get('config', key) as AppConfig | undefined;
  return record?.value as T | undefined;
}

export async function setConfig(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db.put('config', { key, value });
}

export async function deleteFile(id: string): Promise<void> {
  const db = await getDb();
  const chunks = await getChunksByFileId(id);
  const tx = db.transaction(['files', 'chunks'], 'readwrite');
  for (const chunk of chunks) {
    await tx.objectStore('chunks').delete(chunk.id);
  }
  await tx.objectStore('files').delete(id);
  await tx.done;
}
