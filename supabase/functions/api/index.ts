// Supabase Edge Function: Consolidated API using Hono
// Handles all file and version CRUD operations

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { Hono } from "https://deno.land/x/hono@v3.4.1/mod.ts"
import { cors } from "https://deno.land/x/hono@v3.4.1/middleware.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const app = new Hono()

// Enable CORS
app.use("*", cors())

// Create Supabase client
function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  )
}

// ============ FILE ROUTES ============

// GET /files/:userId - Get all files for user as tree
app.get("/files/:userId", async (c) => {
  const userId = c.req.param("userId")
  const supabase = getSupabase()

  const { data: rows, error } = await supabase
    .from("files")
    .select("*")
    .eq("user_id", userId)

  if (error) {
    return c.json({ error: error.message }, 500)
  }

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

  // First pass: create directory entries
  for (const row of rows as FileRow[]) {
    if (row.type === "directory") {
      directories[row.id] = { ...row, children: {} }
    }
  }

  // Second pass: place all items in tree
  for (const row of rows as FileRow[]) {
    const entry = row.type === "directory" ? directories[row.id] : row

    if (row.parent_id === null) {
      root.children[row.name] = entry
    } else if (directories[row.parent_id]) {
      directories[row.parent_id].children[row.name] = entry
    }
  }

  return c.json(root)
})

// POST /files/:userId - Create file or directory
app.post("/files/:userId", async (c) => {
  const userId = c.req.param("userId")
  const body = await c.req.json()
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
    .single()

  if (existing && type === "file") {
    // Handle versioning - archive old version
    const { data: lastVer } = await supabase
      .from("file_versions")
      .select("version_number")
      .eq("file_id", existing.id)
      .order("version_number", { ascending: false })
      .limit(1)
      .single()

    const newVerNum = (lastVer?.version_number || 0) + 1

    // Insert old content as version
    await supabase.from("file_versions").insert({
      file_id: existing.id,
      version_number: newVerNum,
      content: existing.content || "[]",
      size: existing.size,
    })

    // Update main file
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

    return c.json(existing.id)
  } else {
    // Normal creation
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
      return c.json({ error: error.message }, 500)
    }

    return c.json(data.id)
  }
})

// POST /files/:userId/:id/update - Update file
app.post("/files/:userId/:id/update", async (c) => {
  const userId = c.req.param("userId")
  const id = c.req.param("id")
  const updates = await c.req.json()
  const supabase = getSupabase()

  updates.updated_at = new Date().toISOString()

  const { error } = await supabase
    .from("files")
    .update(updates)
    .eq("user_id", userId)
    .eq("id", id)

  if (error) {
    return c.json({ error: error.message }, 500)
  }

  return c.json({ success: true })
})

// DELETE /files/:userId/:id - Delete file
app.delete("/files/:userId/:id", async (c) => {
  const userId = c.req.param("userId")
  const id = c.req.param("id")
  const supabase = getSupabase()

  // Check for children
  const { data: children } = await supabase
    .from("files")
    .select("id")
    .eq("parent_id", id)

  if (children && children.length > 0) {
    return c.json({ error: "Directory is not empty" }, 400)
  }

  const { error } = await supabase
    .from("files")
    .delete()
    .eq("user_id", userId)
    .eq("id", id)

  if (error) {
    return c.json({ error: error.message }, 500)
  }

  return c.json({ success: true })
})

// DELETE /files/:userId/:id/recursive - Delete recursively
app.delete("/files/:userId/:id/recursive", async (c) => {
  const userId = c.req.param("userId")
  const id = c.req.param("id")
  const supabase = getSupabase()

  // Get all descendants using recursive query
  // Note: Supabase doesn't support CTEs directly, so we need to do this iteratively
  const toDelete: number[] = [parseInt(id)]
  let index = 0

  while (index < toDelete.length) {
    const currentId = toDelete[index]
    const { data: children } = await supabase
      .from("files")
      .select("id")
      .eq("parent_id", currentId)

    if (children) {
      for (const child of children) {
        toDelete.push(child.id)
      }
    }
    index++
  }

  // Delete in reverse order (children first)
  for (const fileId of toDelete.reverse()) {
    await supabase.from("files").delete().eq("user_id", userId).eq("id", fileId)
  }

  return c.json({ success: true })
})

// ============ VERSION ROUTES ============

// GET /versions/:userId/:fileId - Get versions for file
app.get("/versions/:userId/:fileId", async (c) => {
  const userId = c.req.param("userId")
  const fileId = c.req.param("fileId")
  const supabase = getSupabase()

  // Verify ownership
  const { data: file } = await supabase
    .from("files")
    .select("id")
    .eq("user_id", userId)
    .eq("id", fileId)
    .single()

  if (!file) {
    return c.json({ error: "File not found" }, 404)
  }

  const { data: versions, error } = await supabase
    .from("file_versions")
    .select("id, version_number, size, created_at")
    .eq("file_id", fileId)
    .order("version_number", { ascending: false })

  if (error) {
    return c.json({ error: error.message }, 500)
  }

  return c.json(versions)
})

// POST /versions/:userId/:fileId - Create version
app.post("/versions/:userId/:fileId", async (c) => {
  const userId = c.req.param("userId")
  const fileId = c.req.param("fileId")
  const { content, size } = await c.req.json()
  const supabase = getSupabase()

  // Verify ownership
  const { data: file } = await supabase
    .from("files")
    .select("id")
    .eq("user_id", userId)
    .eq("id", fileId)
    .single()

  if (!file) {
    return c.json({ error: "File not found" }, 404)
  }

  // Get next version number
  const { data: lastVer } = await supabase
    .from("file_versions")
    .select("version_number")
    .eq("file_id", fileId)
    .order("version_number", { ascending: false })
    .limit(1)
    .single()

  const versionNumber = (lastVer?.version_number || 0) + 1

  const { data, error } = await supabase
    .from("file_versions")
    .insert({ file_id: parseInt(fileId), version_number: versionNumber, content, size })
    .select("id")
    .single()

  if (error) {
    return c.json({ error: error.message }, 500)
  }

  return c.json({ id: data.id, versionNumber })
})

// POST /versions/:userId/:fileId/restore/:versionId - Restore version
app.post("/versions/:userId/:fileId/restore/:versionId", async (c) => {
  const userId = c.req.param("userId")
  const fileId = c.req.param("fileId")
  const versionId = c.req.param("versionId")
  const supabase = getSupabase()

  // Get version to restore
  const { data: version } = await supabase
    .from("file_versions")
    .select("*")
    .eq("file_id", fileId)
    .eq("id", versionId)
    .single()

  if (!version) {
    return c.json({ error: "Version not found" }, 404)
  }

  // Update file with version content
  const { error } = await supabase
    .from("files")
    .update({
      content: version.content,
      size: version.size,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", fileId)

  if (error) {
    return c.json({ error: error.message }, 500)
  }

  return c.json({ success: true })
})

// DELETE /versions/:userId/:fileId/:versionId - Delete version
app.delete("/versions/:userId/:fileId/:versionId", async (c) => {
  const userId = c.req.param("userId")
  const fileId = c.req.param("fileId")
  const versionId = c.req.param("versionId")
  const supabase = getSupabase()

  // Verify file ownership
  const { data: file } = await supabase
    .from("files")
    .select("id")
    .eq("user_id", userId)
    .eq("id", fileId)
    .single()

  if (!file) {
    return c.json({ error: "File not found" }, 404)
  }

  const { error } = await supabase
    .from("file_versions")
    .delete()
    .eq("file_id", fileId)
    .eq("id", versionId)

  if (error) {
    return c.json({ error: error.message }, 500)
  }

  return c.json({ success: true })
})

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok", name: "Wyvern Drive API" })
})

serve(app.fetch)
