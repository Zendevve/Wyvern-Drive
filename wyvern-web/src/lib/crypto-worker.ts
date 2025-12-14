/**
 * Crypto Web Worker - Offloads AES-256-GCM encryption to background thread
 *
 * This worker handles encryption/decryption without blocking the main thread,
 * allowing parallel chunk uploads while encryption happens in the background.
 */

const IV_LENGTH = 12

// Message types
interface EncryptMessage {
  type: 'encrypt'
  id: number
  data: ArrayBuffer
  keyData: JsonWebKey
}

interface DecryptMessage {
  type: 'decrypt'
  id: number
  data: ArrayBuffer
  iv: number[]
  keyData: JsonWebKey
}

interface InitMessage {
  type: 'init'
}

type WorkerMessage = EncryptMessage | DecryptMessage | InitMessage

// Generate a random IV
function generateIv(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH))
}

// Import JsonWebKey to CryptoKey
async function importKey(keyData: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    keyData,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

// Handle incoming messages
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const message = event.data

  if (message.type === 'init') {
    // Ready signal
    self.postMessage({ type: 'ready' })
    return
  }

  if (message.type === 'encrypt') {
    try {
      const key = await importKey(message.keyData)
      const iv = generateIv()

      const encryptedData = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv as BufferSource },
        key,
        message.data
      )

      // Transfer the encrypted buffer back (zero-copy)
      self.postMessage(
        {
          type: 'encrypted',
          id: message.id,
          data: encryptedData,
          iv: Array.from(iv)
        },
        { transfer: [encryptedData] }
      )
    } catch (error) {
      self.postMessage({
        type: 'error',
        id: message.id,
        error: (error as Error).message
      })
    }
    return
  }

  if (message.type === 'decrypt') {
    try {
      const key = await importKey(message.keyData)
      const iv = new Uint8Array(message.iv)

      const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as BufferSource },
        key,
        message.data
      )

      // Transfer the decrypted buffer back (zero-copy)
      self.postMessage(
        {
          type: 'decrypted',
          id: message.id,
          data: decryptedData
        },
        { transfer: [decryptedData] }
      )
    } catch (error) {
      self.postMessage({
        type: 'error',
        id: message.id,
        error: (error as Error).message
      })
    }
    return
  }
}

// Signal worker is loaded
self.postMessage({ type: 'loaded' })
