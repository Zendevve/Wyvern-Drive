import { fetchViaExtension } from './extension'

// Types for Discord Chunks (reused from ShareView logic)
interface ChunkData {
  i: number      // index
  u: string      // url
  s: number      // size
}

// Cache chunk metadata to avoid re-fetching from DB for every seek
const metadataCache = new Map<string, ChunkData[]>()

// Allow main thread to seed metadata (for private files)
export function registerFileMetadata(id: string, chunks: ChunkData[]) {
  metadataCache.set(id, chunks)
  console.log(`[Streaming] Registered metadata for ${id} (${chunks.length} chunks)`)
}

export function registerStreamingListener() {
  if (!('serviceWorker' in navigator)) return

  navigator.serviceWorker.addEventListener('message', async (event) => {
    if (event.data?.type === 'FETCH_RANGE') {
      const { shareId, start, end } = event.data
      const port = event.ports[0]

      if (!port) return

      try {
        await handleRangeRequest(shareId, start, end, port)
      } catch (err: any) {
        console.error('[Streaming] Error handling range request:', err)
        port.postMessage({ type: 'ERROR', error: err.message })
      }
    }
  })
  console.log('[Streaming] Listener registered')
}

async function handleRangeRequest(shareId: string, start: number, end: number, port: MessagePort) {
  console.log(`[Streaming] Request: ${shareId} bytes ${start}-${end}`)

  // 1. Get Metadata (Cached or Fetch)
  let chunks = metadataCache.get(shareId)
  if (!chunks) {
    if (shareId.startsWith('private-')) {
      port.postMessage({ type: 'ERROR', error: 'Private file metadata not found (expired?)' })
      return
    }

    // Fetch all chunks for this file
    chunks = await fetchAllChunks(shareId)
    metadataCache.set(shareId, chunks)
  }

  // 2. Identify required chunks
  // We need to find which chunks contain the bytes from [start, end]
  let currentOffset = 0
  const chunksToFetch: { chunk: ChunkData, chunkStart: number, chunkEnd: number }[] = []

  for (const chunk of chunks) {
    const chunkStart = currentOffset
    const chunkEnd = currentOffset + chunk.s - 1

    // Check overlap
    if (chunkEnd >= start && chunkStart <= end) {
      chunksToFetch.push({
        chunk,
        chunkStart,
        chunkEnd
      })
    }

    currentOffset += chunk.s

    if (currentOffset > end) break // Optimization: stop once we passed the end
  }

  // 3. Fetch and Stream
  for (const item of chunksToFetch) {
    const { chunk, chunkStart } = item

    try {
      // Fetch the full chunk (Discord doesn't support Range requests on their CDN easily without signature issues sometimes,
      // but usually we just fetch the whole 8MB block.
      // Optimization: If the browser requests a tiny range, we still fetch 8MB.
      // Javascript `fetch` will dowload the whole body unless we abort.
      // We can use Range header if Discord supports it on attachments (usually yes).
      // Let's try fetching the whole chunk for reliability first, as we are serving 8MB blocks.)

      const chunkData = await fetchChunkData(chunk.u)

      // Calculate slice relative to the chunk
      // We want intersection of [start, end] and [chunkStart, chunkEnd]
      const requestStartInFile = Math.max(start, chunkStart)
      const requestEndInFile = Math.min(end, chunk.s + chunkStart - 1)

      const sliceStart = requestStartInFile - chunkStart
      const sliceEnd = requestEndInFile - chunkStart + 1 // slice is exclusive at end

      const slicedData = chunkData.slice(sliceStart, sliceEnd)

      // Send to SW
      port.postMessage({ type: 'CHUNK', chunk: slicedData }, [slicedData.buffer])

    } catch (err) {
      console.error(`[Streaming] Failed to fetch chunk ${chunk.i}`, err)
      throw err
    }
  }

  port.postMessage({ type: 'COMPLETE' })
}

async function fetchAllChunks(shareId: string): Promise<ChunkData[]> {
  // Use the paginated API to fetch all chunks
  // Looping until hasMore is false
  const allChunks: ChunkData[] = []
  let page = 0
  const limit = 1000 // Get large batches of metadata



  while (true) {
    // Wait, we need to manually construct the URL because invoke helper is POST by default or tricky with GET params?
    // Supabase helper `invoke` is for POST mainly.
    // Let's use direct fetching like in ShareView

    const API_URL = import.meta.env.VITE_SUPABASE_URL + '/functions/v1/api'
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

    const url = new URL(`${API_URL}/share/${shareId}/chunks`)
    url.searchParams.set('page', page.toString())
    url.searchParams.set('limit', limit.toString())

    const res = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${anonKey}` }
    })

    if (!res.ok) throw new Error('Failed to fetch metadata')

    const json = await res.json()
    if (json.chunks) {
      allChunks.push(...json.chunks)
    }

    if (!json.hasMore) break
    page++
  }

  // Normalize
  return allChunks.map((c: any) => ({
    i: c.i ?? c.index,
    u: c.u ?? c.url,
    s: c.s ?? c.size
  })).sort((a, b) => a.i - b.i)
}

async function fetchChunkData(url: string): Promise<Uint8Array> {
  // Try via extension first (CORS bypass)
  try {
    const buffer = await fetchViaExtension(url, 30000) // 30s timeout
    return new Uint8Array(buffer)
  } catch {
    // Fallback to direct fetch? (Likely fails CORS if extension is needed)
    console.warn('[Streaming] Extension fetch failed, trying direct...')
    const res = await fetch(url)
    return new Uint8Array(await res.arrayBuffer())
  }
}
