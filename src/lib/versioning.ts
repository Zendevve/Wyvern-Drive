import { getFile, putFile, getChunksByFileId } from './db';
import { uploadFile } from './upload';
import type { FileVersion } from '../types';

export async function createVersion(
  fileId: string,
  file: File,
  key: CryptoKey,
  webhookUrl: string,
  onProgress?: (progress: { fileId: string; completedChunks: number; status: string }) => void
): Promise<void> {
  const existing = await getFile(fileId);
  if (!existing) throw new Error('File not found');

  const newRecord = await uploadFile(file, key, webhookUrl, onProgress);
  const chunks = await getChunksByFileId(newRecord.id);

  const version: FileVersion = {
    version: existing.versionHistory.length + 1,
    timestamp: new Date(),
    chunkRefs: chunks.map(c => c.id),
    checksum: newRecord.checksum,
  };

  existing.versionHistory.push(version);
  existing.version = version.version;
  existing.updatedAt = new Date();
  await putFile(existing);
}

export async function restoreVersion(
  fileId: string,
  versionNumber: number,
  _key: CryptoKey,
  _webhookUrl: string
): Promise<void> {
  const file = await getFile(fileId);
  if (!file) throw new Error('File not found');
  const version = file.versionHistory.find(v => v.version === versionNumber);
  if (!version) throw new Error('Version not found');

  const newVersion: FileVersion = {
    version: file.versionHistory.length + 1,
    timestamp: new Date(),
    chunkRefs: version.chunkRefs,
    checksum: version.checksum,
  };
  file.versionHistory.push(newVersion);
  file.version = newVersion.version;
  file.updatedAt = new Date();
  await putFile(file);
}

export async function getVersions(fileId: string): Promise<FileVersion[]> {
  const file = await getFile(fileId);
  return file?.versionHistory ?? [];
}
