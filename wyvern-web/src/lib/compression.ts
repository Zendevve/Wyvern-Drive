/**
 * @fileoverview Compression utilities for Wyvern Drive
 *
 * Uses the browser's native CompressionStream API (gzip) for efficient
 * compression before upload. Falls back gracefully if not available.
 */

/**
 * Check if compression is available in this browser
 */
export function isCompressionSupported(): boolean {
  return typeof CompressionStream !== 'undefined'
}

/**
 * Compress data using gzip
 * @param data - ArrayBuffer to compress
 * @returns Compressed ArrayBuffer
 */
export async function compressData(data: ArrayBuffer): Promise<ArrayBuffer> {
  if (!isCompressionSupported()) {
    console.warn('[Compression] CompressionStream not available, skipping compression')
    return data
  }

  const stream = new Response(data).body!
    .pipeThrough(new CompressionStream('gzip'))

  const compressed = await new Response(stream).arrayBuffer()

  // Only use compression if it actually reduces size
  if (compressed.byteLength < data.byteLength) {
    const ratio = ((1 - compressed.byteLength / data.byteLength) * 100).toFixed(1)
    console.log(`[Compression] ${formatBytes(data.byteLength)} → ${formatBytes(compressed.byteLength)} (${ratio}% reduction)`)
    return compressed
  }

  // Already compressed data (images, videos) may get larger
  console.log('[Compression] Skipped (compression increased size)')
  return data
}

/**
 * Decompress gzip data
 * @param data - Compressed ArrayBuffer
 * @returns Decompressed ArrayBuffer
 */
export async function decompressData(data: ArrayBuffer): Promise<ArrayBuffer> {
  if (!isCompressionSupported()) {
    console.warn('[Compression] DecompressionStream not available')
    return data
  }

  try {
    const stream = new Response(data).body!
      .pipeThrough(new DecompressionStream('gzip'))

    return await new Response(stream).arrayBuffer()
  } catch (e) {
    // Not gzip compressed, return as-is
    return data
  }
}

/**
 * Check if a file type is compressible
 * Already compressed formats (images, videos, archives) won't benefit from gzip
 */
export function isCompressibleFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || ''

  // These formats are already compressed
  const incompressible = new Set([
    // Images
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'heic',
    // Videos
    'mp4', 'webm', 'mkv', 'avi', 'mov', 'm4v',
    // Audio
    'mp3', 'aac', 'ogg', 'flac', 'm4a', 'opus',
    // Archives
    'zip', 'rar', '7z', 'gz', 'bz2', 'xz', 'tar',
    // Documents (already compressed)
    'pdf', 'docx', 'xlsx', 'pptx'
  ])

  return !incompressible.has(ext)
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}
