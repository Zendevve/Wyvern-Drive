import { Router, type Request, type Response } from 'express'
import { db } from '../database.js'

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
versionRouter.get('/:userId/:fileId', async (req: Request, res: Response) => {
  const { userId, fileId } = req.params

  try {
    // Verify file belongs to user
    const file = await db.queryOne('SELECT id FROM files WHERE user_id = ? AND id = ?', [userId, fileId])

    if (!file) {
      return res.status(404).json({ error: 'File not found' })
    }

    const versions = await db.query<VersionRow>(
      'SELECT * FROM file_versions WHERE file_id = ? ORDER BY version_number DESC',
      [fileId]
    )

    res.json(versions)
  } catch (error) {
    console.error('Error getting versions:', error)
    res.status(500).json({ error: 'Failed to get versions' })
  }
})

// POST /versions/:userId/:fileId - Create a new version
versionRouter.post('/:userId/:fileId', async (req: Request, res: Response) => {
  const { userId, fileId } = req.params
  const { content, size } = req.body

  try {
    // Verify file belongs to user
    const file = await db.queryOne('SELECT id FROM files WHERE user_id = ? AND id = ?', [userId, fileId])

    if (!file) {
      return res.status(404).json({ error: 'File not found' })
    }

    // Get next version number
    const lastVersion = await db.queryOne<{ max: number | null }>(
      'SELECT MAX(version_number) as max FROM file_versions WHERE file_id = ?',
      [fileId]
    )

    const versionNumber = (lastVersion?.max || 0) + 1

    const result = await db.execute(
      'INSERT INTO file_versions (file_id, version_number, content, size) VALUES (?, ?, ?, ?)',
      [fileId, versionNumber, content, size]
    )

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
versionRouter.post('/:userId/:fileId/restore/:versionId', async (req: Request, res: Response) => {
  const { userId, fileId, versionId } = req.params

  try {
    // Get the version to restore
    const version = await db.queryOne<VersionRow>(
      'SELECT * FROM file_versions WHERE file_id = ? AND id = ?',
      [fileId, versionId]
    )

    if (!version) {
      return res.status(404).json({ error: 'Version not found' })
    }

    // Update the file with the version's content
    await db.execute(
      `UPDATE files SET content = ?, size = ?, updated_at = datetime('now') WHERE user_id = ? AND id = ?`,
      [version.content, version.size, userId, fileId]
    )

    res.json({ success: true })
  } catch (error) {
    console.error('Error restoring version:', error)
    res.status(500).json({ error: 'Failed to restore version' })
  }
})

// DELETE /versions/:userId/:fileId/:versionId - Delete a version
versionRouter.delete('/:userId/:fileId/:versionId', async (req: Request, res: Response) => {
  const { userId, fileId, versionId } = req.params

  try {
    // Verify file belongs to user
    const file = await db.queryOne('SELECT id FROM files WHERE user_id = ? AND id = ?', [userId, fileId])

    if (!file) {
      return res.status(404).json({ error: 'File not found' })
    }

    await db.execute('DELETE FROM file_versions WHERE file_id = ? AND id = ?', [fileId, versionId])

    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting version:', error)
    res.status(500).json({ error: 'Failed to delete version' })
  }
})
