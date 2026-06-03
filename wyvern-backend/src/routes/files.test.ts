import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import filesRouter from './files';
import { getDatabase, closeDatabase, getDatabasePath } from '../db/database';
import fs from 'fs';

describe('Files & Versions Routes', () => {
  let app: express.Express;
  let server: Server;
  let baseUrl: string;
  const userId = 'user-files-test';
  let token: string;

  beforeAll(() => {
    process.env.DATABASE_URL = 'data/test_files.db';
    const testDbPath = getDatabasePath();
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (e) {}
    }

    const db = getDatabase();
    // Insert mock user
    db.prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)").run(
      userId,
      'files_test@example.com',
      'hashedpwd',
      new Date().toISOString()
    );

    // Create auth token
    const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-wyvern-key-change-in-prod';
    token = jwt.sign({ userId }, JWT_SECRET);

    app = express();
    app.use(express.json());
    app.use('/api', filesRouter);

    return new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as any;
        baseUrl = `http://localhost:${address.port}/api`;
        resolve();
      });
    });
  });

  afterAll(() => {
    closeDatabase();
    const testDbPath = getDatabasePath();
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (e) {}
    }
    return new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('should get an empty file tree initially', async () => {
    const res = await fetch(`${baseUrl}/files/${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.name).toBe('Root');
    expect(data.children).toEqual({});
  });

  let folderId: number;

  it('should create a new folder', async () => {
    const res = await fetch(`${baseUrl}/files/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: 'Documents',
        type: 'directory',
        parent_id: null
      })
    });
    expect(res.status).toBe(200);
    folderId = await res.json() as number;
    expect(folderId).toBeGreaterThan(0);
  });

  let fileId: number;

  it('should create a file inside the folder', async () => {
    const res = await fetch(`${baseUrl}/files/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: 'notes.txt',
        type: 'file',
        size: 100,
        parent_id: folderId,
        content: 'chunk-info-version-1',
        encrypted: false
      })
    });
    expect(res.status).toBe(200);
    fileId = await res.json() as number;
    expect(fileId).toBeGreaterThan(0);
  });

  it('should support duplicate file creation (triggers versioning)', async () => {
    const res = await fetch(`${baseUrl}/files/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: 'notes.txt',
        type: 'file',
        size: 250,
        parent_id: folderId,
        content: 'chunk-info-version-2',
        encrypted: false
      })
    });
    expect(res.status).toBe(200);
    const returnedId = await res.json() as number;
    expect(returnedId).toBe(fileId); // ID should remain same
  });

  it('should fetch version history for the file', async () => {
    const res = await fetch(`${baseUrl}/versions/${userId}/${fileId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    expect(res.status).toBe(200);
    const versions = await res.json() as any[];
    expect(versions.length).toBe(1);
    expect(versions[0].version_number).toBe(1);
    expect(versions[0].size).toBe(100);
  });

  it('should rename the file and update descendants paths', async () => {
    const res = await fetch(`${baseUrl}/files/${userId}/${fileId}/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: 'renamed_notes.txt'
      })
    });
    expect(res.status).toBe(200);

    // Verify rename in tree
    const treeRes = await fetch(`${baseUrl}/files/${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const tree = await treeRes.json() as any;
    const docsFolder = tree.children['Documents'];
    expect(docsFolder.children['renamed_notes.txt']).toBeDefined();
    expect(docsFolder.children['renamed_notes.txt'].path).toBe('Documents/renamed_notes.txt');
  });

  it('should restore a version of the file', async () => {
    // Get versions to find the version ID
    const verRes = await fetch(`${baseUrl}/versions/${userId}/${fileId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const versions = await verRes.json() as any[];
    const versionId = versions[0].id;

    // Restore
    const res = await fetch(`${baseUrl}/versions/${userId}/${fileId}/restore/${versionId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    expect(res.status).toBe(200);

    // Now the active file size should be 100, and a new version size 250 exists
    const treeRes = await fetch(`${baseUrl}/files/${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const tree = await treeRes.json() as any;
    const restoredFile = tree.children['Documents'].children['renamed_notes.txt'];
    expect(restoredFile.size).toBe(100);
    expect(restoredFile.content).toBe('chunk-info-version-1');

    const newVerRes = await fetch(`${baseUrl}/versions/${userId}/${fileId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const newVersions = await newVerRes.json() as any[];
    expect(newVersions.length).toBe(1);
    expect(newVersions[0].size).toBe(250);
  });

  it('should recursively delete folder and its contents', async () => {
    const res = await fetch(`${baseUrl}/files/${userId}/${folderId}/recursive`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    expect(res.status).toBe(200);

    // Verify tree is empty again
    const treeRes = await fetch(`${baseUrl}/files/${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const tree = await treeRes.json() as any;
    expect(tree.children).toEqual({});
  });
});
