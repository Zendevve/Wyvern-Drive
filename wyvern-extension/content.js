/**
 * Wyvern Drive - Content Script
 * Bridges communication between Web App and Extension Background Script
 */

// Inject a flag so the web app knows the extension is active
window.postMessage({ type: 'WYVERN_EXTENSION_READY' }, '*')

// Listen for messages from the web app
window.addEventListener('message', (event) => {
  // Only accept messages from the same window
  if (event.source !== window) return

  if (event.data.type === 'WYVERN_DOWNLOAD_REQUEST') {
    const { url, id } = event.data

    // Forward to background script
    chrome.runtime.sendMessage(
      { type: 'DOWNLOAD', url },
      (response) => {
        // Send response back to web app
        window.postMessage({
          type: 'WYVERN_DOWNLOAD_RESPONSE',
          id, // Match request ID
          data: response?.data,
          error: response?.error || chrome.runtime.lastError?.message
        }, '*')
      }
    )
  }
})
