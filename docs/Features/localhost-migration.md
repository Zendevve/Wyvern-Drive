# Feature: Localhost Backend Migration (Express + SQLite)

> **Status:** Completed
> **Owner:** Antigravity & Nathan
> **Created:** 2026-06-03
> **Last Updated:** 2026-06-03

---

## Purpose

This feature migrates Wyvern Drive from a cloud-dependent backend (Supabase database, Auth, and Edge Functions) to a self-contained localhost deployment running Express, TypeScript, and a local SQLite database (`better-sqlite3`).

By executing all file metadata storage, authentication, versioning, streaming, and sharing logic locally, the application runs entirely on the user's system without external cloud service costs or latency, keeping only the Discord CDN for chunk hosting (via user-supplied webhooks).

---

## Business Rules and Constraints

- **Rule 1:** The application must run without requiring a Supabase account or connection.
- **Rule 2:** All user metadata, file trees, file versions, and share links must be stored in a local SQLite file (`data/wyvern.db`).
- **Rule 3:** Password-based encryption keys must remain client-side (end-to-end encrypted).
- **Rule 4:** Webhook credentials must be stored locally per-user and returned on request to authorized clients.
- **Constraint 1:** File chunks remain hosted on Discord; the local backend acts as metadata manager and media streaming/retrieval agent.
- **Constraint 2:** Local port 3000 is used by default for the backend API, with CORS enabled for the frontend Vite dev server (port 5173).

---

## Technical Architecture

### Database Schema (SQLite)

We will use SQLite to represent all necessary metadata. The database file will be initialized on startup in `data/wyvern.db` with the following tables:

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  webhook_urls TEXT NOT NULL, -- JSON array of webhooks
  encryption_enabled INTEGER DEFAULT 1,
  server_boost_level TEXT DEFAULT 'none',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
  is_directory INTEGER NOT NULL, -- 1 for dir, 0 for file
  size INTEGER NOT NULL,
  type TEXT,
  salt TEXT,
  iv TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS file_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  size INTEGER NOT NULL,
  iv TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS file_chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
  version_id INTEGER REFERENCES file_versions(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_size INTEGER NOT NULL,
  discord_url TEXT NOT NULL,
  message_id TEXT,
  channel_id TEXT
);

CREATE TABLE IF NOT EXISTS shares (
  id TEXT PRIMARY KEY, -- GUID/UUID or short-id
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
  version_id INTEGER REFERENCES file_versions(id) ON DELETE CASCADE,
  expires_at TEXT,
  password_hash TEXT,
  download_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### API Endpoints (Express)

The Express backend will expose the following routes:

#### Auth
- `POST /api/auth/signup` - Registers a user, hashes password, inserts into `users` and `user_profiles`.
- `POST /api/auth/login` - Authenticates a user, issues a JWT token.
- `GET /api/auth/me` - Validates JWT, returns logged-in user profile details.

#### Files & Navigation
- `GET /api/files/:userId` - Retrieves the full file/folder metadata tree for the user.
- `POST /api/files/:userId` - Creates a new file or directory, inserts chunks, handles file versioning on name collision.
- `POST /api/files/:userId/:id/update` - Renames a file/directory or changes its parent directory (`parent_id`).
- `DELETE /api/files/:userId/:id` - Deletes a file/directory. If directory, checks if empty first.
- `DELETE /api/files/:userId/:id/recursive` - Deletes a directory and all its contents recursively.

#### Versions
- `GET /api/versions/:userId/:fileId` - Retrieves all versions for a file.
- `POST /api/versions/:userId/:fileId` - Creates a new version of an existing file.
- `POST /api/versions/:userId/:fileId/restore/:versionId` - Restores a past file version as current.
- `DELETE /api/versions/:userId/:fileId/:versionId` - Deletes a specific file version.

#### Sharing & Streaming
- `POST /api/shares/:userId/:fileId` - Creates a share link for a file.
- `GET /api/share/:shareId/info` - Public route to fetch metadata of a shared file.
- `GET /api/share/:shareId/chunks` - Paginated chunk list retrieval for extensions/streaming downloads.
- `GET /api/share/:shareId` - Fetches and streams small/medium files directly.
- `POST /api/refresh-urls` - Refreshes Discord attachment URLs via CDN API using message IDs.
- `GET /api/stream/:userId/:fileId` - Streams media chunks sequentially back to the player.

---

## Technical Implementation Plan

1. **Create the `wyvern-backend` package**:
   - Write standard package configuration and dependencies: `express`, `better-sqlite3`, `jsonwebtoken`, `bcryptjs`, `cors`, `dotenv`.
   - Setup typescript configuration.
   - Implement database setup and schemas in `src/db/sqlite.ts`.
   - Implement authentication middlewares and endpoint controllers.
   - Implement file system operation controllers matching the Supabase Edge Function logic.
   
2. **Mock Supabase Client in `wyvern-web`**:
   - Edit `wyvern-web/src/lib/supabase.ts` to replace the real Supabase client.
   - Re-route auth operations (`signInWithPassword`, `signUp`, `signOut`, `getSession`, `onAuthStateChange`) to API endpoints on localhost.
   - Re-route profile upserts/selects (`from('user_profiles')`) to profile endpoints.
   - Replace the `AuthScreen` `@supabase/auth-ui-react` widget with a custom React form styled according to the design system.

3. **Verify and Test**:
   - Write automated unit and integration tests for key endpoints.
   - Run backend server and client side.
   - Validate full file upload, file versioning, streaming, sharing, and restoration.
