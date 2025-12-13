# Wyvern Drive — Master Roadmap v3

> **Mission:** The definitive Discord-based infinite encrypted storage.
> **Philosophy:** Granular, concise, high-impact features.

---

## Phase 3: Navigation & UX Foundation
*Make the file system feel native and snappy.*

### 3.1 Navigation Core
- [ ] **Breadcrumb Trail**: Interactive path segments for quick parent folder navigation.
- [ ] **History Navigation**: "Back" and "Forward" buttons that work with browser history.
- [ ] **Keyboard Navigation**: Arrow keys to navigate grid, Enter to open.

### 3.2 Selection System
- [ ] **Multi-Select**: Shift+Click (range) and Ctrl+Click (additive).
- [ ] **Drag Selection**: Box selection on the file grid background.
- [ ] **Selection State**: status bar showing "X items selected (Y MB)".

### 3.3 Context Actions
- [ ] **Right-Click Menu**: Custom context menu for files/folders (Open, Rename, Delete, etc.).
- [ ] **Keyboard Shortcuts**: `Del` to delete, `F2` to rename, `Ctrl+A` to select all.

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

## Phase 5: Media Experience
*Turn storage into a streaming center.*

### 5.1 Image Viewer
- [ ] **Lightbox Overlay**: Full-screen image viewer with backdrop.
- [ ] **Zoom & Pan**: Interactive image manipulation.
- [ ] **Gallery Mode**: Previous/Next navigation within the current folder.

### 5.2 Audio Player
- [ ] **Persistent Player**: Floating bottom bar player that persists across navigation.
- [ ] **Playlist Queue**: Auto-queue audio files from the current folder.
- [ ] **Visualizer**: (Optional) Simple audio spectrum visualization.

### 5.3 Video Playback
- [ ] **Stream Engine**: Fetch and play video chunks sequentially.
- [ ] **Custom Controls**: Sleek play/pause, volume, fullscreen controls.

---

## Phase 6: Performance & Polish
*Scale to thousands of files.*

### 6.1 Virtualization
- [ ] **Virtual Grid**: Only render visible items to handle folders with 10k+ files.
- [ ] **Lazy Loading**: Defer loading of thumbnails/metadata until scrolled into view.

### 6.2 Caching Strategy
- [ ] **Metadata Cache**: Persist file lists in `localStorage` or `IndexedDB`.
- [ ] **Thumbnail Cache**: Store generated thumbnails locally to save bandwidth.

---

## Phase 7: Security & Sharing
*Safe sharing.*

### 7.1 Key Management
- [ ] **Session Lock**: Auto-lock vault after inactivity.
- [ ] **Key Export**: Export/Import encryption keys for backup.

### 7.2 Secure Sharing
- [ ] **Ephemeral Links**: Generate time-limited public download links (via proxy).
- [ ] **Encrypted Share**: Share file with another public key (future).

---

## Future: Ecosystem
- **Phase 8**: Desktop App (Electron wrappers).
- **Phase 9**: Mobile App (React Native).
- **Phase 10**: CLI Tool (Headless uploads).
