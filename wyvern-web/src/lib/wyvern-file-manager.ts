import {
  CONFIG,
  type WyvernFile,
  type WyvernFolder,
  type UploadOptions,
  type DownloadOptions,
  type ChunkInfo,
  type FileVersion,
  FILE_DELIMITER
} from './types'
import {
  createEncryptionContext,
  restoreEncryptionContext,
  encryptChunk,
  decryptChunk
} from './encryption'
import JSZip from 'jszip'

const API_URL = 'http://localhost:8080'

export class WyvernFileManager {
  private userId: string
  private webhookUrl: string
  private key: CryptoKey | null = null
  private salt: string | null = null
  private password: string | null = null // Store password for restoring keys with different salts

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl
    // Simple hash of webhook URL as userId for now
    this.userId = this.hashUrl(webhookUrl)
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
      parent_id: parentId,
      content,
      encrypted: !!this.key,
      encryption_salt: this.salt,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  }

  async deleteFile(id: number): Promise<void> {
    const res = await fetch(`${API_URL}/files/delete-recursive/${this.userId}/${id}`, {
      method: 'DELETE'
    })
    if (!res.ok) throw new Error('Failed to delete file')
  }

  async renameFile(id: number, name: string): Promise<void> {
    const res = await fetch(`${API_URL}/files/update/${this.userId}/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    })
    if (!res.ok) throw new Error('Failed to rename file')
  }

  async moveFile(id: number, parentId: number | null): Promise<void> {
    const res = await fetch(`${API_URL}/files/update/${this.userId}/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parent_id: parentId })
    })
    if (!res.ok) throw new Error('Failed to move file')
  }

  async getVersions(fileId: number): Promise<FileVersion[]> {
    const res = await fetch(`${API_URL}/files/versions/${this.userId}/${fileId}`)
    if (!res.ok) throw new Error('Failed to fetch versions')
    return await res.json()
  }

  async restoreVersion(versionId: number): Promise<void> {
    const res = await fetch(`${API_URL}/files/restore/${this.userId}/${versionId}`, {
      method: 'POST'
    })
    if (!res.ok) throw new Error('Failed to restore version')
  }

  async deleteVersion(versionId: number): Promise<void> {
    const res = await fetch(`${API_URL}/files/versions/${this.userId}/${versionId}`, {
      method: 'DELETE'
    })
    if (!res.ok) throw new Error('Failed to delete version')
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
      let attachmentUrl: string | null = null

      while (attempts < CONFIG.RETRY_ATTEMPTS && (!messageId || !attachmentUrl)) {
        try {
          const res = await fetch(this.webhookUrl, {
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

      chunks.push({
        index: i,
        messageId,
        url: attachmentUrl,
        size: chunkData.byteLength,
        iv: iv ? Array.from(iv) : undefined // Store IV if encrypted
      })

      uploadedBytes += chunkBlob.size
      options?.onProgress?.(uploadedBytes, totalSize)
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
      const res = await fetch(`${API_URL}/files/create/${this.userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

    // Sort chunks by index
    chunks.sort((a, b) => a.index - b.index)

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
    const fileParts: ArrayBuffer[] = new Array(chunks.length)
    let downloadedBytes = 0
    const totalSize = chunks.reduce((acc, c) => acc + c.size, 0) // Encrypted size

    // Process chunks in parallel batches
    const batchSize = CONFIG.MAX_PARALLEL_DOWNLOADS
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize)

      await Promise.all(batch.map(async (chunk) => {
        if (!chunk.url) throw new Error('Missing chunk URL')

        // Fetch via extension to bypass CORS
        let data = await this.fetchViaExtension(chunk.url)

        // Decrypt if needed
        if (isEncrypted && decryptionKey) {
          if (!chunk.iv) throw new Error('Missing IV for encrypted chunk')
          const iv = new Uint8Array(chunk.iv)
          data = await decryptChunk(data, decryptionKey, iv)
        }

        fileParts[chunk.index] = data
        downloadedBytes += chunk.size
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

          const chunks: ChunkInfo[] = JSON.parse(file.content)
          chunks.sort((a, b) => a.index - b.index)

          // Fetch chunks
          const fileParts: ArrayBuffer[] = new Array(chunks.length)

          // Fetch chunks serial or parallel?
          // Inside a batch of files, we are already parallel.
          // Let's do serial chunks for simplicity within a file in ZIP mode to avoid overloading
          // OR parallel chunks but with limit.

          for (const chunk of chunks) {
            let data = await this.fetchViaExtension(chunk.url)
            if (file.encrypted && this.key && chunk.iv) {
              const iv = new Uint8Array(chunk.iv)
              data = await decryptChunk(data, this.key, iv)
            }
            fileParts[chunk.index] = data
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
