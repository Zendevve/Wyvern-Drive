/// <reference lib="webworker" />
declare let self: ServiceWorkerGlobalScope

import { precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst, CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { getMimeType } from './lib/mimeTypes'

// self.skipWaiting() // REMOVED: Managed by UpdatePrompt to prevent auto-reload loops
clientsClaim()

// PWA v1.2.1
precacheAndRoute(self.__WB_MANIFEST)

// 2. Runtime Caching (Replicating previous vite.config.ts logic)

// API Cache
registerRoute(
  ({ url }) => {
    if (!url.hostname.includes('supabase.co')) return false
    if (!url.pathname.includes('/functions/')) return false
    if (url.pathname.includes('/share/')) return false
    if (url.pathname.includes('/stream/')) return false
    return true
  },
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24 // 1 day
      })
    ],
    networkTimeoutSeconds: 10
  })
)

// Static Assets Cache (Images, Fonts, etc.)
registerRoute(
  ({ url }) => /\.(png|jpg|jpeg|svg|gif|webp|woff2?|ttf|eot)$/.test(url.pathname),
  new CacheFirst({
    cacheName: 'static-assets',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
      })
    ]
  })
)

// 3. MEDIA STREAMING INTERCEPTOR
// Intercepts requests to /virtual/stream/:shareId
// Asks the main thread to fetch the specific byte range using the Extension
// Pipes the data back to the response stream

const STREAM_PREFIX = '/virtual/stream/'

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  if (url.pathname.startsWith(STREAM_PREFIX)) {
    event.respondWith(handleStreamRequest(event.request, url, event.clientId))
  }
})

async function handleStreamRequest(request: Request, url: URL, clientId: string): Promise<Response> {
  const shareId = url.pathname.replace(STREAM_PREFIX, '')

  // 1. Get Range Header
  const rangeHeader = request.headers.get('Range')
  // We need the file size to support Range requests properly.
  // Ideally, we pass it in the URL query params for simplicity: ?size=123456
  const totalSize = parseInt(url.searchParams.get('size') || '0')
  const fileName = url.searchParams.get('name') || 'video.mp4'

  if (!totalSize) {
    return new Response('Missing file size params', { status: 400 })
  }

  // Parse Range
  let start = 0
  let end = totalSize - 1

  if (rangeHeader) {
    const parts = rangeHeader.replace(/bytes=/, "").split("-")
    start = parseInt(parts[0])
    if (parts[1]) {
      end = parseInt(parts[1])
    }
  }

  // Chunk size for our stream buffer (e.g., fetch 1MB at a time from main thread)
  // But wait, the main thread will handle the discord chunk logic (8MB chunks).
  // We just ask for bytes [start, end].

  // 2. Find the client that made this request
  let client: Client | undefined
  if (clientId) {
    client = await self.clients.get(clientId)
  }

  // Fallback if clientId is missing (e.g. some browsers/contexts)
  if (!client) {
    const allClients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' })
    client = allClients[0]
  }

  if (!client) {
    return new Response('No active window to handle stream', { status: 503 })
  }

  // 3. Create a ReadableStream that pulls data from the main thread
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // We will request data in chunks to allow cancellation and seeking
        // The browser is asking for [start, end].
        // We can fulfill this entire range by piping it.

        await askClientForData(client!, shareId, start, end, (data) => {
          controller.enqueue(data)
        })

        controller.close()
      } catch (err) {
        console.error('[SW] Stream error:', err)
        controller.error(err)
      }
    }
  })

  // 4. Return Partial Content Response
  const headers = new Headers({
    'Content-Type': getMimeType(fileName),
    'Content-Length': (end - start + 1).toString(),
    'Content-Range': `bytes ${start}-${end}/${totalSize}`,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-cache' // Don't cache in SW
  })

  return new Response(stream, {
    status: 206,
    headers
  })
}

// Helper to communicate with Main Thread via MessageChannel
function askClientForData(
  client: Client,
  shareId: string,
  start: number,
  end: number,
  onData: (data: Uint8Array) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel()

    channel.port1.onmessage = (event) => {
      const { type, chunk, error } = event.data

      if (type === 'CHUNK') {
        onData(chunk)
      } else if (type === 'COMPLETE') {
        resolve()
      } else if (type === 'ERROR') {
        reject(new Error(error))
      }
    }

    client.postMessage({
      type: 'FETCH_RANGE',
      shareId,
      start,
      end
    }, [channel.port2])
  })
}




