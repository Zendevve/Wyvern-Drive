import {
  CONFIG,
  type WyvernFile,
  type WyvernFolder,
  type UploadOptions,
  type DownloadOptions,
  type ChunkInfo,
  FILE_DELIMITER
} from './types'
import {
  createEncryptionContext,
  encryptChunk,
  decryptChunk,
  restoreEncryptionContext
} from './encryption'
import JSZip from 'jszip'

const API_URL = 'http://localhost:8080'

export class WyvernFileManager {
  private userId: string
  private webhookUrl: string
  private key: CryptoKey | null = null
  private salt: string | null = null

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl
    // Simple hash of webhook URL as userId for now
    this.userId = this.hashUrl(webhookUrl)
  }

  // Initialize encryption
  async setPassword(password: string) {
    const { key, salt } = await createEncryptionContext(password)
    this.key = key
    this.salt = salt
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

  // --- API Interaction ---

  async fetchFiles(): Promise<WyvernFolder> {
    const res = await fetch(`${API_URL}/files/get/${this.userId}`)
    if (!res.ok) throw new Error('Failed to fetch files')
    return await res.json()
  }

  async createFile(
    path: string,
    file: File,
    parentId: number | null,
    content: string
  ): Promise<WyvernFile> {
    const res = await fetch(`${API_URL}/files/create/${this.userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: file.name,
        type: 'file',
        size: file.size,
        parent_id: parentId,
        content, // JSON string of message IDs
        encrypted: !!this.key,
        encryption_salt: this.salt
      })
    })

    if (!res.ok) throw new Error('Failed to create file record')
    const id = await res.json()

    // Return optimistic file object (re-fetching is better but this update is immediate)
    return {
      id,
      name: file.name,
      type: 'file',
      size: file.size,
      path: path, // Note: backend doesn't store full path, frontend constructs it
      parentId,
      content,
      encrypted: !!this.key,
      encryptionIv: '', // TODO: Handle IV per chunk or file?
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  }

  // --- Discord Interaction ---

  async uploadFile(
    file: File,
    path: string,
    parentId: number | null,
    options?: UploadOptions
  ): Promise<WyvernFile> {
    const chunks: ChunkInfo[] = []
    const totalSize = file.size
    const chunkSize = CONFIG.CHUNK_SIZE_DEFAULT
    const totalChunks = Math.ceil(totalSize / chunkSize)

    let uploadedBytes = 0

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize
      const end = Math.min(start + chunkSize, totalSize)
      const chunkBlob = file.slice(start, end)
      let chunkData = await chunkBlob.arrayBuffer()

      let iv: Uint8Array | undefined

      if (this.key && options?.encrypt) {
        const encrypted = await encryptChunk(chunkData, this.key)
        chunkData = encrypted.data
        iv = encrypted.iv
      }

      // Upload to Discord
      const formData = new FormData()
      formData.append('file', new Blob([chunkData]), `chunk_${i}`)

      // Retry logic
      let attempts = 0
      let messageId: string | null = null

      while (attempts < CONFIG.RETRY_ATTEMPTS && !messageId) {
        try {
          const res = await fetch(this.webhookUrl, {
            method: 'POST',
            body: formData
          })

          if (res.ok) {
            const data = await res.json()
            messageId = data.id
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

      if (!messageId) throw new Error('Failed to upload chunk after retries')

      chunks.push({
        index: i,
        messageId,
        size: chunkData.byteLength
      })

      uploadedBytes += chunkBlob.size
      options?.onProgress?.(uploadedBytes, totalSize)
    }

    // Save metadata to server
    return this.createFile(path, file, parentId, JSON.stringify(chunks))
  }

  // --- Extension Interaction ---

  // Helper to fetch via extension to bypass CORS
  private async fetchViaExtension(url: string): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      // Need extension ID. For now assuming locally installed or standard ID.
      // Since 'externally_connectable' is used, we can just send message if we know ID.
      // Or use window.postMessage if content script is injected.
      // But content script approach is better for general web pages.
      // Wait... chrome.runtime.sendMessage from web page requires extension ID.
      // 'externally_connectable' allows web page to send message.

      // For development, we might not have a fixed ID.
      // Strategy: The extension background script listens to external messages.
      // We need the extension ID.
      // Let's assume user installs it and we put ID in config or try-catch multiple?
      // Actually, Disbox used a specific ID. We should probably generate one or instruct user.
      // For now, let's assume we can use a proxy fallback if extension missing.

      // Placeholder: assuming we have an ID or use a different method.
      // Since we are in local dev, 'externally_connectable' matches localhost.
      // We need the ID.
      // Let's try to detect it or use a known one.

      // For this MVP step, I'll log. Proper implementation needs the ID.
      // I'll update manifest to use a fixed key if possible, or just ask user to input ID?
      // Or simpler: fetch directly if CORS allows (it doesn't for Discord CDN).

      reject(new Error('Extension integration not fully configured without ID'))
    })
  }

}
