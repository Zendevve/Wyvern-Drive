# Requirements: Wyvern Drive

**Defined:** 2026-06-04
**Core Value:** Users get free, unlimited personal cloud storage with standard file manager features using their own Discord webhooks.

## v1 Requirements

Requirements for initial release.

### Authentication & Setup

- [ ] **AUTH-01**: User can input their Discord webhook URL to initialize access.
- [ ] **AUTH-02**: Backend validates webhook URL with Discord API and generates a stateless JWT containing the webhook URL.
- [ ] **AUTH-03**: Backend isolates all virtual filesystem requests to an `accountId` derived from the hashed webhook.
- [ ] **AUTH-04**: Client stores the JWT in local storage, maintaining the login session across refreshes.

### Filesystem Operations

- [ ] **FS-01**: User can create virtual folders in a hierarchical path.
- [ ] **FS-02**: User can list the files and folders inside any virtual folder parent directory.
- [ ] **FS-03**: User can delete a virtual file, which removes metadata and deletes the message chunks from Discord.
- [ ] **FS-04**: User can delete a folder (cascade deleting all children recursively).
- [ ] **FS-05**: User can export and import the virtual drive database metadata as a JSON file for backup and restore.

### Storage Engine

- [ ] **STORE-01**: Files are split into chunks of up to 24MB before upload.
- [ ] **STORE-02**: Chunks are uploaded to Discord using the webhook, saving attachment URLs and message IDs in the database.
- [ ] **STORE-03**: Chunks are downloaded, reassembled, and streamed directly to the user's browser.
- [ ] **STORE-04**: Expired Discord CDN URLs are dynamically refreshed by fetching the message from the webhook API when a download fails.
- [ ] **STORE-05**: Webhook rate limits are handled using request queueing with exponential backoff and jitter.

### User Interface

- [ ] **UI-01**: Clean modern interface showing file list/grid, sidebar, and header.
- [ ] **UI-02**: Breadcrumb navigation representing the virtual path.
- [ ] **UI-03**: File upload progress overlay showing active and queued uploads.
- [ ] **UI-04**: Drag-and-drop area for uploading files to the current folder.
- [ ] **UI-05**: Modal confirmation dialogs for deletion.
- [ ] **UI-06**: File type icons indicating folders, images, audio, video, documents, and archives.

## v2 Requirements

### Sharing & Collaboration

- **SHARE-01**: User can generate shareable public links for individual files.
- **SHARE-02**: Shareable links can be configured with an optional expiry timestamp.

### Encryption

- **CRYPTO-01**: Client-side AES-256-GCM encryption of chunks before upload, using a user-specified passphrase.
- **CRYPTO-02**: Client-side decryption during chunk reassembly (passphrase is never sent to the server).

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-user shared folders | Out of scope for v1 personal storage focus. |
| Native mobile/desktop app wrappers | Focus is on high-quality React web SPA first. |
| Discord Bot token dependency | Webhook-only setup keeps configuration extremely simple. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| FS-01 | Phase 2 | Pending |
| FS-02 | Phase 2 | Pending |
| FS-03 | Phase 2 | Pending |
| FS-04 | Phase 2 | Pending |
| FS-05 | Phase 2 | Pending |
| STORE-01 | Phase 1 | Pending |
| STORE-02 | Phase 1 | Pending |
| STORE-03 | Phase 1 | Pending |
| STORE-04 | Phase 1 | Pending |
| STORE-05 | Phase 1 | Pending |
| UI-01 | Phase 3 | Pending |
| UI-02 | Phase 3 | Pending |
| UI-03 | Phase 3 | Pending |
| UI-04 | Phase 3 | Pending |
| UI-05 | Phase 3 | Pending |
| UI-06 | Phase 3 | Pending |

**Coverage:**

- v1 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-04*
*Last updated: 2026-06-04 after initial definition*
