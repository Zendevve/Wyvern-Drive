import { decryptFile } from './crypto';
import { reassembleChunks } from './chunker';
import { refreshCdnUrl, isCdnExpired } from './discord';
import { getFile, getChunksByFileId, putChunk } from './db';

export async function downloadFile(
  fileId: string,
  key: CryptoKey,
  webhookUrl: string
): Promise<Blob> {
  const fileRecord = await getFile(fileId);
  if (!fileRecord) throw new Error(`File not found: ${fileId}`);

  const chunkRecords = await getChunksByFileId(fileId);
  chunkRecords.sort((a, b) => a.chunkIndex - b.chunkIndex);

  if (chunkRecords.length === 0) throw new Error('No chunks found for file');

  const decryptedChunks: Blob[] = [];

  for (const chunk of chunkRecords) {
    let cdnUrl = chunk.cdnUrl;

    if (isCdnExpired(cdnUrl)) {
      cdnUrl = await refreshCdnUrl(webhookUrl, chunk.messageId);
      chunk.cdnUrl = cdnUrl;
      chunk.cdnExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await putChunk(chunk);
    }

    const response = await fetch(cdnUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch chunk ${chunk.chunkIndex}: ${response.statusText}`);
    }

    const encryptedData = await response.arrayBuffer();
    const decryptedData = await decryptFile(encryptedData, key, fileRecord.encryptionNonce);
    decryptedChunks.push(new Blob([decryptedData]));
  }

  return reassembleChunks(decryptedChunks);
}

export async function getFreshCdnUrl(
  fileId: string,
  chunkIndex: number,
  webhookUrl: string
): Promise<string> {
  const chunkRecords = await getChunksByFileId(fileId);
  const chunk = chunkRecords.find(c => c.chunkIndex === chunkIndex);
  if (!chunk) throw new Error(`Chunk ${chunkIndex} not found for file ${fileId}`);

  if (!isCdnExpired(chunk.cdnUrl)) return chunk.cdnUrl;

  const freshUrl = await refreshCdnUrl(webhookUrl, chunk.messageId);
  chunk.cdnUrl = freshUrl;
  chunk.cdnExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await putChunk(chunk);
  return freshUrl;
}

export async function getFileSize(fileId: string): Promise<number> {
  const file = await getFile(fileId);
  if (!file) throw new Error(`File not found: ${fileId}`);
  return file.size;
}
