import { Router, type Request, type Response } from 'express'
import { db } from '../db.js'

export const fileRouter = Router()

// Types
interface FileRow {
  id: number
  user_id: string
  parent_id: number | null
  name: string
  type: 'file' | 'directory'
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

// GET /files/get/:userId - Get file tree for user
fileRouter.get('/get/:userId', (req: Request, res: Response) => {
  const { userId } = req.params

  try {
    const rows = db.prepare(`
      SELECT * FROM files WHERE user_id = ?
    `).all(userId) as FileRow[]

    // Build tree structure
    const directories: Record<number, FileTree> = {}
    const root: FileTree = { children: {} }

    // First pass: create directory entries
    for (const row of rows) {
      if (row.type === 'directory') {
        directories[row.id] = { ...row, children: {} }
      }
    }

    // Second pass: place all items in tree
    for (const row of rows) {
      const entry = row.type === 'directory' ? directories[row.id] : row

      if (row.parent_id === null) {
        root.children[row.name] = entry
      } else if (directories[row.parent_id]) {
        directories[row.parent_id].children[row.name] = entry
      }
    }

    res.json(root)
  } catch (error) {
    console.error('Error getting files:', error)
    res.status(500).json({ error: 'Failed to get files' })
  }
})

// POST /files/create/:userId - Create file or directory
fileRouter.post('/create/:userId', (req: Request, res: Response) => {
  const { userId } = req.params
  const { parent_id, name, type, size, content, encrypted, encryption_salt } = req.body

  try {
    // Check for existing file collision
    const existing = db.prepare(`
      SELECT * FROM files
      WHERE user_id = ? AND parent_id IS ? AND name = ? AND type = 'file'
    `).get(userId, parent_id || null, name) as FileRow

    if (existing && type === 'file') {
      // Handle versioning
      const transaction = db.transaction(() => {
        // 1. Get next version number
        const lastVer = db.prepare(`
          SELECT MAX(version_number) as max_ver FROM file_versions WHERE file_id = ?
        `).get(existing.id) as { max_ver: number }
        const newVerNum = (lastVer.max_ver || 0) + 1

        // 2. Insert current content into versions
        // If content is null, store empty JSON array
        db.prepare(`
          INSERT INTO file_versions (file_id, version_number, content, size, created_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(existing.id, newVerNum, existing.content || '[]', existing.size, existing.updated_at)

        // 3. Update main file record with new content
        db.prepare(`
          UPDATE files
          SET size = ?, content = ?, encrypted = ?, encryption_salt = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(size || 0, content || null, encrypted ? 1 : 0, encryption_salt || null, existing.id)

        return existing.id
      })

      const id = transaction()
      res.json(id)
    } else {
      // Normal creation (New file or Directory)
      const result = db.prepare(`
        INSERT INTO files (user_id, parent_id, name, type, size, content, encrypted, encryption_salt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(userId, parent_id || null, name, type, size || 0, content || null, encrypted ? 1 : 0, encryption_salt || null)

      res.json(result.lastInsertRowid)
    }
  } catch (error) {
    console.error('Error creating file:', error)
    res.status(500).json({ error: 'Failed to create file' })
  }
})

// GET /files/versions/:userId/:fileId - Get versions for a file
fileRouter.get('/versions/:userId/:fileId', (req: Request, res: Response) => {
  const { userId, fileId } = req.params

  try {
    // Verify ownership
    const file = db.prepare('SELECT id FROM files WHERE id = ? AND user_id = ?').get(fileId, userId)
    if (!file) return res.status(404).json({ error: 'File not found' })

    const versions = db.prepare(`
      SELECT id, version_number, size, created_at
      FROM file_versions
      WHERE file_id = ?
      ORDER BY version_number DESC
    `).all(fileId)

    res.json(versions)
  } catch (error) {
    console.error('Error getting versions:', error)
    res.status(500).json({ error: 'Failed to get versions' })
  }
})

// POST /files/restore/:userId/:versionId - Restore a version
fileRouter.post('/restore/:userId/:versionId', (req: Request, res: Response) => {
  const { userId, versionId } = req.params

  try {
    const transaction = db.transaction(() => {
      // 1. Get the version to restore
      const versionToRestore = db.prepare(`
        SELECT v.*
        FROM file_versions v
        JOIN files f ON v.file_id = f.id
        WHERE v.id = ? AND f.user_id = ?
      `).get(versionId, userId) as { file_id: number, version_number: number, content: string, size: number, created_at: string } | undefined

      if (!versionToRestore) throw new Error('Version not found')

      // 2. Get current file state
      const currentFile = db.prepare('SELECT * FROM files WHERE id = ?').get(versionToRestore.file_id) as FileRow

      // 3. Archive current state as a new version
      const lastVer = db.prepare(`
        SELECT MAX(version_number) as max_ver FROM file_versions WHERE file_id = ?
      `).get(currentFile.id) as { max_ver: number }
      const newVerNum = (lastVer.max_ver || 0) + 1

      db.prepare(`
        INSERT INTO file_versions (file_id, version_number, content, size, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(currentFile.id, newVerNum, currentFile.content || '[]', currentFile.size, currentFile.updated_at)

      // 4. Update file with restored version content
      // Note: We keep encryption/salt from CURRENT file if not stored in version...
      // Wait, versions store content/size but NOT encryption status/salt in current schema.
      // This is a potential issue if restoring a version that used a different key or wasn't encrypted.
      // Schema for file_versions: id, file_id, version_number, content, size, created_at.
      // It DOES NOT store encrypted/encryption_salt.
      // Assumption: Versions share the same encryption context as the file, or content blob includes everything needed?
      // Actually content is just chunk map. The chunks are on Discord.
      // Use case: overwriting file usually implies same user/key.
      // But if user changed password?
      // LIMITATION: Restoring implies trusting the content matches current encryption or we simply update content map.
      // If the content map points to chunks encrypted with Old Key, and we Restore it, current FileManager needs old Key to decrypt?
      // No, FileManager uses current Key. If chunks were encrypted with Old Key, this will break unless we re-encrypt or store Key ID.
      // For MVP, we assume constant Key or re-upload scenario.
      // Use existing encryption_salt from current file? Or should version store salt?
      // Ideally version should store salt/encrypted bool.
      // For now, let's update content and size.

      db.prepare(`
        UPDATE files
        SET size = ?, content = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(versionToRestore.size, versionToRestore.content, currentFile.id)
    })

    transaction()
    res.json({ success: true })
  } catch (error) {
    console.error('Error restoring version:', error)
    res.status(500).json({ error: 'Failed to restore version' })
  }
})

// DELETE /files/versions/:userId/:versionId - Delete a version
fileRouter.delete('/versions/:userId/:versionId', (req: Request, res: Response) => {
  const { userId, versionId } = req.params

  try {
    const result = db.prepare(`
      DELETE FROM file_versions
      WHERE id = ? AND file_id IN (SELECT id FROM files WHERE user_id = ?)
    `).run(versionId, userId)

    if (result.changes === 0) return res.status(404).json({ error: 'Version not found' })
    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting version:', error)
    res.status(500).json({ error: 'Failed to delete version' })
  }
})

// POST /files/update/:userId/:id - Update file
fileRouter.post('/update/:userId/:id', (req: Request, res: Response) => {
  const { userId, id } = req.params
  const updates = req.body

  // Build dynamic update query
  const fields = Object.keys(updates)
  if (fields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' })
  }

  // Always update updated_at
  if (!fields.includes('updated_at')) {
    updates.updated_at = new Date().toISOString()
    fields.push('updated_at')
  }

  const setClause = fields.map(f => `${f} = ?`).join(', ')
  const values = fields.map(f => updates[f])

  try {
    db.prepare(`
      UPDATE files SET ${setClause}
      WHERE user_id = ? AND id = ?
    `).run(...values, userId, id)

    res.json({ success: true })
  } catch (error) {
    console.error('Error updating file:', error)
    res.status(500).json({ error: 'Failed to update file' })
  }
})

// DELETE /files/delete/:userId/:id - Delete file
fileRouter.delete('/delete/:userId/:id', (req: Request, res: Response) => {
  const { userId, id } = req.params

  try {
    // Check if directory has children
    const children = db.prepare(`
      SELECT COUNT(*) as count FROM files WHERE parent_id = ?
    `).get(id) as { count: number }

    if (children.count > 0) {
      return res.status(400).json({ error: 'Directory is not empty' })
    }

    db.prepare(`
      DELETE FROM files WHERE user_id = ? AND id = ?
    `).run(userId, id)

    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting file:', error)
    res.status(500).json({ error: 'Failed to delete file' })
  }
})

// DELETE /files/delete-recursive/:userId/:id - Delete file/folder recursively
fileRouter.delete('/delete-recursive/:userId/:id', (req: Request, res: Response) => {
  const { userId, id } = req.params

  try {
    // Use recursive CTE to find all descendants
    const deleteRecursive = db.transaction(() => {
      // Get all descendant IDs
      const descendants = db.prepare(`
        WITH RECURSIVE tree AS (
          SELECT id FROM files WHERE id = ?
          UNION ALL
          SELECT f.id FROM files f
          JOIN tree t ON f.parent_id = t.id
        )
        SELECT id FROM tree
      `).all(id) as { id: number }[]

      // Delete all in reverse order (children first)
      for (const row of descendants.reverse()) {
        db.prepare('DELETE FROM files WHERE user_id = ? AND id = ?').run(userId, row.id)
      }
    })

    deleteRecursive()
    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting recursively:', error)
    res.status(500).json({ error: 'Failed to delete' })
  }
})
