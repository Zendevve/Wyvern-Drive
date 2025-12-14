/**
 * Extension Detection - Checks if the Wyvern Drive browser extension is active
 * Uses active probing to avoid race conditions with content script loading
 */

let extensionReady = false
let probeInProgress = false

// Listen for the extension's ready signal (covers fast extension load)
window.addEventListener('message', (event) => {
  if (event.source !== window) return
  if (event.data.type === 'WYVERN_EXTENSION_READY' || event.data.type === 'WYVERN_PONG') {
    extensionReady = true
    console.log('[Wyvern] Extension detected and ready')
  }
})

/**
 * Actively probe for the extension (sends ping, waits for pong)
 */
async function probeExtension(timeoutMs: number = 1000): Promise<boolean> {
  if (extensionReady) return true
  if (probeInProgress) {
    // Wait for existing probe
    await new Promise(resolve => setTimeout(resolve, timeoutMs))
    return extensionReady
  }

  probeInProgress = true

  return new Promise((resolve) => {
    const handlePong = (event: MessageEvent) => {
      if (event.source !== window) return
      if (event.data.type === 'WYVERN_PONG') {
        extensionReady = true
        window.removeEventListener('message', handlePong)
        probeInProgress = false
        resolve(true)
      }
    }

    window.addEventListener('message', handlePong)
    window.postMessage({ type: 'WYVERN_PING' }, '*')

    setTimeout(() => {
      window.removeEventListener('message', handlePong)
      probeInProgress = false
      resolve(extensionReady)
    }, timeoutMs)
  })
}

/**
 * Check if the extension is available
 */
export function isExtensionAvailable(): boolean {
  return extensionReady
}

/**
 * Wait for extension to be ready (with timeout)
 * Now actively probes the extension instead of passively waiting
 */
export async function waitForExtension(timeoutMs: number = 3000): Promise<boolean> {
  if (extensionReady) return true

  // Try probing multiple times
  const probeInterval = 500
  const attempts = Math.ceil(timeoutMs / probeInterval)

  for (let i = 0; i < attempts; i++) {
    const found = await probeExtension(probeInterval)
    if (found) return true
  }

  return extensionReady
}

/**
 * Fetch a file via the browser extension (bypasses CORS)
 * Returns null if extension is not available
 */
export async function fetchViaExtension(url: string, timeoutMs: number = 15000): Promise<ArrayBuffer> {
  // Quick check for extension
  if (!extensionReady) {
    // Wait a bit in case extension is still loading
    await waitForExtension(2000)
    if (!extensionReady) {
      throw new Error('Extension not installed or not active on this page')
    }
  }

  return new Promise((resolve, reject) => {
    const requestId = Math.random().toString(36).substring(7)

    const handleResponse = (event: MessageEvent) => {
      if (event.source !== window) return
      if (event.data.type === 'WYVERN_DOWNLOAD_RESPONSE' && event.data.id === requestId) {
        window.removeEventListener('message', handleResponse)

        if (event.data.error) {
          reject(new Error(event.data.error))
        } else if (event.data.data) {
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
    window.postMessage({ type: 'WYVERN_DOWNLOAD_REQUEST', url, id: requestId }, '*')

    setTimeout(() => {
      window.removeEventListener('message', handleResponse)
      reject(new Error('Extension download timeout - is extension installed?'))
    }, timeoutMs)
  })
}
