# Roadmap: Wyvern Drive

**Project Goal:** Free, unlimited cloud storage using Discord as a backend.
**Current Focus:** Phase 1: Core Storage Engine

---

## Phases

### Phase 1: Core Storage Engine
**Goal:** Basic stateless backend API containing chunking, Discord webhook upload, dynamic CDN URL refresh, rate limiting, and chunk reassembly.
**Mode:** mvp
**Success Criteria:**
1. Uploading a 50MB file results in two chunks posted to the Discord webhook and returns chunk references (URLs and message IDs).
2. Downloading requests fetch chunks in order, refresh the expired CDN URLs if necessary, concatenate them, and download the intact original file.
3. Retrying uploads/downloads respects 429 rate limit backoff.

**Mapped Requirements:**
- `AUTH-01`, `AUTH-02`, `AUTH-03`, `AUTH-04`
- `STORE-01`, `STORE-02`, `STORE-03`, `STORE-04`, `STORE-05`

---

### Phase 2: Virtual Filesystem Metadata Layer
**Goal:** File tree database using SQLite, directory hierarchy CRUD, account isolation, and backup metadata export/import.
**Mode:** mvp
**Success Criteria:**
1. Folder creation, deletion, and directory listings work correctly and are isolated to the specific account (derived by hashed webhook).
2. Database files and directories are cascade-deleted recursively (including associated Discord messages).
3. The virtual filesystem state can be exported to JSON and restored from JSON.

**Mapped Requirements:**
- `FS-01`, `FS-02`, `FS-03`, `FS-04`, `FS-05`

---

### Phase 3: React Single Page Application UI
**Goal:** Interactive, premium file manager interface with drag-and-drop, progress overlay, and folder navigation.
**Mode:** mvp
**Success Criteria:**
1. User enters their webhook URL in a setup wizard, gets a JWT, and logs in.
2. Interactive file grid/list supports navigation via breadcrumbs.
3. Uploads display a visual progress queue with active percentages.
4. Drag-and-drop initiates serial chunked uploads.

**Mapped Requirements:**
- `UI-01`, `UI-02`, `UI-03`, `UI-04`, `UI-05`, `UI-06`

---
*Roadmap defined: 2026-06-04*
*Last updated: 2026-06-04 after initial definition*
