export interface UploadChunk {
  index: number;
  url: string;
  size: number;
}

export interface UploadResult {
  filename: string;
  mimeType: string;
  size: number;
  chunks: UploadChunk[];
}

export interface UploadHandle {
  abort: () => void;
}

export function uploadFile(
  file: File,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal
): { promise: Promise<UploadResult>; handle: UploadHandle } {
  const xhr = new XMLHttpRequest();
  const form = new FormData();
  form.append('file', file, file.name);
  xhr.open('POST', '/api/upload');

  xhr.upload.onprogress = (event) => {
    if (event.lengthComputable && onProgress) {
      onProgress(Math.round((event.loaded / event.total) * 100));
    }
  };

  const promise = new Promise<UploadResult>((resolve, reject) => {
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as UploadResult);
        } catch {
          reject(new Error('Invalid JSON response from /upload'));
        }
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.onabort = () => reject(new Error('Upload cancelled'));
    xhr.send(form);
  });

  if (signal) {
    if (signal.aborted) {
      xhr.abort();
    } else {
      signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }
  }

  return {
    promise,
    handle: { abort: () => xhr.abort() }
  };
}

export function extractMessageIdFromUrl(url: string): string {
  const match = url.match(/\/attachments\/\d+\/([a-zA-Z0-9_-]+)/);
  if (!match) {
    throw new Error('Could not extract message ID from Discord attachment URL');
  }
  return match[1];
}
