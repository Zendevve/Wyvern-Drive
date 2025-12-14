/**
 * @fileoverview Wyvern File Manager - Core file operations for Wyvern Drive
 *
 * Handles:
 * - File upload/download with chunking (7.5MB or 24MB based on boost level)
 * - Client-side AES-256-GCM encryption
 * - Parallel uploads with round-robin webhook distribution
 * - Folder operations (create, move, delete, download as ZIP)
 * - Version history management
 * - Share link generation
 *
 * Architecture:
 * - Files are split into chunks and uploaded to Discord via webhooks
 * - Chunk metadata (URLs, IVs) stored in Supabase via Edge Function
 * - Encryption is optional, uses password-derived keys with unique salts per file
 */

import {
  CONFIG,
  type WyvernFile,
  type WyvernFolder,
  type UploadOptions,
  type DownloadOptions,
  type ChunkInfo,
  type LegacyChunkInfo,
  type FileVersion,
  type ServerBoostLevel,
  getChunkSizeForBoostLevel,
  normalizeChunk,
  FILE_DELIMITER
} from './types'
import {
  createEncryptionContext,
  restoreEncryptionContext,
  encryptChunk,
  decryptChunk
} from './encryption'
import JSZip from 'jszip'

// Supabase Edge Function API endpoint
const API_URL = 'https://lrqnovltirjsoqfvtxxu.supabase.co/functions/v1/api'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxycW5vdmx0aXJqc29xZnZ0eHh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NzQ0MjcsImV4cCI6MjA4MTE1MDQyN30.rpusoKvKGgWHofrM15aqWMh5F6A8yx78u_n2vgXxm1Q'

/** Build headers for Supabase API requests */
const getHeaders = (contentType: string | null = 'application/json') => {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
  }
  if (contentType) {
    headers['Content-Type'] = contentType
  }
  return headers
}


/**
 * WyvernFileManager - Main class for file operations
 *
 * @example
 * const manager = new WyvernFileManager('user123', ['https://discord.com/api/webhooks/...'])
 * await manager.setPassword('mySecretPassword')
 * const file = await manager.uploadFile(fileBlob, '/path/to/file', null, { encrypt: true })
 */
export class WyvernFileManager {
  private userId: string
  private webhooks: string[]  // Array of webhook URLs for parallel uploads
  private lastWebhookIdx = 0  // Round-robin index
  private webhookUploadCounts: number[] = [] // Track uploads per webhook
  private key: CryptoKey | null = null
  private salt: string | null = null
  private password: string | null = null // Store password for restoring keys with different salts
  private boostLevel: ServerBoostLevel = 'none' // Server boost level for chunk sizing


  constructor(webhookUrls: string | string[], boostLevel: ServerBoostLevel = 'none') {
    // Support both single URL (backwards compat) and array
    this.webhooks = Array.isArray(webhookUrls) ? webhookUrls : [webhookUrls]
    // Initialize upload counters for each webhook
    this.webhookUploadCounts = new Array(this.webhooks.length).fill(0)
    // Simple hash of first webhook URL as userId
    this.userId = this.hashUrl(this.webhooks[0])
    // Store boost level for dynamic chunk sizing
    this.boostLevel = boostLevel
  }

  // Get current chunk size based on server boost level
  getChunkSize(): number {
    return getChunkSizeForBoostLevel(this.boostLevel)
  }

  // Update boost level (e.g., from settings)
  setBoostLevel(level: ServerBoostLevel): void {
    this.boostLevel = level
  }

  // Get webhook pool statistics for UI display
  getWebhookPoolStats(): {
    count: number
    isOptimal: boolean
    recommendation: string | null
    uploadCounts: number[]
  } {
    const count = this.webhooks.length
    const isOptimal = count >= CONFIG.OPTIMAL_WEBHOOKS
    let recommendation: string | null = null

    if (count < CONFIG.MIN_WEBHOOKS_RECOMMENDED) {
      recommendation = `Add ${CONFIG.MIN_WEBHOOKS_RECOMMENDED - count} more webhook(s) for better performance`
    } else if (count < CONFIG.OPTIMAL_WEBHOOKS) {
      recommendation = `Add ${CONFIG.OPTIMAL_WEBHOOKS - count} more webhook(s) for optimal speed`
    }

    return {
      count,
      isOptimal,
      recommendation,
      uploadCounts: [...this.webhookUploadCounts]
    }
  }

  // Round-robin webhook selector with load tracking
  private get nextWebhook(): string {
    const url = this.webhooks[this.lastWebhookIdx]
    this.webhookUploadCounts[this.lastWebhookIdx]++
    this.lastWebhookIdx = (this.lastWebhookIdx + 1) % this.webhooks.length
    return url
  }

  // Initialize encryption for uploading (creates new salt)
  async setPassword(password: string) {
    this.password = password
    const { key, salt } = await createEncryptionContext(password)
    this.key = key
    this.salt = salt
  }

  // Restore encryption key using file's stored salt (for downloading)
  async restoreKeyForFile(fileSalt: string): Promise<CryptoKey> {
    if (!this.password) {
      throw new Error('No password set for decryption')
    }
    return restoreEncryptionContext(this.password, fileSalt)
  }

  private hashUrl(url: string): string {
    let hash = 0
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16)
  }

  // Get streaming URL for video/audio playback with seeking support
  // Includes auth token as query param since <video>/<audio> tags can't send headers
  getStreamUrl(fileId: number): string {
    return `${API_URL}/stream/${this.userId}/${fileId}?apikey=${SUPABASE_ANON_KEY}`
  }

  // Get userId for external use
  getUserId(): string {
    return this.userId
  }

  // --- API Interaction ---

  async fetchFiles(): Promise<WyvernFolder> {
    const res = await fetch(`${API_URL}/files/${this.userId}`, {
      headers: getHeaders()
    })
    if (!res.ok) throw new Error('Failed to fetch files')
    return await res.json()
  }

  async createFile(
    path: string,
    file: File,
    parentId: number | null,
    content: string
  ): Promise<WyvernFile> {
    const payload = {
      name: file.name,
      type: 'file',
      size: file.size,
      parent_id: parentId,
      content, // JSON string of chunk info
      encrypted: !!this.key,
      encryption_salt: this.salt
    }

    console.log(`[WyvernFileManager] Creating file record: ${file.name}, content length: ${content.length}`)

    const res = await fetch(`${API_URL}/files/${this.userId}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    })

    if (!res.ok) {
      let errorMessage = 'Failed to create file record'
      try {
        const errorBody = await res.json()
        if (errorBody.error) {
          errorMessage = errorBody.error
        }
      } catch {
        // Response wasn't JSON
        errorMessage = `Server error (${res.status}): ${res.statusText}`
      }
      console.error(`[WyvernFileManager] createFile failed:`, errorMessage)
      throw new Error(errorMessage)
    }

    const id = await res.json()
    console.log(`[WyvernFileManager] File record created with ID: ${id}`)

    // Return optimistic file object
    return {
      id,
      name: file.name,
      type: 'file',
      size: file.size,
      path: path,
      parent_id: parentId,
      content,
      encrypted: !!this.key,
      encryption_salt: this.salt,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  }

  async deleteFile(id: number): Promise<void> {
    const res = await fetch(`${API_URL}/files/${this.userId}/${id}/recursive`, {
      method: 'DELETE',
      headers: getHeaders()
    })
    if (!res.ok) throw new Error('Failed to delete file')
  }

  async renameFile(id: number, name: string): Promise<void> {
    const res = await fetch(`${API_URL}/files/${this.userId}/${id}/update`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name })
    })
    if (!res.ok) throw new Error('Failed to rename file')
  }

  async moveFile(id: number, parentId: number | null): Promise<void> {
    const res = await fetch(`${API_URL}/files/${this.userId}/${id}/update`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ parent_id: parentId })
    })
    if (!res.ok) throw new Error('Failed to move file')
  }

  async getVersions(fileId: number): Promise<FileVersion[]> {
    const res = await fetch(`${API_URL}/versions/${this.userId}/${fileId}`, {
      headers: getHeaders()
    })
    if (!res.ok) throw new Error('Failed to fetch versions')
    return await res.json()
  }

  async restoreVersion(fileId: number, versionId: number): Promise<void> {
    const res = await fetch(`${API_URL}/versions/${this.userId}/${fileId}/restore/${versionId}`, {
      method: 'POST',
      headers: getHeaders()
    })
    if (!res.ok) throw new Error('Failed to restore version')
  }

  async deleteVersion(fileId: number, versionId: number): Promise<void> {
    const res = await fetch(`${API_URL}/versions/${this.userId}/${fileId}/${versionId}`, {
      method: 'DELETE',
      headers: getHeaders()
    })
    if (!res.ok) throw new Error('Failed to delete version')
  }

  // --- Share Links ---

  async createShareLink(fileId: number, options: { expiresIn?: number; password?: string } = {}): Promise<{ id: string; url: string; expiresAt?: string }> {
    const res = await fetch(`${API_URL}/shares/${this.userId}/${fileId}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        expiresIn: options.expiresIn,
        password: options.password
      })
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to create share link')
    }
    return await res.json()
  }

  async revokeShareLink(shareId: string): Promise<void> {
    const res = await fetch(`${API_URL}/shares/${this.userId}/${shareId}`, {
      method: 'DELETE',
      headers: getHeaders()
    })
    if (!res.ok) throw new Error('Failed to revoke share link')
  }

  // --- Discord Interaction ---

  async uploadFile(
    file: File,
    path: string,
    parentId: number | null,
    options?: UploadOptions
  ): Promise<WyvernFile> {
    const totalSize = file.size
    const chunkSize = this.getChunkSize() // Dynamic based on server boost level
    const totalChunks = Math.ceil(totalSize / chunkSize)
    const chunks: ChunkInfo[] = new Array(totalChunks)

    let uploadedBytes = 0

    // Dynamic concurrency: use higher concurrency for large files with multiple webhooks
    const baseConcurrency = totalSize >= CONFIG.LARGE_FILE_THRESHOLD
      ? CONFIG.LARGE_FILE_CONCURRENCY
      : CONFIG.SMALL_FILE_CONCURRENCY
    // Scale by webhook count: more webhooks = can handle more parallel uploads
    const concurrency = Math.min(
      baseConcurrency * Math.ceil(this.webhooks.length / 2),
      CONFIG.MAX_PARALLEL_UPLOADS * this.webhooks.length
    )

    // Helper to upload a single chunk
    const uploadChunk = async (index: number): Promise<void> => {
      const start = index * chunkSize
      const end = Math.min(start + chunkSize, totalSize)
      const chunkBlob = file.slice(start, end)
      let chunkData = await chunkBlob.arrayBuffer()

      let iv: Uint8Array | undefined

      if (this.key && options?.encrypt) {
        const encrypted = await encryptChunk(chunkData, this.key)
        chunkData = encrypted.data
        iv = encrypted.iv
      }

      // Keep the chunk data for retries
      const chunkBuffer = chunkData

      // Retry logic
      let attempts = 0
      let messageId: string | null = null
      let attachmentUrl: string | null = null

      while (attempts < CONFIG.RETRY_ATTEMPTS && (!messageId || !attachmentUrl)) {
        try {
          // Create fresh FormData and Blob for each attempt (blobs are consumed on use)
          const formData = new FormData()
          formData.append('file', new Blob([chunkBuffer]), `chunk_${index}`)

          const webhookUrl = this.nextWebhook // Round-robin
          const res = await fetch(webhookUrl, {
            method: 'POST',
            body: formData
          })

          if (res.ok) {
            const data = await res.json()
            messageId = data.id
            if (data.attachments && data.attachments.length > 0) {
              attachmentUrl = data.attachments[0].url
            }
          } else {
            // Rate limit handling
            if (res.status === 429) {
              const retryAfter = parseInt(res.headers.get('Retry-After') || '1') * 1000
              await new Promise(r => setTimeout(r, retryAfter))
            }
            throw new Error(`Discord upload failed: ${res.status}`)
          }
        } catch (e) {
          attempts++
          await new Promise(r => setTimeout(r, CONFIG.RETRY_DELAY_BASE * Math.pow(2, attempts)))
          if (attempts === CONFIG.RETRY_ATTEMPTS) throw e
        }
      }

      if (!messageId || !attachmentUrl) throw new Error('Failed to upload chunk or get attachment URL')

      // Use compact format for chunk metadata (short keys)
      chunks[index] = {
        i: index,              // index
        u: attachmentUrl,      // url
        s: chunkBuffer.byteLength,  // size
        v: iv ? Array.from(iv) : undefined  // iv (optional)
      }

      uploadedBytes += chunkBlob.size
      options?.onProgress?.(uploadedBytes, totalSize)
    }

    // Process chunks in parallel batches with dynamic concurrency
    for (let i = 0; i < totalChunks; i += concurrency) {
      const batchIndices = []
      for (let j = i; j < Math.min(i + concurrency, totalChunks); j++) {
        batchIndices.push(j)
      }
      await Promise.all(batchIndices.map(uploadChunk))
    }

    // Save metadata to server
    return this.createFile(path, file, parentId, JSON.stringify(chunks))
  }

  // --- Folder Interaction ---

  async uploadFolder(
    files: FileList,
    parentId: number | null,
    options?: UploadOptions
  ): Promise<void> {
    // 1. Group files by relative path
    const fileEntries: { file: File; path: string }[] = []

    for (let i = 0; i < files.length; i++) {
      fileEntries.push({ file: files[i], path: files[i].webkitRelativePath || files[i].name })
    }

    // 2. Create directory structure and upload files
    const dirCache = new Map<string, number>()
    if (parentId !== null) dirCache.set('', parentId)

    const createDirectory = async (name: string, pId: number | null): Promise<number> => {
      const res = await fetch(`${API_URL}/files/${this.userId}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          name,
          type: 'directory',
          size: 0,
          parent_id: pId,
          content: null,
          encrypted: 0,
          encryption_salt: null
        })
      })
      if (!res.ok) throw new Error('Failed to create directory')
      return await res.json()
    }

    const ensureDirReal = async (path: string): Promise<number | null> => {
      if (dirCache.has(path)) return dirCache.get(path)!
      if (path === '' || path === '.') return parentId

      const lastSlash = path.lastIndexOf(FILE_DELIMITER)
      const parentPath = lastSlash === -1 ? '' : path.substring(0, lastSlash)
      const dirName = path.substring(lastSlash + 1)

      const pId = await ensureDirReal(parentPath)
      const newId = await createDirectory(dirName, pId)

      dirCache.set(path, newId)
      return newId
    }

    // 3. Process files
    let processed = 0
    const totalFiles = fileEntries.length

    for (const entry of fileEntries) {
      const fullPath = entry.path
      const lastSlash = fullPath.lastIndexOf(FILE_DELIMITER)
      const dirPath = lastSlash === -1 ? '' : fullPath.substring(0, lastSlash)

      const pId = await ensureDirReal(dirPath)

      await this.uploadFile(entry.file, fullPath, pId, {
        ...options,
        onProgress: () => {
          // Individual file progress ignored
        }
      })

      processed++
      options?.onProgress?.(processed, totalFiles)
    }
  }

  // --- Download Interaction ---

  async downloadFile(file: WyvernFile, options?: DownloadOptions): Promise<void> {
    if (!file.content) throw new Error('File has no content map')

    // Parse chunks
    let chunks: ChunkInfo[]
    try {
      chunks = JSON.parse(file.content)
    } catch (e) {
      throw new Error('Invalid file content map')
    }

    if (!Array.isArray(chunks)) throw new Error('Invalid chunk data')

    // Sort chunks by index (normalize first for backward compat)
    const normalizedChunks = chunks.map((c: ChunkInfo | LegacyChunkInfo) => normalizeChunk(c))
    normalizedChunks.sort((a, b) => a.i - b.i)

    // Check encryption and restore key with file's salt
    const isEncrypted = file.encrypted
    let decryptionKey: CryptoKey | null = null

    if (isEncrypted) {
      if (!this.password) {
        throw new Error('File is encrypted but no password provided')
      }
      if (!file.encryption_salt) {
        throw new Error('File is encrypted but missing salt - file may be corrupted')
      }
      // Restore key using the file's original salt
      decryptionKey = await this.restoreKeyForFile(file.encryption_salt)
    }

    // Prepare for download aggregation
    const fileParts: ArrayBuffer[] = new Array(normalizedChunks.length)
    let downloadedBytes = 0
    const totalSize = normalizedChunks.reduce((acc, c) => acc + c.s, 0) // Encrypted size

    // Process chunks in parallel batches
    const batchSize = CONFIG.MAX_PARALLEL_DOWNLOADS
    for (let i = 0; i < normalizedChunks.length; i += batchSize) {
      const batch = normalizedChunks.slice(i, i + batchSize)

      await Promise.all(batch.map(async (chunk) => {
        if (!chunk.u) throw new Error('Missing chunk URL')

        // Fetch via extension to bypass CORS
        let data = await this.fetchViaExtension(chunk.u)

        // Decrypt if needed
        if (isEncrypted && decryptionKey) {
          if (!chunk.v) throw new Error('Missing IV for encrypted chunk')
          const iv = new Uint8Array(chunk.v)
          data = await decryptChunk(data, decryptionKey, iv)
        }

        fileParts[chunk.i] = data
        downloadedBytes += chunk.s
        options?.onProgress?.(downloadedBytes, totalSize)
      }))
    }

    // Combine parts
    const blob = new Blob(fileParts)

    // Create download link
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  async downloadFolder(folderId: number, folderName: string, options?: DownloadOptions): Promise<void> {
    // 1. Fetch entire file tree to traverse (or just use what we have in store, but manager shouldn't rely on store state ideally)
    // For now, let's fetch fresh tree to be sure.
    const root = await this.fetchFiles()

    // 2. Find target folder
    // Tree traversal to find node with id = folderId
    const findNode = (node: WyvernFolder): WyvernFolder | null => {
      if (node.id === folderId) return node
      if (node.children) {
        for (const child of Object.values(node.children)) {
          // child is File or Folder. Folder has children.
          if (child.type === 'directory') {
            const found = findNode(child as WyvernFolder)
            if (found) return found
          }
        }
      }
      return null
    }

    const targetFolder = findNode(root)
    if (!targetFolder) throw new Error('Folder not found')

    // 3. Collect all files to download
    const filesToDownload: { file: WyvernFile; relativePath: string }[] = []

    const traverse = (node: WyvernFolder, currentPath: string) => {
      for (const child of Object.values(node.children || {})) {
        if (child.type === 'file') {
          filesToDownload.push({
            file: child as WyvernFile,
            relativePath: currentPath ? `${currentPath}/${child.name}` : child.name
          })
        } else if (child.type === 'directory') {
          traverse(child as WyvernFolder, currentPath ? `${currentPath}/${child.name}` : child.name)
        }
      }
    }

    traverse(targetFolder, '') // Start traversal from inside the folder

    if (filesToDownload.length === 0) {
      throw new Error('Folder is empty')
    }

    // 4. Download and Zip
    const zip = new JSZip()
    let processed = 0
    const totalFiles = filesToDownload.length

    // Process files in parallel batches
    const batchSize = CONFIG.MAX_PARALLEL_DOWNLOADS
    for (let i = 0; i < filesToDownload.length; i += batchSize) {
      const batch = filesToDownload.slice(i, i + batchSize)

      await Promise.all(batch.map(async ({ file, relativePath }) => {
        try {
          // Determine file mode (encrypted?)
          // Assuming reuse downloadFile logic but return buffer instead of saving?
          // Refactoring downloadFile to separate 'fetchContent' would be cleaner.
          // But `downloadFile` does aggregation of chunks.

          // Let's implement fetch content logic inline similar to downloadFile
          if (!file.content) return // Skip empty files?

          const chunks: (ChunkInfo | LegacyChunkInfo)[] = JSON.parse(file.content)
          const normalizedChunks = chunks.map(c => normalizeChunk(c))
          normalizedChunks.sort((a, b) => a.i - b.i)

          // Fetch chunks
          const fileParts: ArrayBuffer[] = new Array(normalizedChunks.length)

          // Fetch chunks serial or parallel?
          // Inside a batch of files, we are already parallel.
          // Let's do serial chunks for simplicity within a file in ZIP mode to avoid overloading
          // OR parallel chunks but with limit.

          for (const chunk of normalizedChunks) {
            let data = await this.fetchViaExtension(chunk.u)
            if (file.encrypted && this.key && chunk.v) {
              const iv = new Uint8Array(chunk.v)
              data = await decryptChunk(data, this.key, iv)
            }
            fileParts[chunk.i] = data
          }

          const fileBlob = new Blob(fileParts)
          zip.file(relativePath, fileBlob)

          processed++
          options?.onProgress?.(processed, totalFiles) // Progress by file count for zip

        } catch (e) {
          console.error(`Failed to download ${relativePath}`, e)
          zip.file(`${relativePath}.error.txt`, `Failed to download: ${e}`)
        }
      }))
    }

    // 5. Generate ZIP
    const zipBlob = await zip.generateAsync({ type: 'blob' })

    // 6. Save
    const url = URL.createObjectURL(zipBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${folderName}.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // --- Extension Interaction ---

  // Helper to fetch via extension to bypass CORS
  private async fetchViaExtension(url: string): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const requestId = Math.random().toString(36).substring(7)

      const handleResponse = (event: MessageEvent) => {
        if (event.source !== window) return
        if (event.data.type === 'WYVERN_DOWNLOAD_RESPONSE' && event.data.id === requestId) {
          window.removeEventListener('message', handleResponse)

          if (event.data.error) {
            reject(new Error(event.data.error))
          } else if (event.data.data) {
            // Data is Data URL (base64)
            fetch(event.data.data)
              .then(res => res.arrayBuffer())
              .then(resolve)
              .catch(reject)
          } else {
            reject(new Error('Empty response from extension'))
          }
        }
      }

      window.addEventListener('message', handleResponse)

      // Send request
      window.postMessage({
        type: 'WYVERN_DOWNLOAD_REQUEST',
        url,
        id: requestId
      }, '*')

      // Timeout
      setTimeout(() => {
        window.removeEventListener('message', handleResponse)
        reject(new Error('Extension download timeout - is extension installed?'))
      }, 60000)
    })
  }

}
