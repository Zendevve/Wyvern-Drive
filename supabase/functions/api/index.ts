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

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  const url = new URL(req.url)
  // Supabase prepends function name to path, so "/api/files/123" becomes the path
  // Strip the "/api" prefix to get the actual route
  const rawPath = url.pathname
  const path = rawPath.startsWith("/api") ? rawPath.slice(4) : rawPath
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
      const body = await req.json()
      const { parent_id, name, type, size, content, encrypted, encryption_salt } = body
      const supabase = getSupabase()

      // Check for existing file collision
      const { data: existing } = await supabase
        .from("files")
        .select("*")
        .eq("user_id", userId)
        .is("parent_id", parent_id || null)
        .eq("name", name)
        .eq("type", "file")
        .maybeSingle()

      if (existing && type === "file") {
        // Handle versioning
        const { data: lastVer } = await supabase
          .from("file_versions")
          .select("version_number")
          .eq("file_id", existing.id)
          .order("version_number", { ascending: false })
          .limit(1)
          .maybeSingle()

        const newVerNum = (lastVer?.version_number || 0) + 1

        await supabase.from("file_versions").insert({
          file_id: existing.id,
          version_number: newVerNum,
          content: existing.content || "[]",
          size: existing.size,
        })

        await supabase
          .from("files")
          .update({
            size: size || 0,
            content: content || null,
            encrypted: encrypted ? 1 : 0,
            encryption_salt: encryption_salt || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)

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

        if (error) return json({ error: error.message }, 500)
        return json(data.id)
      }
    }

    // POST /files/:userId/:id/update
    const updateMatch = path.match(/^\/files\/([^\/]+)\/(\d+)\/update$/)
    if (updateMatch && method === "POST") {
      const [, userId, id] = updateMatch
      const updates = await req.json()
      const supabase = getSupabase()

      updates.updated_at = new Date().toISOString()

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

    // Not found
    return json({ error: "Not found", path, method }, 404)

  } catch (error) {
    console.error("Error:", error)
    return json({ error: String(error) }, 500)
  }
})
