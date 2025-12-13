// File type to icon mapping - returns Lucide icon name
export function getFileIconName(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const iconMap: Record<string, string> = {
    // Documents
    pdf: 'FileText',
    doc: 'FileText',
    docx: 'FileText',
    txt: 'FileText',
    // Images
    jpg: 'Image',
    jpeg: 'Image',
    png: 'Image',
    gif: 'Image',
    webp: 'Image',
    svg: 'Image',
    // Audio
    mp3: 'Music',
    wav: 'Music',
    flac: 'Music',
    ogg: 'Music',
    // Video
    mp4: 'Video',
    mkv: 'Video',
    avi: 'Video',
    mov: 'Video',
    // Archives
    zip: 'Archive',
    rar: 'Archive',
    '7z': 'Archive',
    tar: 'Archive',
    // Code
    js: 'Code',
    ts: 'Code',
    py: 'Code',
    rs: 'Code',
    // Executables
    exe: 'Cog',
    msi: 'Cog',
  }
  return iconMap[ext] || 'File'
}

// Legacy function for backwards compatibility - returns empty string
// Components should use Lucide icons directly
export function getFileIcon(_filename: string): string {
  return ''
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function formatDate(isoDate: string): string {
  if (!isoDate) return ''
  return new Date(isoDate).toLocaleDateString()
}
