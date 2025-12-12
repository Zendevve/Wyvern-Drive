/**
 * Thumbnail generation utilities for Wyvern Drive
 */

const THUMBNAIL_SIZE = 200
const THUMBNAIL_QUALITY = 0.7

// Image extensions
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico']
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'ogv']
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a']
const DOCUMENT_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md']
const CODE_EXTENSIONS = ['js', 'ts', 'tsx', 'jsx', 'py', 'java', 'cpp', 'c', 'h', 'css', 'html', 'json', 'xml']
const ARCHIVE_EXTENSIONS = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2']

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.toLowerCase().split('.')
  return parts.length > 1 ? parts[parts.length - 1] : ''
}

/**
 * Check if file is an image
 */
export function isImageFile(filename: string): boolean {
  return IMAGE_EXTENSIONS.includes(getFileExtension(filename))
}

/**
 * Check if file is a video
 */
export function isVideoFile(filename: string): boolean {
  return VIDEO_EXTENSIONS.includes(getFileExtension(filename))
}

/**
 * Check if file is audio
 */
export function isAudioFile(filename: string): boolean {
  return AUDIO_EXTENSIONS.includes(getFileExtension(filename))
}

/**
 * Check if file is a document
 */
export function isDocumentFile(filename: string): boolean {
  return DOCUMENT_EXTENSIONS.includes(getFileExtension(filename))
}

/**
 * Check if file is code
 */
export function isCodeFile(filename: string): boolean {
  return CODE_EXTENSIONS.includes(getFileExtension(filename))
}

/**
 * Check if file is an archive
 */
export function isArchiveFile(filename: string): boolean {
  return ARCHIVE_EXTENSIONS.includes(getFileExtension(filename))
}

/**
 * Check if file can be previewed
 */
export function isPreviewable(filename: string): boolean {
  return isImageFile(filename) || isVideoFile(filename) || isAudioFile(filename)
}

/**
 * Generate a thumbnail for an image file
 * Returns a base64 data URL
 */
export async function generateImageThumbnail(file: File): Promise<string | null> {
  if (!isImageFile(file.name)) return null

  return new Promise((resolve) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      const img = new Image()

      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          resolve(null)
          return
        }

        // Calculate dimensions maintaining aspect ratio
        let { width, height } = img

        if (width > height) {
          if (width > THUMBNAIL_SIZE) {
            height = (height * THUMBNAIL_SIZE) / width
            width = THUMBNAIL_SIZE
          }
        } else {
          if (height > THUMBNAIL_SIZE) {
            width = (width * THUMBNAIL_SIZE) / height
            height = THUMBNAIL_SIZE
          }
        }

        canvas.width = width
        canvas.height = height

        // Draw with smoothing
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, width, height)

        // Convert to base64
        const thumbnail = canvas.toDataURL('image/jpeg', THUMBNAIL_QUALITY)
        resolve(thumbnail)
      }

      img.onerror = () => resolve(null)
      img.src = e.target?.result as string
    }

    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })
}

/**
 * Generate video thumbnail from first frame
 */
export async function generateVideoThumbnail(file: File): Promise<string | null> {
  if (!isVideoFile(file.name)) return null

  return new Promise((resolve) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)

    video.onloadeddata = () => {
      video.currentTime = 1 // Seek to 1 second for better thumbnail
    }

    video.onseeked = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        URL.revokeObjectURL(url)
        resolve(null)
        return
      }

      // Calculate dimensions
      let { videoWidth: width, videoHeight: height } = video

      if (width > height) {
        if (width > THUMBNAIL_SIZE) {
          height = (height * THUMBNAIL_SIZE) / width
          width = THUMBNAIL_SIZE
        }
      } else {
        if (height > THUMBNAIL_SIZE) {
          width = (width * THUMBNAIL_SIZE) / height
          height = THUMBNAIL_SIZE
        }
      }

      canvas.width = width
      canvas.height = height
      ctx.drawImage(video, 0, 0, width, height)

      const thumbnail = canvas.toDataURL('image/jpeg', THUMBNAIL_QUALITY)
      URL.revokeObjectURL(url)
      resolve(thumbnail)
    }

    video.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }

    video.src = url
    video.load()
  })
}

/**
 * Get MIME type from filename
 */
export function getMimeType(filename: string): string {
  const ext = getFileExtension(filename)

  const mimeTypes: Record<string, string> = {
    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    ico: 'image/x-icon',
    // Video
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
    ogv: 'video/ogg',
    // Audio
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
    aac: 'audio/aac',
    m4a: 'audio/mp4',
    // Documents
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain',
    md: 'text/markdown',
    // Code
    js: 'text/javascript',
    ts: 'text/typescript',
    json: 'application/json',
    xml: 'application/xml',
    html: 'text/html',
    css: 'text/css',
    // Archives
    zip: 'application/zip',
    rar: 'application/vnd.rar',
    '7z': 'application/x-7z-compressed',
    tar: 'application/x-tar',
    gz: 'application/gzip',
  }

  return mimeTypes[ext] || 'application/octet-stream'
}
