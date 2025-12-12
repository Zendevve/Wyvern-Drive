/**
 * Wyvern Drive Extension - Background Service Worker
 * Handles CORS bypass for Discord attachment downloads
 */

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener(
  (request, sender, sendResponse) => {
    if (request.type !== 'DOWNLOAD' || !request.url) {
      return false // Ignore unknown messages
    }

    const url = request.url

    // Validate URL is from Discord
    if (!url.includes('discord.com') && !url.includes('discordapp.com')) {
      sendResponse({ error: 'Invalid URL - must be Discord' })
      return true
    }

    // Fetch the file and return as data URL
    fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        return response.blob()
      })
      .then(blob => {
        // Convert blob to data URL for transfer
        const reader = new FileReader()
        reader.onloadend = () => {
          sendResponse({ data: reader.result })
        }
        reader.onerror = () => {
          sendResponse({ error: 'Failed to read file' })
        }
        reader.readAsDataURL(blob)
      })
      .catch(error => {
        console.error('Wyvern Drive fetch error:', error)
        sendResponse({ error: error.message })
      })

    // Return true to indicate async response
    return true
  }
)

// Log when extension is loaded
console.log('🐉 Wyvern Drive extension loaded')
