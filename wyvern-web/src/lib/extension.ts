/**
 * Extension Detection - Checks if the Wyvern Drive browser extension is active
 */

let extensionReady = false

// Listen for the extension's ready signal
window.addEventListener('message', (event) => {
  if (event.source !== window) return
  if (event.data.type === 'WYVERN_EXTENSION_READY') {
    extensionReady = true
    console.log('[Wyvern] Extension detected and ready')
  }
})

/**
 * Check if the extension is available
 */
export function isExtensionAvailable(): boolean {
  return extensionReady
}

/**
 * Wait for extension to be ready (with timeout)
 */
export async function waitForExtension(timeoutMs: number = 3000): Promise<boolean> {
  if (extensionReady) return true

  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      if (extensionReady) {
        clearInterval(checkInterval)
        resolve(true)
      }
    }, 100)

    setTimeout(() => {
      clearInterval(checkInterval)
      resolve(extensionReady)
    }, timeoutMs)
  })
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
