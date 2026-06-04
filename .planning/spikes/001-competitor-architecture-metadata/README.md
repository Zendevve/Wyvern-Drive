---
spike: 001
name: competitor-architecture-metadata
type: standard
validates: "Given Disbox and Discloud, when analyzed for metadata persistence, then how do they manage folder systems and file listings?"
verdict: VALIDATED
related: []
tags: [architecture, metadata]
---

# Spike 001: Competitor Architecture and Metadata

This spike evaluates the architecture and metadata persistence strategies used by **Disbox** and **Discloud**, comparing them with the client-side design of **Wyvern Drive**.

## What This Validates
- **Given** Disbox and Discloud codebases,
- **When** analyzed for metadata persistence,
- **Then** how do they manage folder systems, file structures, and chunk listings?

## Research

### Comparison of Metadata Architectures

| Architecture Aspect | Disbox | Discloud | Wyvern Drive |
|---------------------|--------|----------|--------------|
| **Backend Requirement** | Node.js + SQLite | Node.js + Redis | None (Static PWA) |
| **Metadata Storage** | SQLite (`disbox.db` on Fly.dev) | Redis Cache | IndexedDB (Client browser) |
| **Folder Hierarchy** | Maintained via `parent_id` in SQLite table | None (Flat listing) | Maintained via `parentId` in IndexedDB |
| **User Identity** | SHA256 of Webhook URL | None (Public link generation) | User Password/Webhook configuration |
| **Privacy & Security** | Webhook URL is sent to SQLite server (unencrypted) | Bot Token is stored on backend server | Complete client-side encryption; keys never leave browser |
| **Sharing Model** | Shared database entry | Proxy endpoint `/file/:id` | Crytographic sharing keys via URL hash |

### Key Findings from Codebases

#### 1. Disbox Metadata (SQLite)
Disbox's server maintains a simple schema:
```sql
CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY,
    user_id TEXT, -- SHA256 of the Webhook URL
    parent_id INTEGER,
    name TEXT,
    type TEXT, -- 'directory' or 'file'
    size INTEGER,
    content TEXT, -- JSON string array of Discord message IDs
    created_at TEXT,
    updated_at TEXT
);
```
- In Disbox, file chunk locations are stored in the `content` field as a serialized JSON array of message IDs (e.g. `["1249...", "1250..."]`).
- Directory hierarchy is reconstructed dynamically on the server by building a tree representation of all records belonging to the same `user_id`.

#### 2. Discloud Metadata (Redis)
Discloud is designed primarily as a temporary or quick file hosting tool:
- Metadata is stored as a serialized JSON string in Redis keyed by a random `fileId`:
  ```json
  {
    "chunkSize": 8388608,
    "fileName": "document.pdf",
    "fileSize": 10485760,
    "parts": [
      "https://cdn.discordapp.com/attachments/..."
    ]
  }
  ```
- It does not support folder systems or user accounts.

#### 3. Wyvern Drive Metadata (IndexedDB)
Wyvern Drive avoids all server-side database requirements by utilizing browser IndexedDB:
- Files, folders, and chunk structures are stored in 5 local stores (`files`, `chunks`, `folders`, `config`, `shares`).
- Since it is browser-only, files cannot be synced across multiple devices out-of-the-box.

## How to Run
This is a static analysis spike. No local execution of competitor servers was required since the codebases are simple enough to analyze directly from source.

## What to Expect
A comprehensive comparison of metadata storage architectures, showing the pros and cons of local-first vs. server-backed models.

## Results
- **Verdict**: **VALIDATED**
- We have validated that storing metadata client-side (as in Wyvern Drive) is superior for privacy and cost, but has a limitation regarding multi-device access.
- **Signal for Wyvern Drive**:
  - We should maintain the browser-only IndexedDB architecture for privacy and zero server cost.
  - To solve multi-device access without a backend database, we can implement an **export/import backup feature** that encrypts the local database state and uploads it to Discord under a special "metadata" channel or message ID.
