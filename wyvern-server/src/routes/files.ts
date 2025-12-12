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
    const result = db.prepare(`
      INSERT INTO files (user_id, parent_id, name, type, size, content, encrypted, encryption_salt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, parent_id || null, name, type, size || 0, content || null, encrypted || 0, encryption_salt || null)

    res.json(result.lastInsertRowid)
  } catch (error) {
    console.error('Error creating file:', error)
    res.status(500).json({ error: 'Failed to create file' })
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
