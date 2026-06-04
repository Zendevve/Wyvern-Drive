import { v4 as uuidv4 } from 'uuid';
import { encryptFile, generateSalt, generateNonce, hashFile } from './crypto';
import { splitFile, DEFAULT_CHUNK_SIZE } from './chunker';
import { uploadChunk, type DiscordMessageResponse } from './discord';
import { putFile, putChunk } from './db';
import type { FileRecord, ChunkRecord, UploadProgress } from '../types';

const MAX_CONCURRENT = 3;

async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number
): Promise<T[]> {
  const results: T[] = [];
  const executing = new Set<Promise<void>>();
  let hasFailed = false;
  let error: any = null;

  for (const task of tasks) {
    if (hasFailed) {
      throw error;
    }

    const p = task().then(result => {
      results.push(result);
    }).catch(err => {
      hasFailed = true;
      error = err;
      throw err;
    });

    const tracked = p.catch(() => {}).finally(() => {
      executing.delete(tracked);
    });
    executing.add(tracked);

    if (executing.size >= limit) {
      await Promise.race(executing);
      if (hasFailed) {
        throw error;
      }
    }
  }

  await Promise.all(executing);
  if (hasFailed) {
    throw error;
  }
  return results;
}

export async function uploadFile(
  file: File,
  key: CryptoKey,
  webhookUrl: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<FileRecord> {
  const fileId = uuidv4();
  const salt = generateSalt();
  const nonce = generateNonce();
  const chunks = splitFile(file);
  const totalChunks = chunks.length;

  const fileBuffer = await file.arrayBuffer();
  const checksum = await hashFile(fileBuffer);

  const fileRecord: FileRecord = {
    id: fileId,
    name: file.name,
    mimeType: file.type,
    size: file.size,
    folderId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    status: 'uploading',
    version: 1,
    encryptionSalt: salt,
    encryptionNonce: nonce,
    chunkSize: DEFAULT_CHUNK_SIZE,
    totalChunks,
    checksum,
    versionHistory: [],
  };

  await putFile(fileRecord);

  const progress: UploadProgress = {
    fileId,
    fileName: file.name,
    totalChunks,
    completedChunks: 0,
    status: 'encrypting',
  };
  onProgress?.(progress);

  let completedChunks = 0;
  let aborted = false;

  const uploadTasks = chunks.map((chunkBlob, index) => {
    return async () => {
      if (aborted) {
        throw new Error('Upload aborted');
      }

      try {
        const chunkBuffer = await chunkBlob.arrayBuffer();
        const chunkNonce = generateNonce();
        const encryptedData = await encryptFile(chunkBuffer, key, chunkNonce);

        onProgress?.({ ...progress, status: 'uploading', completedChunks });

        const response: DiscordMessageResponse = await uploadChunk(
          webhookUrl,
          new Blob([encryptedData], { type: 'application/octet-stream' }),
          {
            fileId,
            chunkIndex: index,
            chunkTotal: totalChunks,
            filename: file.name,
            uploadedAt: new Date().toISOString(),
          }
        );

        const attachment = response.attachments[0];
        const chunkRecord: ChunkRecord = {
          id: uuidv4(),
          fileId,
          chunkIndex: index,
          messageId: response.id,
          attachmentId: attachment.id,
          cdnUrl: attachment.url,
          cdnExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
          channelId: response.channel_id,
          size: encryptedData.byteLength,
          uploadedAt: new Date(),
        };

        await putChunk(chunkRecord);

        completedChunks++;
        onProgress?.({ ...progress, status: 'uploading', completedChunks });
      } catch (err) {
        aborted = true;
        throw err;
      }
    };
  });

  try {
    await runWithConcurrency(uploadTasks, MAX_CONCURRENT);

    fileRecord.status = 'complete';
    fileRecord.updatedAt = new Date();
    await putFile(fileRecord);

    onProgress?.({ ...progress, status: 'complete', completedChunks: totalChunks });

    return fileRecord;
  } catch (err: any) {
    fileRecord.status = 'failed';
    fileRecord.updatedAt = new Date();
    await putFile(fileRecord);

    onProgress?.({
      ...progress,
      status: 'failed',
      completedChunks,
      error: err instanceof Error ? err.message : String(err),
    });

    throw err;
  }
}
