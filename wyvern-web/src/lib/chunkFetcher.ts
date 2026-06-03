/**
 * Chunk Fetcher with Retry
 *
 * Fetches Discord CDN chunks with automatic retry on 404/403 (expired link).
 * Attempts to refresh the URL via backend if the chunk has message ID metadata.
 */

import type { ChunkInfo } from './types'
import { fetchViaExtension } from './extension'
import { supabase } from './supabase'

const API_URL = 'http://localhost:3001/api'

/**
 * Get current access token from Supabase session
 */
async function getAccessToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || ''
}

/**
 * Fetch a chunk with automatic retry on expired link (404/403)
 * If chunk has metadata (m, cid), attempts to refresh the URL via backend
 */
export async function fetchChunkWithRetry(chunk: ChunkInfo): Promise<ArrayBuffer> {
  try {
    return await fetchViaExtension(chunk.u)
  } catch (e: unknown) {
    const error = e as Error
    const isExpiredLink = error.message && (
      error.message.includes('404') ||
      error.message.includes('403') ||
      error.message.includes('Failed to fetch')
    )

    // If expired and we have refresh metadata, try to get a fresh URL
    if (isExpiredLink && chunk.m && chunk.cid) {
      console.log(`[ChunkFetcher] Chunk ${chunk.i} expired, attempting refresh...`)

      try {
        const accessToken = await getAccessToken()
        const refreshUrl = new URL(API_URL + '/refresh-urls')

        // Get webhook URL from local storage (needed for backend to refresh via Discord API)
        let webhookUrl: string | undefined
        try {
          // Webhooks are stored in 'wyvern-saved-webhooks' as an array
          const savedWebhooks = JSON.parse(localStorage.getItem('wyvern-saved-webhooks') || '[]')
          if (Array.isArray(savedWebhooks) && savedWebhooks.length > 0) {
            webhookUrl = savedWebhooks[0]
          }
        } catch { /* ignore */ }

        const res = await fetch(refreshUrl.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({ chunks: [chunk], webhookUrl })
        })

        console.log(`[ChunkFetcher] Sending chunk to refresh:`, { i: chunk.i, m: chunk.m, cid: chunk.cid, hasWebhook: !!webhookUrl })
        console.log(`[ChunkFetcher] Refresh API response: ${res.status}`)

        if (res.ok) {
          const data = await res.json()
          console.log(`[ChunkFetcher] Refresh result:`, data)
          const { refreshed } = data
          if (refreshed && refreshed[chunk.i]) {
            console.log(`[ChunkFetcher] Chunk ${chunk.i} URL refreshed, retrying fetch...`)
            chunk.u = refreshed[chunk.i]
            return await fetchViaExtension(chunk.u)
          } else {
            console.warn(`[ChunkFetcher] No refreshed URL for chunk ${chunk.i}`)
          }
        } else {
          const errorText = await res.text()
          console.warn(`[ChunkFetcher] Refresh failed: ${res.status} ${errorText}`)
        }
      } catch (refreshErr) {
        console.error('[ChunkFetcher] Refresh request failed:', refreshErr)
      }
    }

    // Re-throw the original error if refresh didn't help or wasn't possible
    throw e
  }
}
