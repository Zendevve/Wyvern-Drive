# Features Research: Wyvern Drive

Browser-based, self-hosted file storage using Discord webhooks as backend. Client-side AES-256-GCM encryption, unlimited storage via Discord CDN.

---

## Table Stakes (Must Have)

These features are non-negotiable. Without them, users won't adopt the product regardless of how unique the encryption story is.

### File Upload
- **Feature:** Drag & drop file upload with progress indicator
- **Complexity:** Medium
- **Dependencies:** Chunking system, Discord webhook integration
- **Notes:** Users expect drag & drop as default. Must support multi-file selection, cancel in progress, and visual progress (per-file and overall). 25MB chunking with parallel uploads handles Discord's limits transparently.

### File Download
- **Feature:** Single file and batch download
- **Complexity:** Medium
- **Dependencies:** Chunk reassembly, decryption pipeline
- **Notes:** Must handle chunk reassembly + decryption seamlessly. Batch download as ZIP is a common expectation.

### Folder System
- **Feature:** Create, rename, delete, navigate folders
- **Complexity:** Medium
- **Dependencies:** Metadata storage (Discord messages or local DB)
- **Notes:** Folder tree with breadcrumb navigation. Drag & drop to move files between folders. Empty folder deletion. Nested folders.

### File Operations
- **Feature:** Rename, move, copy, delete files
- **Complexity:** Low-Medium
- **Dependencies:** Folder system, metadata storage
- **Notes:** Context menu or action bar. Confirmation on delete. Move via drag & drop. Copy creates new webhook messages.

### Search
- **Feature:** Full-text and filename search
- **Complexity:** Medium
- **Dependencies:** Metadata/index layer
- **Notes:** Minimum: search by filename, filter by type (image/video/audio/document). Ideally supports file content search for text files. Indexed locally (IndexedDB).

### File Type Recognition
- **Feature:** Display appropriate icons/thumbnails by file type
- **Complexity:** Low
- **Dependencies:** None
- **Notes:** Different icons for PDF, images, videos, code, archives, etc. Basic visual differentiation.

### File Listing with Sort/Filter
- **Feature:** Sort by name, date, size, type. Filter by type.
- **Complexity:** Low-Medium
- **Dependencies:** Metadata layer
- **Notes:** Grid view and list view toggle. Sort ascending/descending. Essential for navigating large file sets.

### Basic Accessibility (WCAG AA)
- **Feature:** Keyboard navigation, screen reader support, focus management
- **Complexity:** Medium
- **Dependencies:** All UI components
- **Notes:** All interactive elements reachable via keyboard. ARIA labels. Focus visible. Skip navigation. Color contrast 4.5:1 minimum. Refer to accessibility-compliance skill for implementation guidance.

### Dark Theme
- **Feature:** Dark mode UI with system preference detection
- **Complexity:** Low
- **Dependencies:** CSS custom properties
- **Notes:** Respect `prefers-color-scheme`. Toggle switch. Most users prefer dark for file management UIs. Consistent dark palette.

### Responsive Layout
- **Feature:** Works on mobile, tablet, and desktop
- **Complexity:** Medium
- **Dependencies:** All UI components
- **Notes:** Minimum viable: functional on 320px+ width. Mobile gets bottom action bar. Desktop gets sidebar. Touch-friendly tap targets (44px minimum).

### PWA Support
- **Feature:** Installable as Progressive Web App with offline shell
- **Complexity:** Medium
- **Dependencies:** Service worker, manifest.json
- **Notes:** Offline caching of app shell. "Add to Home Screen" prompt. Metadata available offline even if files aren't.

### Error Handling & Feedback
- **Feature:** Toast notifications, error messages, retry logic
- **Complexity:** Low-Medium
- **Dependencies:** Upload/download system
- **Notes:** Discord webhook rate limits, network failures, file too large — all need clear user-facing messages with retry options.

---

## Differentiators

These features separate Wyvern Drive from Google Drive, Dropbox, and Nextcloud. They are the competitive moat.

### Client-Side AES-256-GCM Encryption
- **Feature:** All files encrypted in browser before upload, decrypted client-side only
- **Complexity:** High
- **Dependencies:** Web Crypto API, key management
- **Notes:** The core value proposition. Server (Discord) never sees plaintext. Keys derived from user passphrase. Web Crypto API for native performance. Zero-knowledge architecture.

### Discord CDN Backend
- **Feature:** Leverage Discord's CDN for unlimited, free file hosting
- **Complexity:** High
- **Dependencies:** Discord webhook API, message management
- **Notes:** Bypass traditional storage limits. Discord webhooks accept up to 25MB per message. CDN provides global edge caching. Trade-off: storage tied to Discord ToS compliance. Requires managing message IDs for file retrieval.

### 25MB Chunking with Parallel Uploads
- **Feature:** Large files split into 25MB encrypted chunks, uploaded concurrently
- **Complexity:** High
- **Dependencies:** Encryption, Discord webhook integration
- **Notes:** 25MB is Discord's webhook limit. Parallel uploads (4-8 concurrent) reduce total upload time. Each chunk is a separate Discord message. Reassembly on download.

### Secure Sharing (Password + Time-Limited Links)
- **Feature:** Generate share links with optional password and expiration
- **Complexity:** High
- **Dependencies:** Encryption, link generation
- **Notes:** Share links contain encrypted payload in URL fragment (never sent to server). Password adds second layer. Expiration enforced client-side by checking timestamp in URL. Revocable by invalidating the link token in local metadata.

### File Versioning
- **Feature:** Automatic version history on file modification
- **Complexity:** Medium-High
- **Dependencies:** Metadata storage, encryption
- **Notes:** Each edit creates a new version (new Discord message). Old versions retained. Version diff preview for text files. Storage impact: versions consume additional Discord messages.

### Photo Timeline Gallery
- **Feature:** Time-grouped photo browser with EXIF data display
- **Complexity:** Medium
- **Dependencies:** Thumbnail generation, metadata extraction
- **Notes:** Groups photos by date (day/month). Shows EXIF data (camera, date, GPS if available). Masonry grid layout. Lightbox view with swipe navigation on mobile.

### Media Streaming
- **Feature:** Inline preview and streaming for images, video, audio
- **Complexity:** Medium
- **Dependencies:** Decryption pipeline, CDN URLs
- **Notes:** Images: decrypt and display inline. Video: HTML5 video player with seek. Audio: same as video but audio-only. Must handle chunked streaming for large files — cannot download entire file before playback.

### Persistent Audio Player
- **Feature:** Global audio player that persists across navigation
- **Complexity:** Medium
- **Dependencies:** Media streaming, state management
- **Notes:** Bottom bar player. Play/pause, seek, volume, skip. Continues playing when navigating folders. Queue management. Album art from embedded metadata if available.

### Virtual Scrolling (10K+ Files)
- **Feature:** Efficient rendering of directories with thousands of files
- **Complexity:** High
- **Dependencies:** File listing, metadata index
- **Notes:** Only render visible files (viewport height × buffer). Intersection Observer or windowed rendering library. Critical for large directories. Must maintain sort order and selection state across scroll.

### Drag & Drop (Move Files)
- **Feature:** Drag files between folders in the file browser
- **Complexity:** Medium
- **Dependencies:** Folder system, file operations
- **Notes:** Visual drop zones highlight on hover. Multi-select drag. Works on touch with long-press. Must update metadata (Discord messages may need re-linking or new webhook calls).

---

## Anti-Features (Do NOT Build)

Deliberately excluded to maintain focus, reduce complexity, and avoid anti-patterns.

- **Real-time collaborative editing:** Out of scope — this is storage, not a document editor. Would require operational transform or CRDT layer. Complexity: High. Use case: users can open files in external editors.
- **Built-in text/code editor:** Same rationale — use external editors. A basic preview (syntax highlighting for code, markdown rendering) is fine. Full editing is not.
- **Desktop sync client:** Wyvern Drive is browser-only. Sync clients add platform-specific complexity (filesystem watchers, conflict resolution, daemon management). The PWA provides sufficient "native" feel.
- **Mobile native apps:** PWA covers mobile use cases. Native apps require App Store/Play Store distribution, platform-specific code, and ongoing maintenance. Anti-pattern for a self-hosted project.
- **Multi-user/collaboration features:** Wyvern Drive is single-user or small-team. Adding permissions, shared workspaces, role-based access introduces enterprise complexity that conflicts with the privacy-first, Discord-backed architecture.
- **File previews for office documents (DOCX, XLSX):** Would require LibreOffice Online, OnlyOffice, or similar heavy dependency. Use external editors. PDF preview is acceptable (native browser support).
- **Built-in photo editing:** Crop, rotate, filter — all out of scope. External photo editors exist. Focus on viewing and organizing.
- **Version diff/merge for binary files:** Text diffs are reasonable. Binary diff is complex and low-value for most users.
- **Recycle bin / soft delete:** Adds complexity to the Discord message lifecycle. Hard delete is simpler and more honest about the permanent nature of CDN storage. Users can version files instead.
- **Offline file editing:** The PWA caches the app shell, not files. Editing offline requires conflict resolution on reconnect. Out of scope for v1.
- **WebDAV/SFTP protocol support:** Would require a server-side component, defeating the "browser-only, zero-server" architecture.
- **AI/ML features (auto-tagging, facial recognition):** Heavy dependencies, privacy concerns, and processing requirements. Antithetical to the self-hosted, privacy-first model.

---

## Feature Dependencies Map

```
Encryption ──────────────────┬── Secure Sharing
  │                          │
  ├── Chunking System ───────┼── File Versioning
  │     │                    │
  │     ├── Upload System    │
  │     │     │              │
  │     └── Download System  │
  │           │              │
  │           └── Media Streaming ── Persistent Audio Player
  │                              │
  │                              └── Photo Timeline Gallery
  │
Metadata Layer ─────────────┬── Search
  │                         │
  ├── Folder System ────────┼── File Operations
  │     │                   │
  │     └── Virtual Scrolling
  │
UI Foundation ──────────────┬── Dark Theme
  │                         │
  ├── Responsive Layout     │
  │                         │
  ├── Accessibility ────────┘
  │
PWA ──────────────────────── Service Worker
```

**Critical path:** Encryption → Chunking → Upload/Download → Media Streaming. Everything else builds on this.

**Blockers:**
- Virtual Scrolling blocks anything requiring 10K+ file rendering
- Metadata Layer blocks Search, Folder System, File Versioning
- Encryption blocks Secure Sharing, File Versioning (encrypted versions)
- Chunking blocks Upload/Download, which blocks everything file-related

---

## Summary

**Table stakes (14 features):** Upload, download, folders, file ops, search, sorting, icons, accessibility, dark theme, responsive, PWA, error handling. These must all ship in v1 or the product feels incomplete.

**Differentiators (11 features):** Client-side encryption, Discord CDN backend, chunking, secure sharing, versioning, photo gallery, media streaming, persistent audio, virtual scrolling, drag & drop. These define what Wyvern Drive *is* vs. being "just another file manager."

**Anti-features (12 exclusions):** No real-time collab, no desktop sync, no native apps, no office preview, no photo editing, no WebDAV, no AI. Every excluded feature saves months of development and keeps the architecture honest.

**Key architectural insight:** The Discord webhook → CDN pipeline is the foundation. Everything (encryption, chunking, versioning, sharing) flows through it. The metadata layer (likely IndexedDB + Discord message IDs) is the second pillar — it enables search, folders, and virtual scrolling. Getting these two layers right determines whether the product scales to 10K+ files or collapses under its own weight.

**Recommended build order:**
1. Encryption + chunking + upload/download (core pipeline)
2. Folder system + metadata layer (organizational foundation)
3. File operations + search + sort/filter (daily-use features)
4. Virtual scrolling (scaling to large datasets)
5. Media streaming + persistent audio (consumption experience)
6. Photo gallery + versioning (advanced organization)
7. Secure sharing (social/collaborative feature)
8. Dark theme + responsive + accessibility + PWA (polish layer)
