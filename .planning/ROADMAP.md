# Roadmap: Wyvern Drive

**Project Goal:** Free, unlimited cloud storage using Discord as a backend.
**Status:** v2.0 Professional Cloud Storage UX — Planning (2026-06-05)

---

## Phases

### Phase 1: Core Storage Engine

**Status:** Complete
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

**Status:** Complete
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

**Status:** Complete
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

### Phase 4: Design System & Sidebar Navigation

**Status:** Not Started
**Goal:** Implement the core visual design system tokens (palette, outfit typography, CSS micro-animations) and the left-hand navigation sidebar with storage gauge indicators.
**Mode:** standard
**Success Criteria:**

1. Canvas styling applies a warm off-white background with white cards and smooth border-radius adjustments.
2. Interactive elements (sidebar items, action buttons) react with hardware-accelerated CSS hover transitions.
3. Left-hand sidebar is responsive, featuring a functional semi-circular storage progress gauge and size breakdowns by file category (Documents, Images, Videos, Audio, Others).

**Mapped Requirements:**

- `THEME-01`, `THEME-02`, `THEME-03`
- `SIDEBAR-01`, `SIDEBAR-02`, `SIDEBAR-03`

---

### Phase 5: Directory Browser & Detail Side-Pane

**Status:** Not Started
**Goal:** Enhance the core file manager browser with grid/list toggles, category filtering chips, premium folder card visuals, and a collapsible right info/preview sidebar.
**Mode:** standard
**Success Criteria:**

1. Users can toggle between grid and list views with the UI adapting elements smoothly.
2. Horizontal filter chips show file category counts and filter the active file listing on click.
3. Folder card grid shows visual favorite stars and visual stacked avatar piles.
4. Right detail pane toggles open/closed, displaying selected item meta details (size, timestamp, link status) and a visual preview/media-player widget.

**Mapped Requirements:**

- `BROWSE-01`, `BROWSE-02`, `BROWSE-03`, `BROWSE-04`
- `DETAIL-01`, `DETAIL-02`, `DETAIL-03`

---

### Phase 6: Desktop-Grade Context Menus & Task Queue Overlay

**Status:** Not Started
**Goal:** Build custom desktop-like context menus for files/folders and an overlay for task progression tracking.
**Mode:** standard
**Success Criteria:**

1. Right-clicking a file/folder displays a custom popup menu (Rename, Delete, Share, Download) while standard browser context menus are suppressed.
2. Interactive 3-dots menus provide identical actions on touch screens.
3. Task queue overlay in the bottom right corner displays active and queued upload/download tasks with speeds, progress bars, and ETA calculations.

**Mapped Requirements:**

- `CONTEXT-01`, `CONTEXT-02`
- `QUEUE-01`, `QUEUE-02`, `QUEUE-03`

---
*Roadmap defined: 2026-06-04*
*Last updated: 2026-06-05 — added phases 4, 5, 6 for milestone v2.0*
