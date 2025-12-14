/**
 * Crypto Worker Pool - Manages multiple Web Workers for parallel encryption
 *
 * Uses a pool of workers to encrypt/decrypt multiple chunks simultaneously,
 * maximizing CPU utilization on multi-core systems.
 */

// Number of workers in pool (matches typical CPU cores)
const POOL_SIZE = navigator.hardwareConcurrency || 4

interface PendingTask {
  resolve: (result: { data: ArrayBuffer; iv?: number[] }) => void
  reject: (error: Error) => void
}

class CryptoWorkerPool {
  private workers: Worker[] = []
  private taskQueue: Array<{
    type: 'encrypt' | 'decrypt'
    data: ArrayBuffer
    keyData: JsonWebKey
    iv?: number[]
    resolve: (result: { data: ArrayBuffer; iv?: number[] }) => void
    reject: (error: Error) => void
  }> = []
  private workerBusy: boolean[] = []
  private pendingTasks = new Map<number, PendingTask>()
  private taskIdCounter = 0
  private initialized = false
  private initPromise: Promise<void> | null = null

  constructor() {
    // Don't initialize until first use
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return
    if (this.initPromise) return this.initPromise

    this.initPromise = new Promise<void>((resolve) => {
      let readyCount = 0

      for (let i = 0; i < POOL_SIZE; i++) {
        // Create worker from the worker file
        const worker = new Worker(
          new URL('./crypto-worker.ts', import.meta.url),
          { type: 'module' }
        )

        worker.onmessage = (event) => {
          const msg = event.data

          if (msg.type === 'loaded' || msg.type === 'ready') {
            readyCount++
            if (readyCount === POOL_SIZE) {
              this.initialized = true
              resolve()
            }
            return
          }

          if (msg.type === 'encrypted' || msg.type === 'decrypted') {
            const task = this.pendingTasks.get(msg.id)
            if (task) {
              this.pendingTasks.delete(msg.id)
              task.resolve({ data: msg.data, iv: msg.iv })
            }
            this.workerBusy[i] = false
            this.processQueue(i)
            return
          }

          if (msg.type === 'error') {
            const task = this.pendingTasks.get(msg.id)
            if (task) {
              this.pendingTasks.delete(msg.id)
              task.reject(new Error(msg.error))
            }
            this.workerBusy[i] = false
            this.processQueue(i)
            return
          }
        }

        worker.onerror = (error) => {
          console.error('[CryptoWorkerPool] Worker error:', error)
        }

        this.workers.push(worker)
        this.workerBusy.push(false)
      }
    })

    return this.initPromise
  }

  private processQueue(workerIndex: number): void {
    if (this.taskQueue.length === 0) return
    if (this.workerBusy[workerIndex]) return

    const task = this.taskQueue.shift()!
    this.workerBusy[workerIndex] = true

    const taskId = this.taskIdCounter++
    this.pendingTasks.set(taskId, { resolve: task.resolve, reject: task.reject })

    const worker = this.workers[workerIndex]

    if (task.type === 'encrypt') {
      worker.postMessage(
        { type: 'encrypt', id: taskId, data: task.data, keyData: task.keyData },
        { transfer: [task.data] }
      )
    } else {
      worker.postMessage(
        { type: 'decrypt', id: taskId, data: task.data, iv: task.iv, keyData: task.keyData },
        { transfer: [task.data] }
      )
    }
  }

  private findFreeWorker(): number {
    for (let i = 0; i < this.workers.length; i++) {
      if (!this.workerBusy[i]) return i
    }
    return -1
  }

  /**
   * Encrypt data using AES-256-GCM
   * Returns encrypted buffer and IV
   */
  async encrypt(data: ArrayBuffer, key: CryptoKey): Promise<{ data: ArrayBuffer; iv: number[] }> {
    await this.initialize()

    // Export key to JsonWebKey for transfer to worker
    const keyData = await crypto.subtle.exportKey('jwk', key)

    return new Promise((resolve, reject) => {
      const task = {
        type: 'encrypt' as const,
        data,
        keyData,
        resolve: (result: { data: ArrayBuffer; iv?: number[] }) => {
          resolve({ data: result.data, iv: result.iv! })
        },
        reject
      }

      const freeWorker = this.findFreeWorker()
      if (freeWorker >= 0) {
        this.workerBusy[freeWorker] = true
        const taskId = this.taskIdCounter++
        this.pendingTasks.set(taskId, { resolve: task.resolve, reject: task.reject })

        this.workers[freeWorker].postMessage(
          { type: 'encrypt', id: taskId, data, keyData },
          { transfer: [data] }
        )
      } else {
        // All workers busy, queue the task
        this.taskQueue.push(task)
      }
    })
  }

  /**
   * Decrypt data using AES-256-GCM
   * Returns decrypted buffer
   */
  async decrypt(data: ArrayBuffer, key: CryptoKey, iv: number[]): Promise<ArrayBuffer> {
    await this.initialize()

    const keyData = await crypto.subtle.exportKey('jwk', key)

    return new Promise((resolve, reject) => {
      const task = {
        type: 'decrypt' as const,
        data,
        keyData,
        iv,
        resolve: (result: { data: ArrayBuffer; iv?: number[] }) => {
          resolve(result.data)
        },
        reject
      }

      const freeWorker = this.findFreeWorker()
      if (freeWorker >= 0) {
        this.workerBusy[freeWorker] = true
        const taskId = this.taskIdCounter++
        this.pendingTasks.set(taskId, { resolve: task.resolve, reject: task.reject })

        this.workers[freeWorker].postMessage(
          { type: 'decrypt', id: taskId, data, iv, keyData },
          { transfer: [data] }
        )
      } else {
        this.taskQueue.push(task)
      }
    })
  }

  /**
   * Get pool statistics
   */
  getStats(): { poolSize: number; busyWorkers: number; queuedTasks: number } {
    return {
      poolSize: POOL_SIZE,
      busyWorkers: this.workerBusy.filter(b => b).length,
      queuedTasks: this.taskQueue.length
    }
  }

  /**
   * Terminate all workers
   */
  terminate(): void {
    for (const worker of this.workers) {
      worker.terminate()
    }
    this.workers = []
    this.workerBusy = []
    this.taskQueue = []
    this.pendingTasks.clear()
    this.initialized = false
    this.initPromise = null
  }
}

// Singleton instance
export const cryptoPool = new CryptoWorkerPool()

// Re-export for convenience - fallback to main thread if workers unavailable
export async function encryptWithWorker(
  data: ArrayBuffer,
  key: CryptoKey
): Promise<{ data: ArrayBuffer; iv: Uint8Array }> {
  try {
    const result = await cryptoPool.encrypt(data, key)
    return { data: result.data, iv: new Uint8Array(result.iv) }
  } catch (error) {
    // Fallback to main thread encryption
    console.warn('[CryptoPool] Worker failed, falling back to main thread:', error)
    const { encryptChunk } = await import('./encryption')
    return encryptChunk(data, key)
  }
}

export async function decryptWithWorker(
  data: ArrayBuffer,
  key: CryptoKey,
  iv: Uint8Array
): Promise<ArrayBuffer> {
  try {
    return await cryptoPool.decrypt(data, key, Array.from(iv))
  } catch (error) {
    // Fallback to main thread decryption
    console.warn('[CryptoPool] Worker failed, falling back to main thread:', error)
    const { decryptChunk } = await import('./encryption')
    return decryptChunk(data, key, iv)
  }
}
