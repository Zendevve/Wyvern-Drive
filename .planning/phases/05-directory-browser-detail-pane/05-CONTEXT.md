# Phase 5: Directory Browser & Detail Side-Pane - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase enhances the core file manager browser with:
1. Grid/list toggle with smooth transitions (existing, verify)
2. Horizontal filter chips for file categories with item counts (BROWSE-02)
3. Premium folder card visuals with favorite star and avatar pile mockups (BROWSE-03)
4. "+ Create Folder" dotted-outline grid card (BROWSE-04)
5. Collapsible right detail pane with metadata and visual preview (DETAIL-01, DETAIL-02, DETAIL-03)

The phase builds on Phase 4's design system (Artano monochrome theme, Outfit typography, 260px sidebar).
</domain>

<decisions>
## Implementation Decisions

### Category Filter Chips (BROWSE-02)
- **Location**: Top of file grid/list area, below breadcrumb/header
- **Categories**: All, Documents, Images, Videos, Audio, Others (matching sidebar breakdown)
- **Behavior**: Single-select filter (one active at a time), "All" shows everything
- **Visual**: Rounded pill buttons with category icon + name + count badge
- **Active state**: White background, black text, subtle shadow
- **Inactive state**: Dark surface, white text, hover to lighter surface
- **Counts**: Fetched from backend `/fs/stats` endpoint, update on folder navigation

### Premium Folder Cards (BROWSE-03)
- **Structure**: Card with icon area, name, favorite star (top-right), size/meta (bottom)
- **Favorite star**: Toggle button (outline → filled white), persists in SQLite (new `is_favorite` column)
- **Avatar pile**: Mock collaborative avatars (3-4 small circles with initials) - visual only, no backend
- **Hover**: Subtle lift + border highlight (existing `.file-card:hover` enhanced)
- **Selection**: Ring outline (existing `.file-card.is-selected` enhanced)
- **Grid sizing**: Min 180px, max 1fr (existing `.drive-grid` maintained)

### Create Folder Card (BROWSE-04)
- **Position**: First card in grid view (prepended to items)
- **Visual**: Dotted border (`2px dashed var(--border-subtle)`), centered `+` icon, "New Folder" label
- **Interaction**: Click opens folder creation modal (existing Modal component)
- **Keyboard**: Focusable, Enter/Space to activate
- **List view**: Also shown as first row with folder icon

### Detail Pane Enhancements (DETAIL-01, DETAIL-02, DETAIL-03)
- **Collapsible**: Toggle button in topbar (hamburger/chevron), animate width 320px → 0
- **State**: Persist in localStorage, default open on desktop
- **Visual Preview** (DETAIL-03):
  - **Images**: Full-size thumbnail with lightbox on click
  - **Videos**: Native `<video>` player with controls
  - **Audio**: Native `<audio>` player with waveform visualization (CSS only)
  - **Documents (PDF)**: `<iframe>` embed or placeholder icon
  - **Others**: Large file-type icon with metadata
- **Metadata**: Enhanced with CDN status indicator (green=valid, yellow=expired, red=error)
- **Actions**: Share (copy link), Download, Rename, Delete (existing modal)

### Integration Points
- `DrivePage.tsx`: Add filter chips, create folder card, collapsible detail pane toggle
- `FileCard.tsx`: Enhance with favorite star, avatar pile
- `FileList.tsx`: Add filter support, create folder row
- `DetailPanel.tsx`: Add visual preview, collapsible logic
- `components.css`: Filter chip styles, avatar pile, create folder card, preview styles
- `api/fs.ts`: Add category filter param to folder listing endpoint
- `hooks/useFolder.ts`: Accept filter parameter

### Database Schema Change
- Add `is_favorite BOOLEAN DEFAULT 0` to `nodes` table
- Migration handled by existing schema versioning

### Design Consistency
- All new elements use Artano tokens: `--bg-surface-1`, `--border-subtle`, `--text-primary`, `--accent`
- Micro-animations use `--d-base` (200ms) and `--ease-out` (cubic-bezier)
- Dot pattern backgrounds on card headers where appropriate
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `web/src/components/DrivePage.tsx` - Main browser view, has grid/list toggle, context menu, detail panel
- `web/src/components/FileCard.tsx` - Grid view cards
- `web/src/components/FileList.tsx` - List view table
- `web/src/components/DetailPanel.tsx` - Right detail pane (needs enhancement)
- `web/src/components/Breadcrumb.tsx` - Navigation breadcrumbs
- `web/src/components/Modal.tsx` - Reusable modal for folder creation
- `web/src/components/icons.tsx` - File category icons (Document, Image, Video, Audio, File, Folder)
- `web/src/hooks/useFolder.ts` - Folder data fetching hook
- `web/src/api/fs.ts` - Backend API calls
- `web/src/styles/components.css` - All component styles including `.drive-grid`, `.file-card`, `.detail-panel`

### Established Patterns
- Styling: Vanilla CSS variables from `tokens.css`, imported in `global.css` and `components.css`
- State: Zustand stores (`selection`, `toasts`, `auth`, `uploads`)
- Data fetching: React Query-style `useFolder` hook with `refetch`
- Routing: `react-router-dom` with `/drive/:folderId` paths
- Components: Functional React with TypeScript, CSS Modules not used (global classes)

### Integration Points
- `DrivePage` is the main composition point for browser enhancements
- `DetailPanel` receives `node` prop and `onDelete` callback
- `FileCard`/`FileList` receive `selected` and `onSelect` props
- Backend `/fs/stats` already returns category breakdown for sidebar
</code_context>

<specifics>
## Specific Ideas
- Filter chips should animate in/out with stagger (50ms delay each)
- Favorite star uses the same white/black contrast as other interactive elements
- Avatar pile: 3 overlapping circles, last shows "+N" for more
- Create folder card uses the same dotted pattern as `.dot-pattern` utility
- Detail pane collapse uses CSS transition on width + transform for smooth 200ms animation
- Visual preview area maintains aspect ratio (16:9 for video, 4:3 for images)
</specifics>

<deferred>
## Deferred Ideas
- Multi-select with shift/click (Phase 6+)
- Keyboard navigation for filter chips (Phase 6+)
- Custom thumbnail generation for videos/documents (backend enhancement)
- Real collaborative avatars (out of scope per PROJECT.md)
- Detail pane resizing drag handle (nice-to-have)
</deferred>