export const DEFAULT_CHUNK_SIZE = 8 * 1024 * 1024;

export function getChunkCount(fileSize: number, chunkSize: number = DEFAULT_CHUNK_SIZE): number {
  return Math.ceil(fileSize / chunkSize);
}

export function splitFile(file: File, chunkSize: number = DEFAULT_CHUNK_SIZE): Blob[] {
  const chunks: Blob[] = [];
  let offset = 0;

  while (offset < file.size) {
    const end = Math.min(offset + chunkSize, file.size);
    chunks.push(file.slice(offset, end));
    offset = end;
  }

  return chunks;
}

export function reassembleChunks(chunks: Blob[]): Blob {
  if (chunks.length === 0) return new Blob([]);
  return new Blob(chunks);
}
