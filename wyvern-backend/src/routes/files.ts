import { Router, Response } from 'express';
import { getDatabase } from '../db/database.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// Helper to build recursive file tree
function buildUserTree(db: any, userId: string, parentId: number | null, parentPath: string): Record<string, any> {
  const children: Record<string, any> = {};

  const query = parentId === null 
    ? 'SELECT * FROM files WHERE user_id = ? AND parent_id IS NULL'
    : 'SELECT * FROM files WHERE user_id = ? AND parent_id = ?';

  const params = parentId === null ? [userId] : [userId, parentId];
  const rows = db.prepare(query).all(...params) as any[];

  for (const row of rows) {
    const childPath = parentPath ? `${parentPath}/${row.name}` : row.name;
    if (row.type === 'directory') {
      children[row.name] = {
        id: row.id,
        name: row.name,
        type: 'directory',
        path: childPath,
        parent_id: row.parent_id,
        children: buildUserTree(db, userId, row.id, childPath),
        created_at: row.created_at,
        updated_at: row.updated_at
      };
    } else {
      children[row.name] = {
        id: row.id,
        name: row.name,
        type: 'file',
        size: row.size,
        path: childPath,
        parent_id: row.parent_id,
        content: row.content,
        encrypted: Boolean(row.encrypted),
        encryption_salt: row.encryption_salt,
        created_at: row.created_at,
        updated_at: row.updated_at
      };
    }
  }

  return children;
}

// 1. GET /api/files/:userId - Get file tree
router.get('/files/:userId', authMiddleware, (req: AuthenticatedRequest, res) => {
  if (req.userId !== req.params.userId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const db = getDatabase();
  try {
    const children = buildUserTree(db, req.params.userId, null, '');
    res.json({
      id: 0,
      name: 'Root',
      type: 'directory',
      path: '',
      parent_id: null,
      children,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch files' });
  }
});

// 2. POST /api/files/:userId - Create file or directory
router.post('/files/:userId', authMiddleware, (req: AuthenticatedRequest, res) => {
  if (req.userId !== req.params.userId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const { name, type, size, parent_id, content, encrypted, encryption_salt } = req.body;
  if (!name || !type) {
    res.status(400).json({ error: 'Name and type are required' });
    return;
  }

  const db = getDatabase();
  const now = new Date().toISOString();

  try {
    // Validate parent
    if (parent_id) {
      const parent = db.prepare('SELECT type FROM files WHERE id = ?').get(parent_id) as any;
      if (!parent || parent.type !== 'directory') {
        res.status(400).json({ error: 'Invalid parent folder' });
        return;
      }
    }

    // Check duplicate
    const existing = parent_id
      ? db.prepare('SELECT * FROM files WHERE user_id = ? AND name = ? AND parent_id = ?').get(req.params.userId, name, parent_id) as any
      : db.prepare('SELECT * FROM files WHERE user_id = ? AND name = ? AND parent_id IS NULL').get(req.params.userId, name) as any;

    if (existing) {
      if (type === 'directory') {
        // Just return existing directory ID
        res.json(existing.id);
        return;
      } else {
        // It's a file, so create a version of the old file first in file_versions table
        const maxVerRow = db.prepare('SELECT COALESCE(MAX(version_num), 0) as max_v FROM file_versions WHERE file_id = ?').get(existing.id) as any;
        const nextVersion = (maxVerRow?.max_v || 0) + 1;

        db.prepare(`
          INSERT INTO file_versions (file_id, user_id, version_num, name, size, content, encrypted, encryption_salt, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          existing.id, 
          req.params.userId, 
          nextVersion, 
          existing.name, 
          existing.size, 
          existing.content || '', 
          existing.encrypted, 
          existing.encryption_salt, 
          existing.updated_at || existing.created_at
        );

        // Update existing file with new content
        db.prepare(`
          UPDATE files
          SET size = ?, content = ?, encrypted = ?, encryption_salt = ?, updated_at = ?
          WHERE id = ?
        `).run(size || 0, content, encrypted ? 1 : 0, encryption_salt, now, existing.id);

        res.json(existing.id);
        return;
      }
    }

    // Insert new file/directory (path column does not exist in db)
    const result = db.prepare(`
      INSERT INTO files (user_id, name, type, size, content, parent_id, encrypted, encryption_salt, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.params.userId,
      name,
      type,
      size || 0,
      content || null,
      parent_id || null,
      encrypted ? 1 : 0,
      encryption_salt || null,
      now,
      now
    );

    res.json(Number(result.lastInsertRowid));
  } catch (error: any) {
    console.error('[POST /files/:userId Error]:', error);
    res.status(500).json({ error: error.message || 'Failed to create file' });
  }
});

// 3. POST /api/files/:userId/:id/update - Rename/Move file or folder
router.post('/files/:userId/:id/update', authMiddleware, (req: AuthenticatedRequest, res) => {
  if (req.userId !== req.params.userId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const { name, parent_id } = req.body;
  const fileId = parseInt(req.params.id as string);

  if (isNaN(fileId)) {
    res.status(400).json({ error: 'Invalid file ID' });
    return;
  }

  const db = getDatabase();
  const now = new Date().toISOString();

  try {
    const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ?').get(fileId, req.params.userId) as any;
    if (!file) {
      res.status(404).json({ error: 'File or folder not found' });
      return;
    }

    // Perform update
    if (name !== undefined) {
      db.prepare('UPDATE files SET name = ?, updated_at = ? WHERE id = ?').run(name, now, fileId);
    }

    if (parent_id !== undefined) {
      // Validate parent folder if moving
      if (parent_id !== null) {
        const parent = db.prepare('SELECT id, type FROM files WHERE id = ? AND user_id = ?').get(parent_id, req.params.userId) as any;
        if (!parent || parent.type !== 'directory') {
          res.status(400).json({ error: 'Invalid parent folder ID' });
          return;
        }
        if (parent.id === fileId) {
          res.status(400).json({ error: 'Cannot move folder inside itself' });
          return;
        }
      }
      db.prepare('UPDATE files SET parent_id = ?, updated_at = ? WHERE id = ?').run(parent_id, now, fileId);
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update file' });
  }
});

// 4. DELETE /api/files/:userId/:id/recursive - Delete file/folder recursively
router.delete('/files/:userId/:id/recursive', authMiddleware, (req: AuthenticatedRequest, res) => {
  if (req.userId !== req.params.userId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const fileId = parseInt(req.params.id as string);
  if (isNaN(fileId)) {
    res.status(400).json({ error: 'Invalid ID' });
    return;
  }

  const db = getDatabase();

  try {
    const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ?').get(fileId, req.params.userId);
    if (!file) {
      res.status(404).json({ error: 'File or folder not found' });
      return;
    }

    // Delete node (cascades on database level to children, versions, etc.)
    db.prepare('DELETE FROM files WHERE id = ?').run(fileId);

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete' });
  }
});

// 5. GET /api/versions/:userId/:fileId - Get file version history
router.get('/versions/:userId/:fileId', authMiddleware, (req: AuthenticatedRequest, res) => {
  if (req.userId !== req.params.userId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const fileId = parseInt(req.params.fileId as string);
  if (isNaN(fileId)) {
    res.status(400).json({ error: 'Invalid file ID' });
    return;
  }

  const db = getDatabase();

  try {
    const file = db.prepare('SELECT id FROM files WHERE id = ? AND user_id = ?').get(fileId, req.params.userId);
    if (!file) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const versions = db.prepare(`
      SELECT id, version_num as version_number, size, created_at
      FROM file_versions
      WHERE file_id = ?
      ORDER BY version_num DESC
    `).all(fileId);

    res.json(versions);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch versions' });
  }
});

// 6. POST /api/versions/:userId/:fileId/restore/:versionId - Restore version
router.post('/versions/:userId/:fileId/restore/:versionId', authMiddleware, (req: AuthenticatedRequest, res) => {
  if (req.userId !== req.params.userId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const fileId = parseInt(req.params.fileId as string);
  const versionId = parseInt(req.params.versionId as string);

  if (isNaN(fileId) || isNaN(versionId)) {
    res.status(400).json({ error: 'Invalid parameters' });
    return;
  }

  const db = getDatabase();
  const now = new Date().toISOString();

  try {
    // Verify file and version ownership
    const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ?').get(fileId, req.params.userId) as any;
    const version = db.prepare('SELECT * FROM file_versions WHERE id = ? AND file_id = ?').get(versionId, fileId) as any;

    if (!file || !version) {
      res.status(404).json({ error: 'File or version not found' });
      return;
    }

    // Save current file state as a new version
    const maxVerRow = db.prepare('SELECT COALESCE(MAX(version_num), 0) as max_v FROM file_versions WHERE file_id = ?').get(fileId) as any;
    const nextVersionNum = (maxVerRow?.max_v || 0) + 1;

    db.prepare(`
      INSERT INTO file_versions (file_id, user_id, version_num, name, size, content, encrypted, encryption_salt, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      fileId, 
      req.params.userId, 
      nextVersionNum, 
      file.name, 
      file.size, 
      file.content || '', 
      file.encrypted, 
      file.encryption_salt, 
      file.updated_at || file.created_at
    );

    // Update file table to restored version content
    db.prepare(`
      UPDATE files
      SET size = ?, content = ?, encrypted = ?, encryption_salt = ?, updated_at = ?
      WHERE id = ?
    `).run(
      version.size, 
      version.content, 
      version.encrypted, 
      version.encryption_salt, 
      now, 
      fileId
    );

    // Delete the restored version row so it doesn't remain in history duplicate
    db.prepare('DELETE FROM file_versions WHERE id = ?').run(versionId);

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to restore version' });
  }
});

// 7. DELETE /api/versions/:userId/:fileId/:versionId - Delete version
router.delete('/versions/:userId/:fileId/:versionId', authMiddleware, (req: AuthenticatedRequest, res) => {
  if (req.userId !== req.params.userId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const fileId = parseInt(req.params.fileId as string);
  const versionId = parseInt(req.params.versionId as string);

  if (isNaN(fileId) || isNaN(versionId)) {
    res.status(400).json({ error: 'Invalid parameters' });
    return;
  }

  const db = getDatabase();

  try {
    const version = db.prepare(`
      SELECT fv.id
      FROM file_versions fv
      JOIN files f ON fv.file_id = f.id
      WHERE fv.id = ? AND f.id = ? AND f.user_id = ?
    `).get(versionId, fileId, req.params.userId);

    if (!version) {
      res.status(404).json({ error: 'Version not found' });
      return;
    }

    db.prepare('DELETE FROM file_versions WHERE id = ?').run(versionId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete version' });
  }
});

export default router;
