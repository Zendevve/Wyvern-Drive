# How to Backup, Export, and Restore Vault Metadata

This guide explains how to back up your vault index, export portable JSON manifests, and migrate your Wyvern Drive data across machines.

---

## Overview

Because all physical file chunks are permanently stored in your Discord channel attachments, your entire vault can be restored on any machine as long as you have:
1. Your **Metadata Manifest** (or SQLite database backup).
2. Your **Master Encryption Key**.

---

## 1. How to Export a Vault Manifest (JSON)

Wyvern Drive provides a built-in JSON exporter that captures all virtual folders, file records, SHA-256 hashes, and chunk manifests:

1. Open **Settings** (gear icon in sidebar).
2. Scroll to the **Database & Manifest Backup** section.
3. Click **Export Vault JSON**.
4. Save the generated `.json` backup file (e.g., `wyvern_drive_backup_2025-03-10.json`) to a secure location (such as a USB drive or secondary backup).

```json
{
  "version": "1.0.0",
  "exported_at": "2025-03-10T14:30:00Z",
  "folders": [ ... ],
  "files": [
    {
      "id": "file-12345",
      "name": "project_archive.zip",
      "size": 52428800,
      "sha256": "9f86d081...",
      "is_encrypted": true,
      "chunk_count": 3,
      "chunks": [
        {
          "chunk_index": 0,
          "attachment_url": "https://cdn.discordapp.com/attachments/...",
          "size": 18874368,
          "nonce": "a1b2c3d4..."
        }
      ]
    }
  ]
}
```

---

## 2. How to Back Up the Local SQLite Database Directly

If you prefer backing up raw application files:

1. Close the Wyvern Drive desktop application.
2. Navigate to your operating system's application data folder:
   - **Windows**: `%APPDATA%\WyvernDrive\` (e.g., `C:\Users\<Username>\AppData\Roaming\WyvernDrive\`)
   - **Linux / macOS**: `~/.config/WyvernDrive/`
3. Copy the database file `wyvern.db` (and `wyvern.db-wal` / `wyvern.db-shm` if present).

---

## 3. How to Restore on a New Computer

To restore your vault on a fresh machine:

1. Install and launch Wyvern Drive on the new machine.
2. Complete the initial Onboarding Wizard using:
   - The same **Discord Webhook URL**.
   - The exact same **Master Encryption Key**.
3. Place your backed-up `wyvern.db` file into `%APPDATA%\WyvernDrive\` (overwriting the empty database).
4. Restart Wyvern Drive. All folders, files, and chunk manifests will instantly populate, and all files can be streamed or downloaded immediately.
