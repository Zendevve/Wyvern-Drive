import { Router, type Request, type Response } from 'express'
import { db } from '../database.js'

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
fileRouter.get('/get/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params

  try {
    const rows = await db.query<FileRow>('SELECT * FROM files WHERE user_id = ?', [userId])

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
fileRouter.post('/create/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params
  const { parent_id, name, type, size, content, encrypted, encryption_salt } = req.body

  try {
    // Check for existing file collision
    const existing = await db.queryOne<FileRow>(
      `SELECT * FROM files WHERE user_id = ? AND parent_id IS ? AND name = ? AND type = 'file'`,
      [userId, parent_id || null, name]
    )

    if (existing && type === 'file') {
      // Handle versioning
      await db.transaction(async () => {
        // 1. Get next version number
        const lastVer = await db.queryOne<{ max_ver: number }>(
          'SELECT MAX(version_number) as max_ver FROM file_versions WHERE file_id = ?',
          [existing.id]
        )
        const newVerNum = (lastVer?.max_ver || 0) + 1

        // 2. Insert current content into versions
        await db.execute(
          'INSERT INTO file_versions (file_id, version_number, content, size, created_at) VALUES (?, ?, ?, ?, ?)',
          [existing.id, newVerNum, existing.content || '[]', existing.size, existing.updated_at]
        )

        // 3. Update main file record with new content
        await db.execute(
          `UPDATE files SET size = ?, content = ?, encrypted = ?, encryption_salt = ?, updated_at = datetime('now') WHERE id = ?`,
          [size || 0, content || null, encrypted ? 1 : 0, encryption_salt || null, existing.id]
        )
      })

      res.json(existing.id)
    } else {
      // Normal creation (New file or Directory)
      const result = await db.execute(
        'INSERT INTO files (user_id, parent_id, name, type, size, content, encrypted, encryption_salt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, parent_id || null, name, type, size || 0, content || null, encrypted ? 1 : 0, encryption_salt || null]
      )

      res.json(result.lastInsertRowid)
    }
  } catch (error) {
    console.error('Error creating file:', error)
    res.status(500).json({ error: 'Failed to create file' })
  }
})

// GET /files/versions/:userId/:fileId - Get versions for a file
fileRouter.get('/versions/:userId/:fileId', async (req: Request, res: Response) => {
  const { userId, fileId } = req.params

  try {
    // Verify ownership
    const file = await db.queryOne('SELECT id FROM files WHERE id = ? AND user_id = ?', [fileId, userId])
    if (!file) return res.status(404).json({ error: 'File not found' })

    const versions = await db.query(
      'SELECT id, version_number, size, created_at FROM file_versions WHERE file_id = ? ORDER BY version_number DESC',
      [fileId]
    )

    res.json(versions)
  } catch (error) {
    console.error('Error getting versions:', error)
    res.status(500).json({ error: 'Failed to get versions' })
  }
})

// POST /files/restore/:userId/:versionId - Restore a version
fileRouter.post('/restore/:userId/:versionId', async (req: Request, res: Response) => {
  const { userId, versionId } = req.params

  try {
    await db.transaction(async () => {
      // 1. Get the version to restore
      const versionToRestore = await db.queryOne<{ file_id: number; version_number: number; content: string; size: number; created_at: string }>(
        'SELECT v.* FROM file_versions v JOIN files f ON v.file_id = f.id WHERE v.id = ? AND f.user_id = ?',
        [versionId, userId]
      )

      if (!versionToRestore) throw new Error('Version not found')

      // 2. Get current file state
      const currentFile = await db.queryOne<FileRow>('SELECT * FROM files WHERE id = ?', [versionToRestore.file_id])
      if (!currentFile) throw new Error('File not found')

      // 3. Archive current state as a new version
      const lastVer = await db.queryOne<{ max_ver: number }>(
        'SELECT MAX(version_number) as max_ver FROM file_versions WHERE file_id = ?',
        [currentFile.id]
      )
      const newVerNum = (lastVer?.max_ver || 0) + 1

      await db.execute(
        'INSERT INTO file_versions (file_id, version_number, content, size, created_at) VALUES (?, ?, ?, ?, ?)',
        [currentFile.id, newVerNum, currentFile.content || '[]', currentFile.size, currentFile.updated_at]
      )

      // 4. Update file with restored version content
      await db.execute(
        `UPDATE files SET size = ?, content = ?, updated_at = datetime('now') WHERE id = ?`,
        [versionToRestore.size, versionToRestore.content, currentFile.id]
      )
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Error restoring version:', error)
    res.status(500).json({ error: 'Failed to restore version' })
  }
})

// DELETE /files/versions/:userId/:versionId - Delete a version
fileRouter.delete('/versions/:userId/:versionId', async (req: Request, res: Response) => {
  const { userId, versionId } = req.params

  try {
    const result = await db.execute(
      'DELETE FROM file_versions WHERE id = ? AND file_id IN (SELECT id FROM files WHERE user_id = ?)',
      [versionId, userId]
    )

    if (result.changes === 0) return res.status(404).json({ error: 'Version not found' })
    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting version:', error)
    res.status(500).json({ error: 'Failed to delete version' })
  }
})

// POST /files/update/:userId/:id - Update file
fileRouter.post('/update/:userId/:id', async (req: Request, res: Response) => {
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
  const values = [...fields.map(f => updates[f]), userId, id]

  try {
    await db.execute(`UPDATE files SET ${setClause} WHERE user_id = ? AND id = ?`, values)
    res.json({ success: true })
  } catch (error) {
    console.error('Error updating file:', error)
    res.status(500).json({ error: 'Failed to update file' })
  }
})

// DELETE /files/delete/:userId/:id - Delete file
fileRouter.delete('/delete/:userId/:id', async (req: Request, res: Response) => {
  const { userId, id } = req.params

  try {
    // Check if directory has children
    const children = await db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM files WHERE parent_id = ?', [id])

    if (children && children.count > 0) {
      return res.status(400).json({ error: 'Directory is not empty' })
    }

    await db.execute('DELETE FROM files WHERE user_id = ? AND id = ?', [userId, id])
    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting file:', error)
    res.status(500).json({ error: 'Failed to delete file' })
  }
})

// DELETE /files/delete-recursive/:userId/:id - Delete file/folder recursively
fileRouter.delete('/delete-recursive/:userId/:id', async (req: Request, res: Response) => {
  const { userId, id } = req.params

  try {
    await db.transaction(async () => {
      // Get all descendant IDs using recursive CTE
      const descendants = await db.query<{ id: number }>(
        `WITH RECURSIVE tree AS (
          SELECT id FROM files WHERE id = ?
          UNION ALL
          SELECT f.id FROM files f JOIN tree t ON f.parent_id = t.id
        ) SELECT id FROM tree`,
        [id]
      )

      // Delete all in reverse order (children first)
      for (const row of descendants.reverse()) {
        await db.execute('DELETE FROM files WHERE user_id = ? AND id = ?', [userId, row.id])
      }
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting recursively:', error)
    res.status(500).json({ error: 'Failed to delete' })
  }
})
