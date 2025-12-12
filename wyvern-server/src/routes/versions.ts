import { Router, type Request, type Response } from 'express'
import { db } from '../db.js'

export const versionRouter = Router()

interface VersionRow {
  id: number
  file_id: number
  version_number: number
  content: string
  size: number
  created_at: string
}

// GET /versions/:userId/:fileId - List versions for a file
versionRouter.get('/:userId/:fileId', (req: Request, res: Response) => {
  const { userId, fileId } = req.params

  try {
    // Verify file belongs to user
    const file = db.prepare(`
      SELECT id FROM files WHERE user_id = ? AND id = ?
    `).get(userId, fileId)

    if (!file) {
      return res.status(404).json({ error: 'File not found' })
    }

    const versions = db.prepare(`
      SELECT * FROM file_versions WHERE file_id = ? ORDER BY version_number DESC
    `).all(fileId) as VersionRow[]

    res.json(versions)
  } catch (error) {
    console.error('Error getting versions:', error)
    res.status(500).json({ error: 'Failed to get versions' })
  }
})

// POST /versions/:userId/:fileId - Create a new version
versionRouter.post('/:userId/:fileId', (req: Request, res: Response) => {
  const { userId, fileId } = req.params
  const { content, size } = req.body

  try {
    // Verify file belongs to user
    const file = db.prepare(`
      SELECT id FROM files WHERE user_id = ? AND id = ?
    `).get(userId, fileId)

    if (!file) {
      return res.status(404).json({ error: 'File not found' })
    }

    // Get next version number
    const lastVersion = db.prepare(`
      SELECT MAX(version_number) as max FROM file_versions WHERE file_id = ?
    `).get(fileId) as { max: number | null }

    const versionNumber = (lastVersion.max || 0) + 1

    const result = db.prepare(`
      INSERT INTO file_versions (file_id, version_number, content, size)
      VALUES (?, ?, ?, ?)
    `).run(fileId, versionNumber, content, size)

    res.json({
      id: result.lastInsertRowid,
      versionNumber
    })
  } catch (error) {
    console.error('Error creating version:', error)
    res.status(500).json({ error: 'Failed to create version' })
  }
})

// POST /versions/:userId/:fileId/restore/:versionId - Restore a version
versionRouter.post('/:userId/:fileId/restore/:versionId', (req: Request, res: Response) => {
  const { userId, fileId, versionId } = req.params

  try {
    // Get the version to restore
    const version = db.prepare(`
      SELECT * FROM file_versions WHERE file_id = ? AND id = ?
    `).get(fileId, versionId) as VersionRow | undefined

    if (!version) {
      return res.status(404).json({ error: 'Version not found' })
    }

    // Update the file with the version's content
    db.prepare(`
      UPDATE files SET content = ?, size = ?, updated_at = datetime('now')
      WHERE user_id = ? AND id = ?
    `).run(version.content, version.size, userId, fileId)

    res.json({ success: true })
  } catch (error) {
    console.error('Error restoring version:', error)
    res.status(500).json({ error: 'Failed to restore version' })
  }
})

// DELETE /versions/:userId/:fileId/:versionId - Delete a version
versionRouter.delete('/:userId/:fileId/:versionId', (req: Request, res: Response) => {
  const { userId, fileId, versionId } = req.params

  try {
    // Verify file belongs to user
    const file = db.prepare(`
      SELECT id FROM files WHERE user_id = ? AND id = ?
    `).get(userId, fileId)

    if (!file) {
      return res.status(404).json({ error: 'File not found' })
    }

    db.prepare(`
      DELETE FROM file_versions WHERE file_id = ? AND id = ?
    `).run(fileId, versionId)

    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting version:', error)
    res.status(500).json({ error: 'Failed to delete version' })
  }
})
