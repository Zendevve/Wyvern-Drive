import { downloadFile } from './download';

export const MAX_PREVIEW_SIZE = 500 * 1024 * 1024; // 500MB

export function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

export function isVideoFile(mimeType: string): boolean {
  return mimeType.startsWith('video/');
}

export function isAudioFile(mimeType: string): boolean {
  return mimeType.startsWith('audio/');
}

export function isPdfFile(mimeType: string): boolean {
  return mimeType === 'application/pdf';
}

export function isPreviewable(mimeType: string): boolean {
  return isImageFile(mimeType) || isVideoFile(mimeType) || isAudioFile(mimeType) || isPdfFile(mimeType);
}

export function createMediaBlobUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

export function revokeMediaBlobUrl(url: string): void {
  URL.revokeObjectURL(url);
}

export async function loadMediaBlob(
  fileId: string,
  key: CryptoKey,
  webhookUrl: string
): Promise<Blob> {
  return downloadFile(fileId, key, webhookUrl);
}
