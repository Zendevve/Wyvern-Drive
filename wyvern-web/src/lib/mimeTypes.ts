/**
 * Centralized MIME type definitions for Wyvern Drive.
 * Covers a wide range of audio/video formats to maximize browser compatibility.
 */

export function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (!ext) return 'application/octet-stream'

  const types: Record<string, string> = {
    // Video Formats
    'mp4': 'video/mp4',
    'm4v': 'video/mp4',
    'webm': 'video/webm',
    'ogv': 'video/ogg',
    'mov': 'video/quicktime',   // Often works in Chrome/Safari if H.264
    'avi': 'video/x-msvideo',   // Rare support (maybe MJPEG)
    'wmv': 'video/x-ms-wmv',    // Rare support
    'flv': 'video/x-flv',       // Rare support
    'mkv': 'video/x-matroska',  // Works if internal codecs are supported (VP9/AV1/H.264)
    '3gp': 'video/3gpp',
    'ts': 'video/mp2t',
    'mts': 'video/mp2t',
    'm2ts': 'video/mp2t',

    // Audio Formats
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'oga': 'audio/ogg',
    'aac': 'audio/aac',         // Native in most browsers
    'm4a': 'audio/mp4',         // Native in most browsers
    'm4b': 'audio/mp4',         // Audiobooks (MPEG-4 Audio)
    'flac': 'audio/flac',       // Native in modern Chrome/FF/Edge
    'weba': 'audio/webm',
    'opus': 'audio/opus',
    'alac': 'audio/alac',       // Safari mainly
    'wma': 'audio/x-ms-wma',    // Unlikely
    'mid': 'audio/midi',
    'midi': 'audio/midi'
  }

  return types[ext] || 'application/octet-stream'
}

export function isMediaFile(filename: string): boolean {
  const mime = getMimeType(filename)
  return mime.startsWith('video/') || mime.startsWith('audio/')
}
