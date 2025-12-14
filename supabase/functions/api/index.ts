// Supabase Edge Function: Consolidated API
// Handles all file and version CRUD operations

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Create Supabase client
function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  )
}

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  "https://wyvern-drive.netlify.app",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173"
]

// Get CORS headers with origin validation
function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  }
}

// Allowed fields for file updates (security: prevent arbitrary field modification)
const ALLOWED_UPDATE_FIELDS = ['name', 'parent_id']

// SHA-256 hash for password (secure, unlike base64)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin")
  const corsHeaders = getCorsHeaders(origin)

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  const url = new URL(req.url)
  // Supabase prepends function name to path, so "/api/files/123" becomes the path
  // Strip the "/api" prefix to get the actual route
  // Supabase prepends function name to path, so "/api/files/123" becomes the path
  // Strip the "/api" prefix to get the actual route
  const rawPath = url.pathname
  let path = rawPath
  if (path.startsWith("/functions/v1/api")) {
    path = path.slice("/functions/v1/api".length)
  } else if (path.startsWith("/api")) {
    path = path.slice("/api".length)
  }
  const method = req.method

  console.log(`[DEBUG] Request: ${method} ${rawPath} -> ${path}`)

  // Helper to create JSON response
  const json = (data: unknown, status = 200) => {
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }

  try {
    // Route matching
    // Root
    if (path === "/" || path === "") {
      return json({ status: "ok", name: "Wyvern Drive API", path, method })
    }

    // Health check
    if (path === "/health") {
      return json({ status: "ok", name: "Wyvern Drive API" })
    }

    // GET /stream/:userId/:fileId - Range request streaming for video/audio
    const streamMatch = path.match(/^\/stream\/([^\/]+)\/(\d+)$/)
    if (streamMatch && method === "GET") {
      const [, userId, fileId] = streamMatch
      const supabase = getSupabase()

      // 1. Get file metadata
      const { data: file, error: fileError } = await supabase
        .from("files")
        .select("id, name, size, content, encrypted, type")
        .eq("user_id", userId)
        .eq("id", fileId)
        .maybeSingle()

      if (fileError || !file) {
        return json({ error: "File not found" }, 404)
      }

      // Don't stream encrypted files - they need full download for decryption
      if (file.encrypted) {
        return json({ error: "Cannot stream encrypted files" }, 400)
      }

      if (!file.content) {
        return json({ error: "File has no content" }, 400)
      }

      // 2. Parse chunk map
      interface ChunkInfo {
        index: number
        messageId: string
        url: string
        size: number
      }

      let chunks: ChunkInfo[]
      try {
        chunks = JSON.parse(file.content)
        chunks.sort((a, b) => a.index - b.index)
      } catch {
        return json({ error: "Invalid chunk data" }, 500)
      }

      // 3. Calculate total size and chunk offsets
      const totalSize = chunks.reduce((sum, c) => sum + c.size, 0)
      const chunkOffsets: number[] = []
      let offset = 0
      for (const chunk of chunks) {
        chunkOffsets.push(offset)
        offset += chunk.size
      }

      // 4. Parse Range header
      const rangeHeader = req.headers.get("Range")
      let rangeStart = 0
      let rangeEnd = totalSize - 1

      if (rangeHeader) {
        const match = rangeHeader.match(/bytes=(\d*)-(\d*)/)
        if (match) {
          if (match[1]) rangeStart = parseInt(match[1])
          if (match[2]) rangeEnd = parseInt(match[2])
        }
      }

      // Clamp to valid range
      rangeStart = Math.max(0, rangeStart)
      rangeEnd = Math.min(totalSize - 1, rangeEnd)
      const contentLength = rangeEnd - rangeStart + 1

      // 5. Find which chunks contain the requested range
      const neededChunks: { chunk: ChunkInfo; startOffset: number; sliceStart: number; sliceEnd: number }[] = []

      for (let i = 0; i < chunks.length; i++) {
        const chunkStart = chunkOffsets[i]
        const chunkEnd = chunkStart + chunks[i].size - 1

        // Check if this chunk overlaps with requested range
        if (chunkEnd >= rangeStart && chunkStart <= rangeEnd) {
          const sliceStart = Math.max(0, rangeStart - chunkStart)
          const sliceEnd = Math.min(chunks[i].size, rangeEnd - chunkStart + 1)
          neededChunks.push({
            chunk: chunks[i],
            startOffset: chunkStart,
            sliceStart,
            sliceEnd
          })
        }
      }

      // 6. Fetch needed chunks from Discord CDN
      const dataParts: Uint8Array[] = []

      for (const { chunk, sliceStart, sliceEnd } of neededChunks) {
        try {
          const response = await fetch(chunk.url)
          if (!response.ok) {
            throw new Error(`Failed to fetch chunk: ${response.status}`)
          }
          const buffer = await response.arrayBuffer()
          const slice = new Uint8Array(buffer).slice(sliceStart, sliceEnd)
          dataParts.push(slice)
        } catch (e) {
          console.error(`Error fetching chunk ${chunk.index}:`, e)
          return json({ error: "Failed to fetch file data" }, 500)
        }
      }

      // 7. Combine parts
      const totalLength = dataParts.reduce((sum, p) => sum + p.length, 0)
      const result = new Uint8Array(totalLength)
      let pos = 0
      for (const part of dataParts) {
        result.set(part, pos)
        pos += part.length
      }

      // 8. Determine content type from filename
      const ext = file.name.split('.').pop()?.toLowerCase() || ''
      const mimeTypes: Record<string, string> = {
        mp4: 'video/mp4',
        webm: 'video/webm',
        mkv: 'video/x-matroska',
        avi: 'video/x-msvideo',
        mov: 'video/quicktime',
        mp3: 'audio/mpeg',
        wav: 'audio/wav',
        ogg: 'audio/ogg',
        flac: 'audio/flac',
        m4a: 'audio/mp4',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp',
        pdf: 'application/pdf',
      }
      const contentType = mimeTypes[ext] || 'application/octet-stream'

      // 9. Return partial content (206) or full content (200)
      const isRangeRequest = rangeHeader !== null
      const status = isRangeRequest ? 206 : 200

      const headers: Record<string, string> = {
        ...corsHeaders,
        "Content-Type": contentType,
        "Content-Length": String(contentLength),
        "Accept-Ranges": "bytes",
      }

      if (isRangeRequest) {
        headers["Content-Range"] = `bytes ${rangeStart}-${rangeEnd}/${totalSize}`
      }

      return new Response(result, { status, headers })
    }

    // GET /files/:userId
    const filesMatch = path.match(/^\/files\/([^\/]+)$/)
    if (filesMatch && method === "GET") {
      const userId = filesMatch[1]
      const supabase = getSupabase()

      const { data: rows, error } = await supabase
        .from("files")
        .select("*")
        .eq("user_id", userId)

      if (error) return json({ error: error.message }, 500)

      // Build tree structure
      interface FileRow {
        id: number
        user_id: string
        parent_id: number | null
        name: string
        type: "file" | "directory"
        size: number
        content: string | null
        encrypted: number
        encryption_salt: string | null
        created_at: string
        updated_at: string
      }

      interface FileTree {
        id?: number
        name?: string
        type?: string
        children: Record<string, FileTree | FileRow>
      }

      const directories: Record<number, FileTree> = {}
      const root: FileTree = { children: {} }

      for (const row of rows as FileRow[]) {
        if (row.type === "directory") {
          directories[row.id] = { ...row, children: {} }
        }
      }

      for (const row of rows as FileRow[]) {
        const entry = row.type === "directory" ? directories[row.id] : row
        if (row.parent_id === null) {
          root.children[row.name] = entry
        } else if (directories[row.parent_id]) {
          directories[row.parent_id].children[row.name] = entry
        }
      }

      return json(root)
    }

    // POST /files/:userId - Create file or directory
    if (filesMatch && method === "POST") {
      const userId = filesMatch[1]
      let body
      try {
        body = await req.json()
      } catch (parseError) {
        console.error("[POST /files] Failed to parse JSON body:", parseError)
        return json({ error: "Invalid JSON body" }, 400)
      }

      const { parent_id, name, type, size, content, encrypted, encryption_salt } = body
      const supabase = getSupabase()

      // Log payload size for debugging large file issues
      const contentSize = content ? content.length : 0
      console.log(`[POST /files] userId=${userId}, name=${name}, type=${type}, size=${size}, contentLength=${contentSize}`)

      // Warn if content is very large (>500KB)
      if (contentSize > 500 * 1024) {
        console.warn(`[POST /files] Large content payload: ${(contentSize / 1024).toFixed(1)}KB for file: ${name}`)
      }

      // Check for existing file collision
      const { data: existing, error: existingError } = await supabase
        .from("files")
        .select("*")
        .eq("user_id", userId)
        .is("parent_id", parent_id || null)
        .eq("name", name)
        .eq("type", "file")
        .maybeSingle()

      if (existingError) {
        console.error("[POST /files] Error checking existing file:", existingError)
        return json({ error: existingError.message }, 500)
      }

      if (existing && type === "file") {
        // Handle versioning
        const { data: lastVer, error: verError } = await supabase
          .from("file_versions")
          .select("version_number")
          .eq("file_id", existing.id)
          .order("version_number", { ascending: false })
          .limit(1)
          .maybeSingle()

        if (verError) {
          console.error("[POST /files] Error getting last version:", verError)
        }

        const newVerNum = (lastVer?.version_number || 0) + 1

        const { error: insertVerError } = await supabase.from("file_versions").insert({
          file_id: existing.id,
          version_number: newVerNum,
          content: existing.content || "[]",
          size: existing.size,
        })

        if (insertVerError) {
          console.error("[POST /files] Error inserting version:", insertVerError)
          return json({ error: `Failed to create version: ${insertVerError.message}` }, 500)
        }

        const { error: updateError } = await supabase
          .from("files")
          .update({
            size: size || 0,
            content: content || null,
            encrypted: encrypted ? 1 : 0,
            encryption_salt: encryption_salt || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)

        if (updateError) {
          console.error("[POST /files] Error updating existing file:", updateError)
          return json({ error: `Failed to update file: ${updateError.message}` }, 500)
        }

        console.log(`[POST /files] Updated existing file ${existing.id} to version ${newVerNum}`)
        return json(existing.id)
      } else {
        const { data, error } = await supabase
          .from("files")
          .insert({
            user_id: userId,
            parent_id: parent_id || null,
            name,
            type,
            size: size || 0,
            content: content || null,
            encrypted: encrypted ? 1 : 0,
            encryption_salt: encryption_salt || null,
          })
          .select("id")
          .single()

        if (error) {
          console.error("[POST /files] Error inserting new file:", error)
          return json({ error: `Failed to create file: ${error.message}` }, 500)
        }

        console.log(`[POST /files] Created new file ${data.id}: ${name}`)
        return json(data.id)
      }
    }

    // POST /files/:userId/:id/update
    const updateMatch = path.match(/^\/files\/([^\/]+)\/(\d+)\/update$/)
    if (updateMatch && method === "POST") {
      const [, userId, id] = updateMatch
      const rawUpdates = await req.json()
      const supabase = getSupabase()

      // SECURITY: Only allow whitelisted fields to be updated
      const updates: Record<string, unknown> = {}
      for (const field of ALLOWED_UPDATE_FIELDS) {
        if (field in rawUpdates) {
          updates[field] = rawUpdates[field]
        }
      }
      updates.updated_at = new Date().toISOString()

      if (Object.keys(updates).length === 1) {
        // Only updated_at, no valid fields provided
        return json({ error: "No valid fields to update" }, 400)
      }

      const { error } = await supabase
        .from("files")
        .update(updates)
        .eq("user_id", userId)
        .eq("id", id)

      if (error) return json({ error: error.message }, 500)
      return json({ success: true })
    }

    // DELETE /files/:userId/:id
    const deleteMatch = path.match(/^\/files\/([^\/]+)\/(\d+)$/)
    if (deleteMatch && method === "DELETE") {
      const [, userId, id] = deleteMatch
      const supabase = getSupabase()

      const { data: children } = await supabase
        .from("files")
        .select("id")
        .eq("parent_id", id)

      if (children && children.length > 0) {
        return json({ error: "Directory is not empty" }, 400)
      }

      await supabase.from("files").delete().eq("user_id", userId).eq("id", id)
      return json({ success: true })
    }

    // DELETE /files/:userId/:id/recursive
    const recursiveMatch = path.match(/^\/files\/([^\/]+)\/(\d+)\/recursive$/)
    if (recursiveMatch && method === "DELETE") {
      const [, userId, id] = recursiveMatch
      const supabase = getSupabase()

      const toDelete: number[] = [parseInt(id)]
      let index = 0

      while (index < toDelete.length) {
        const { data: children } = await supabase
          .from("files")
          .select("id")
          .eq("parent_id", toDelete[index])

        if (children) {
          for (const child of children) toDelete.push(child.id)
        }
        index++
      }

      for (const fileId of toDelete.reverse()) {
        await supabase.from("files").delete().eq("user_id", userId).eq("id", fileId)
      }

      return json({ success: true })
    }

    // GET /versions/:userId/:fileId
    const versionsMatch = path.match(/^\/versions\/([^\/]+)\/(\d+)$/)
    if (versionsMatch && method === "GET") {
      const [, userId, fileId] = versionsMatch
      const supabase = getSupabase()

      const { data: file } = await supabase
        .from("files")
        .select("id")
        .eq("user_id", userId)
        .eq("id", fileId)
        .maybeSingle()

      if (!file) return json({ error: "File not found" }, 404)

      const { data: versions, error } = await supabase
        .from("file_versions")
        .select("id, version_number, size, created_at")
        .eq("file_id", fileId)
        .order("version_number", { ascending: false })

      if (error) return json({ error: error.message }, 500)
      return json(versions)
    }

    // POST /versions/:userId/:fileId
    if (versionsMatch && method === "POST") {
      const [, userId, fileId] = versionsMatch
      const { content, size } = await req.json()
      const supabase = getSupabase()

      const { data: file } = await supabase
        .from("files")
        .select("id")
        .eq("user_id", userId)
        .eq("id", fileId)
        .maybeSingle()

      if (!file) return json({ error: "File not found" }, 404)

      const { data: lastVer } = await supabase
        .from("file_versions")
        .select("version_number")
        .eq("file_id", fileId)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle()

      const versionNumber = (lastVer?.version_number || 0) + 1

      const { data, error } = await supabase
        .from("file_versions")
        .insert({ file_id: parseInt(fileId), version_number: versionNumber, content, size })
        .select("id")
        .single()

      if (error) return json({ error: error.message }, 500)
      return json({ id: data.id, versionNumber })
    }

    // POST /versions/:userId/:fileId/restore/:versionId
    const restoreMatch = path.match(/^\/versions\/([^\/]+)\/(\d+)\/restore\/(\d+)$/)
    if (restoreMatch && method === "POST") {
      const [, userId, fileId, versionId] = restoreMatch
      const supabase = getSupabase()

      // SECURITY: Verify file belongs to user before allowing version restore
      const { data: file } = await supabase
        .from("files")
        .select("id")
        .eq("user_id", userId)
        .eq("id", fileId)
        .maybeSingle()

      if (!file) return json({ error: "File not found or access denied" }, 404)

      const { data: version } = await supabase
        .from("file_versions")
        .select("*")
        .eq("file_id", fileId)
        .eq("id", versionId)
        .maybeSingle()

      if (!version) return json({ error: "Version not found" }, 404)

      await supabase
        .from("files")
        .update({
          content: version.content,
          size: version.size,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("id", fileId)

      return json({ success: true })
    }

    // DELETE /versions/:userId/:fileId/:versionId
    const deleteVersionMatch = path.match(/^\/versions\/([^\/]+)\/(\d+)\/(\d+)$/)
    if (deleteVersionMatch && method === "DELETE") {
      const [, userId, fileId, versionId] = deleteVersionMatch
      const supabase = getSupabase()

      const { data: file } = await supabase
        .from("files")
        .select("id")
        .eq("user_id", userId)
        .eq("id", fileId)
        .maybeSingle()

      if (!file) return json({ error: "File not found" }, 404)

      await supabase
        .from("file_versions")
        .delete()
        .eq("file_id", fileId)
        .eq("id", versionId)

      return json({ success: true })
    }

    // ===== SHARE LINKS =====

    // POST /shares/:userId/:fileId - Create share link
    const createShareMatch = path.match(/^\/shares\/([^\/]+)\/(\d+)$/)
    if (createShareMatch && method === "POST") {
      const [, userId, fileId] = createShareMatch
      const supabase = getSupabase()

      // Verify file exists and belongs to user
      const { data: file } = await supabase
        .from("files")
        .select("id, name, encrypted")
        .eq("user_id", userId)
        .eq("id", fileId)
        .maybeSingle()

      if (!file) return json({ error: "File not found" }, 404)

      // Can't share encrypted files (need password to decrypt)
      if (file.encrypted) {
        return json({ error: "Cannot share encrypted files" }, 400)
      }

      // Parse options from body
      let expiresAt: string | null = null
      let passwordHash: string | null = null

      try {
        const body = await req.json()
        if (body.expiresIn) {
          // expiresIn is in hours
          const hours = parseInt(body.expiresIn)
          if (hours > 0) {
            expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
          }
        }
        if (body.password) {
          // SECURITY: Use SHA-256 hash instead of base64 encoding
          passwordHash = await hashPassword(body.password)
        }
      } catch {
        // No body is fine
      }

      // Create share
      const { data: share, error } = await supabase
        .from("shares")
        .insert({
          file_id: parseInt(fileId),
          user_id: userId,
          expires_at: expiresAt,
          password_hash: passwordHash
        })
        .select("id")
        .single()

      if (error) return json({ error: error.message }, 500)

      return json({
        id: share.id,
        url: `/share/${share.id}`,
        expiresAt
      })
    }

    // GET /share/:shareId/info - Get share info (NO AUTH, NO DOWNLOAD)
    const shareInfoMatch = path.match(/^\/share\/([a-f0-9-]+)\/info$/)
    if (shareInfoMatch && method === "GET") {
      const [, shareId] = shareInfoMatch
      const supabase = getSupabase()

      // Get share with file info
      const { data: share } = await supabase
        .from("shares")
        .select("*, files(id, name, size, type)")
        .eq("id", shareId)
        .maybeSingle()

      if (!share) return json({ error: "Share not found" }, 404)

      // Check expiry
      if (share.expires_at && new Date(share.expires_at) < new Date()) {
        return json({ error: "Share link expired", expired: true }, 410)
      }

      const file = share.files
      if (!file) {
        return json({ error: "File not found" }, 404)
      }

      return json({
        id: share.id,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        expiresAt: share.expires_at,
        passwordRequired: !!share.password_hash,
        downloadCount: share.download_count || 0
      })
    }

    // GET /share/:shareId - Public download (NO AUTH)
    const publicShareMatch = path.match(/^\/share\/([a-f0-9-]+)$/)
    if (publicShareMatch && method === "GET") {
      const [, shareId] = publicShareMatch
      const supabase = getSupabase()

      // Get share
      const { data: share } = await supabase
        .from("shares")
        .select("*, files(*)")
        .eq("id", shareId)
        .maybeSingle()

      if (!share) return json({ error: "Share not found" }, 404)

      // Check expiry
      if (share.expires_at && new Date(share.expires_at) < new Date()) {
        return json({ error: "Share link expired" }, 410)
      }

      // Check password
      const providedPassword = url.searchParams.get("password")
      if (share.password_hash) {
        // SECURITY: Use SHA-256 hash comparison
        const providedHash = providedPassword ? await hashPassword(providedPassword) : null
        if (!providedHash || providedHash !== share.password_hash) {
          return json({ error: "Password required", passwordRequired: true }, 401)
        }
      }

      const file = share.files
      if (!file || !file.content) {
        return json({ error: "File data not found" }, 404)
      }

      // Increment download count
      await supabase
        .from("shares")
        .update({ download_count: (share.download_count || 0) + 1 })
        .eq("id", shareId)

      // Parse chunks and stream file
      interface ChunkInfo {
        index: number
        url: string
        size: number
      }

      let chunks: ChunkInfo[]
      try {
        chunks = JSON.parse(file.content)
        chunks.sort((a: ChunkInfo, b: ChunkInfo) => a.index - b.index)
      } catch {
        return json({ error: "Invalid file data" }, 500)
      }

      // Calculate total size from metadata
      const totalLength = chunks.reduce((sum, c) => sum + c.size, 0)

      // Determine content type
      const ext = file.name.split('.').pop()?.toLowerCase() || ''
      const mimeTypes: Record<string, string> = {
        mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg',
        wav: 'audio/wav', png: 'image/png', jpg: 'image/jpeg',
        jpeg: 'image/jpeg', gif: 'image/gif', pdf: 'application/pdf',
        zip: 'application/zip', txt: 'text/plain',
      }
      const contentType = mimeTypes[ext] || 'application/octet-stream'

      // Create a stream to serve chunks sequentially without buffering the whole file
      const stream = new ReadableStream({
        async start(controller) {
          try {
            for (const chunk of chunks) {
              try {
                const response = await fetch(chunk.url)
                if (!response.ok) throw new Error(`Chunk fetch failed: ${response.status}`)

                if (!response.body) throw new Error("No body in chunk response")

                // Pipe the chunk's body to our controller
                const reader = response.body.getReader()
                while (true) {
                  const { done, value } = await reader.read()
                  if (done) break
                  controller.enqueue(value)
                }
              } catch (e) {
                console.error(`Error fetching chunk ${chunk.index}:`, e)
                controller.error(e)
                return
              }
            }
            controller.close()
          } catch (e) {
            controller.error(e)
          }
        }
      })

      return new Response(stream, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": contentType,
          "Content-Length": String(totalLength),
          "Content-Disposition": `attachment; filename="${file.name}"`
        }
      })
    }

    // DELETE /shares/:userId/:shareId - Revoke share
    const deleteShareMatch = path.match(/^\/shares\/([^\/]+)\/([a-f0-9-]+)$/)
    if (deleteShareMatch && method === "DELETE") {
      const [, userId, shareId] = deleteShareMatch
      const supabase = getSupabase()

      // Delete share (only if belongs to user)
      const { error } = await supabase
        .from("shares")
        .delete()
        .eq("id", shareId)
        .eq("user_id", userId)

      if (error) return json({ error: error.message }, 500)
      return json({ success: true })
    }

    // GET /shares/:userId/:fileId - List shares for a file
    const listSharesMatch = path.match(/^\/shares\/([^\/]+)\/(\d+)$/)
    if (listSharesMatch && method === "GET") {
      const [, userId, fileId] = listSharesMatch
      const supabase = getSupabase()

      const { data: shares, error } = await supabase
        .from("shares")
        .select("id, created_at, expires_at, download_count")
        .eq("user_id", userId)
        .eq("file_id", fileId)

      if (error) return json({ error: error.message }, 500)
      return json(shares || [])
    }

    // Not found
    return json({ error: "Not found", path, method }, 404)

  } catch (error) {
    console.error("Error:", error)
    return json({ error: String(error) }, 500)
  }
})
