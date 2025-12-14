/**
 * @fileoverview Upload State Manager - Persist partial upload state for resume
 *
 * Uses IndexedDB to track:
 * - Pending uploads (started but not completed)
 * - Uploaded chunks for each pending upload
 * - Enables resuming interrupted uploads
 */

import type { ChunkInfo } from './types'

const DB_NAME = 'wyvern-uploads'
const DB_VERSION = 1
const STORE_NAME = 'pending-uploads'

/**
 * Pending upload state
 */
export interface PendingUpload {
  id: string                    // Unique upload ID
  fileName: string
  fileSize: number
  filePath: string
  parentId: number | null
  totalChunks: number
  uploadedChunks: ChunkInfo[]   // Chunks successfully uploaded
  options: {
    encrypt: boolean
    compress: boolean
  }
  createdAt: number
  lastUpdatedAt: number
}

/**
 * Generate a unique upload ID based on file properties
 */
export function generateUploadId(fileName: string, fileSize: number): string {
  return `${fileName}_${fileSize}_${Date.now()}`
}

/**
 * Open IndexedDB connection
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('fileName', 'fileName', { unique: false })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }
  })
}

/**
 * Save or update a pending upload
 */
export async function savePendingUpload(upload: PendingUpload): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)

    upload.lastUpdatedAt = Date.now()
    const request = store.put(upload)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()

    tx.oncomplete = () => db.close()
  })
}

/**
 * Update a single chunk's upload status
 */
export async function addUploadedChunk(uploadId: string, chunk: ChunkInfo): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)

    const getRequest = store.get(uploadId)

    getRequest.onsuccess = () => {
      const upload = getRequest.result as PendingUpload | undefined
      if (!upload) {
        reject(new Error('Upload not found'))
        return
      }

      // Check if chunk already exists (by index)
      const existingIndex = upload.uploadedChunks.findIndex(c => c.i === chunk.i)
      if (existingIndex >= 0) {
        upload.uploadedChunks[existingIndex] = chunk
      } else {
        upload.uploadedChunks.push(chunk)
      }

      upload.lastUpdatedAt = Date.now()
      store.put(upload)
      resolve()
    }

    getRequest.onerror = () => reject(getRequest.error)
    tx.oncomplete = () => db.close()
  })
}

/**
 * Get all pending uploads
 */
export async function getPendingUploads(): Promise<PendingUpload[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.getAll()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const uploads = request.result as PendingUpload[]
      // Filter out old uploads (>7 days)
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
      const recent = uploads.filter(u => u.lastUpdatedAt > sevenDaysAgo)
      resolve(recent)
    }

    tx.oncomplete = () => db.close()
  })
}

/**
 * Get a specific pending upload
 */
export async function getPendingUpload(id: string): Promise<PendingUpload | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(id)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result || null)

    tx.oncomplete = () => db.close()
  })
}

/**
 * Delete a pending upload (on completion or cancel)
 */
export async function deletePendingUpload(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.delete(id)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()

    tx.oncomplete = () => db.close()
  })
}

/**
 * Find a pending upload by file properties (for resume detection)
 */
export async function findPendingUpload(fileName: string, fileSize: number): Promise<PendingUpload | null> {
  const uploads = await getPendingUploads()
  return uploads.find(u => u.fileName === fileName && u.fileSize === fileSize) || null
}

/**
 * Clear all pending uploads (for debugging/reset)
 */
export async function clearAllPendingUploads(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.clear()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()

    tx.oncomplete = () => db.close()
  })
}
