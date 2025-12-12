/**
 * Wyvern Drive - Content Script
 * Bridges communication between Web App and Extension Background Script
 */

console.log('🐉 [Wyvern Content] Content script loaded on:', window.location.href)

// Inject a flag so the web app knows the extension is active
window.postMessage({ type: 'WYVERN_EXTENSION_READY' }, '*')

// Listen for messages from the web app
window.addEventListener('message', (event) => {
  // Only accept messages from the same window
  if (event.source !== window) return

  if (event.data.type === 'WYVERN_DOWNLOAD_REQUEST') {
    const { url, id } = event.data
    console.log('🐉 [Wyvern Content] Download request:', id, url.substring(0, 60))

    // Forward to background script
    chrome.runtime.sendMessage(
      { type: 'DOWNLOAD', url },
      (response) => {
        const error = response?.error || chrome.runtime.lastError?.message
        console.log('🐉 [Wyvern Content] Response:', error || 'OK, data length: ' + (response?.data?.length || 0))
        
        // Send response back to web app
        window.postMessage({
          type: 'WYVERN_DOWNLOAD_RESPONSE',
          id,
          data: response?.data,
          error: error
        }, '*')
      }
    )
  }
})

console.log('🐉 [Wyvern Content] Event listener registered')
