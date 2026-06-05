# Requirements: Wyvern Drive

**Defined:** 2026-06-05
**Core Value:** Users get free, unlimited personal cloud storage with standard file manager features using their own Discord webhooks.

## v2 Requirements (Professional Cloud Storage UX)

### Theme & Aesthetics (THEME)

- [ ] **THEME-01**: UI uses a curated color palette: warm off-white canvas (`#F8F9FA`), clean white card containers (`#FFFFFF`), thin border frames (`#E5E7EB`), and HSL gradients (sky-blue, golden-orange).
- [ ] **THEME-02**: UI utilizes modern typography ("Inter" or "Outfit" font family via Google Fonts) for clean readability.
- [ ] **THEME-03**: Add CSS-transition-based micro-animations (scale on hover, slide-in drawers, fading overlays) for premium user interactions.

### Sidebar & Storage Widgets (SIDEBAR)

- [ ] **SIDEBAR-01**: Left-hand sidebar containing key drive navigation links with hover states and active-route colored highlights.
- [ ] **SIDEBAR-02**: Semi-circular arc progress gauge widget in the sidebar showing total storage consumption (e.g. "75 GB used of 100 GB").
- [ ] **SIDEBAR-03**: File category size breakdown list displaying storage weight per extension group (Documents, Images, Videos, Audio, Others).

### Directory Browser (BROWSE)

- [ ] **BROWSE-01**: Grid / list toggle buttons that dynamically switch the file layout with smooth transition states.
- [ ] **BROWSE-02**: Top row of rounded filter chips representing file categories with item counts acting as instant directory filters.
- [ ] **BROWSE-03**: Premium folder card layout featuring file/folder name, a favorite star button toggle, and nested collaborative avatar pile mockups.
- [ ] **BROWSE-04**: Interactive dotted-outline grid card for "+ Create Folder" that opens the folder creation dialog.

### Detail & Preview Pane (DETAIL)

- [ ] **DETAIL-01**: Collapsible right-sidebar info pane that shows details of the currently selected file or folder.
- [ ] **DETAIL-02**: Detail panel displays complete file metadata: name, category, human-readable size, upload timestamp, and Discord CDN link refresh status.
- [ ] **DETAIL-03**: Large visual preview element inside the detail pane showing image thumbnails, document icons, or inline media playback controls.

### Desktop-Grade Context Menus (CONTEXT)

- [ ] **CONTEXT-01**: Custom right-click context menu that replaces browser defaults on files/folders with actions: Rename, Delete, Share, Open/Download.
- [ ] **CONTEXT-02**: Small 3-dots icon button on file items that triggers the same custom context menu options for touch/mobile devices.

### Floating Task Queue Overlay (QUEUE)

- [ ] **QUEUE-01**: Minimizable floating task queue drawer in the bottom right corner showing active and completed upload/download tasks.
- [ ] **QUEUE-02**: Display per-file progress metrics, including upload speed (e.g. "4.2 MB/s") and estimated time remaining (ETA).
- [ ] **QUEUE-03**: Render animated progress bars for active chunk uploads and a global queue progress indicator.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-user shared folders | Out of scope for personal cloud storage focus; visual avatar piles are mockups only. |
| Native mobile/desktop app wrappers | Focus is on high-quality React web SPA first. |
| Discord Bot token dependency | Webhook-only setup keeps configuration extremely simple. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| THEME-01    | Phase 4 | Pending |
| THEME-02    | Phase 4 | Pending |
| THEME-03    | Phase 4 | Pending |
| SIDEBAR-01  | Phase 4 | Pending |
| SIDEBAR-02  | Phase 4 | Pending |
| SIDEBAR-03  | Phase 4 | Pending |
| BROWSE-01   | Phase 5 | Pending |
| BROWSE-02   | Phase 5 | Pending |
| BROWSE-03   | Phase 5 | Pending |
| BROWSE-04   | Phase 5 | Pending |
| DETAIL-01   | Phase 5 | Pending |
| DETAIL-02   | Phase 5 | Pending |
| DETAIL-03   | Phase 5 | Pending |
| CONTEXT-01  | Phase 6 | Pending |
| CONTEXT-02  | Phase 6 | Pending |
| QUEUE-01    | Phase 6 | Pending |
| QUEUE-02    | Phase 6 | Pending |
| QUEUE-03    | Phase 6 | Pending |

**Coverage:**
- v2 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-05*
*Last updated: 2026-06-05 for milestone v2.0*
