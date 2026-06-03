# Wyvern Drive — Master Roadmap v3

> **Mission:** The definitive Discord-based infinite encrypted storage.
> **Philosophy:** Granular, concise, high-impact features.

---

## Phase 3: Navigation & UX Foundation ✅
*Make the file system feel native and snappy.*

### 3.1 Navigation Core
- [x] **Breadcrumb Trail**: Interactive path segments for quick parent folder navigation.
- [ ] **History Navigation**: "Back" and "Forward" buttons that work with browser history.
- [x] **Keyboard Navigation**: Arrow keys to navigate grid, Enter to open.

### 3.2 Selection System
- [x] **Multi-Select**: Shift+Click (range) and Ctrl+Click (additive).
- [ ] **Drag Selection**: Box selection on the file grid background.
- [x] **Selection State**: Status bar showing "X items selected (Y MB)".

### 3.3 Context Actions
- [x] **Right-Click Menu**: Custom context menu for files/folders (Open, Rename, Delete, etc.).
- [x] **Keyboard Shortcuts**: `Del` to delete, `F2` to rename, `Ctrl+A` to select all.

---

## Phase 4: Search & Info
*Find what you need instantly.*

### 4.1 Metadata Panel
- [ ] **Info Sidebar**: Show details for selected file (Type, Size, Created, Hash).
- [ ] **Preview Card**: Small thumbnail/icon preview in the sidebar.

### 4.2 Search Engine
- [ ] **Fuzzy Search**: Implement Fuse.js for typo-tolerant searching.
- [ ] **Scope Control**: Toggle between "Current Folder" and "Global" search.
- [ ] **Result Highlighting**: Visually emphasize matching terms in filenames.

### 4.3 Advanced Filtering
- [ ] **Sort Options**: Name, Size, Date Modified, Type (Asc/Desc).
- [ ] **Filter Chips**: Quick toggles for "Images", "Videos", "Documents".

---

## Phase 5: Media Experience ✅
*Turn storage into a streaming center.*

### 5.1 Image Viewer
- [x] **Lightbox Overlay**: Full-screen image viewer with backdrop.
- [x] **Zoom & Pan**: Interactive image manipulation (mouse wheel zoom, drag to pan).
- [x] **Gallery Mode**: Previous/Next navigation within the current folder.

### 5.2 Audio Player
- [x] **Persistent Player**: Floating bottom bar player that persists across navigation.
- [x] **Playlist Queue**: Auto-queue audio files from the current folder.
- [ ] **Visualizer**: (Optional) Simple audio spectrum visualization.

### 5.3 Video Playback
- [x] **Stream Engine**: Fetch and play video chunks sequentially with loading progress.
- [x] **Custom Controls**: Sleek play/pause, volume, fullscreen controls.

---

## Phase 6: Performance & Polish ✅
*Scale to thousands of files.*

### 6.1 Virtualization
- [x] **Virtual Grid**: Only render visible items using @tanstack/react-virtual (500+ file threshold).
- [x] **Lazy Loading**: Thumbnails load on-demand, deferred until scrolled into view.

### 6.2 Upload Optimization
- [x] **Dynamic Chunk Sizing**: 24MB chunks for Level 3 boosted servers (vs 7.5MB default).
- [x] **Compact Metadata**: Short key names in chunk JSON (~27% size reduction).
- [x] **Parallel Uploads**: Dynamic concurrency based on file size and webhook count.

### 6.3 Caching Strategy
- [x] **Offline-First Cache**: IndexedDB cache layer with background sync.
- [ ] **Thumbnail Cache**: Store generated thumbnails locally to save bandwidth.

---

## Phase 7: Security & Sharing ✅
*Safe sharing.*

### 7.1 Key Management
- [ ] **Session Lock**: Auto-lock vault after inactivity.
- [ ] **Key Export**: Export/Import encryption keys for backup.

### 7.2 Secure Sharing
- [x] **Share Links**: Generate public download links with optional expiry and password.
- [x] **Share Modal**: UI for creating and managing share links.
- [ ] **Encrypted Share**: Share file with another public key (future).

---

## Future: Ecosystem
- **Phase 8**: Desktop App (Electron wrappers).
- **Phase 9**: Mobile App (React Native).
- **Phase 10**: CLI Tool (Headless uploads).

---

## Recent Updates (Dec 2024)
- ✨ **Image Lightbox**: Drag-to-pan, mouse wheel zoom (up to 500%), double-click reset
- 🎵 **Persistent Audio Player**: Bottom bar with playback controls, seeking, volume
- 📹 **Video Streaming UX**: Chunk loading progress indicator
- ⚡ **Dynamic Chunk Sizing**: 24MB for boosted servers, 7.5MB default
- 📦 **Virtual File Grid**: Efficient rendering for 500+ files
- 🗜️ **Compact Chunk Metadata**: Short keys reduce JSON size by ~27%


### Phase 07.1: Localhost database and API backend migration (INSERTED)

**Goal:** [Urgent work - to be planned]
**Requirements**: TBD
**Depends on:** Phase 7
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 07.1 to break down)
