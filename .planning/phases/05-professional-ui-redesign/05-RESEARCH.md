# Phase 5: Professional UI Redesign - Technical Research

This document outlines the technical research, component mapping, layout patterns, and implementation strategy to deliver a premium desktop-grade cloud storage interface.

## 1. Visual Theme System & Tokens

### Tailwind CSS v4 Color variables
We will support two core visual themes (Light & Dark) via the system-preferred selector or a toggle-controlled class on the `<html>` or `<body>` element.
We will refactor `src/index.css` theme variables to map semantic CSS variables that toggle based on a `.dark` / `.light` class:

```css
:root {
  --background: #f4f4f5; /* zinc-100 */
  --foreground: #09090b; /* zinc-950 */
  --card: #ffffff;
  --card-hover: #fafafa;
  --border: #e4e4e7; /* zinc-200 */
  --text-muted: #71717a; /* zinc-500 */
  --primary: #5865F2; /* blurple */
  --primary-hover: #4752c4;
}

.dark {
  --background: #09090b; /* zinc-950 */
  --foreground: #f4f4f5; /* zinc-100 */
  --card: #18181b; /* zinc-900 */
  --card-hover: #27272a; /* zinc-800 */
  --border: #27272a; /* zinc-800 */
  --text-muted: #a1a1aa; /* zinc-400 */
}
```

This configuration decouples styling from static Discord-themed tokens, providing standard shadcn-style dark-mode compliance.

## 2. Dashboard Shell Layout

The current layout in `src/App.tsx` has a simple vertical header + main body layout. We will transition to a flexbox/grid layout:

```tsx
<div className="flex h-screen bg-[var(--background)] text-[var(--foreground)] overflow-hidden font-sans">
  {/* Collapsible Sidebar */}
  <aside className={`flex flex-col border-r border-[var(--border)] bg-[var(--card)] transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-16'}`}>
    {/* Navigation Links, Space Indicator, Theme Switcher, and Lock Button */}
  </aside>

  {/* Main Viewport */}
  <div className="flex flex-col flex-1 overflow-hidden">
    {/* Top Navigation Bar */}
    <header className="flex items-center justify-between border-b border-[var(--border)] p-4 bg-[var(--card)]">
      {/* Breadcrumbs / View Name & Search Input */}
    </header>

    {/* Content Area */}
    <main id="main-content" className="flex-1 overflow-y-auto p-6 focus:outline-none">
      {/* Render active route panel (My Drive / Photos / Settings) */}
    </main>
  </div>

  {/* Collapsible Details Drawer */}
  <aside className={`border-l border-[var(--border)] bg-[var(--card)] transition-all duration-300 overflow-y-auto ${detailsOpen ? 'w-80' : 'w-0 border-l-0'}`}>
    {/* Selected File Details, Sharing Options, and Version History */}
  </aside>
</div>
```

### Pages / Views State
We will introduce a simple navigation state in `App.tsx` (`activeTab: 'drive' | 'photos' | 'settings'`) to govern rendering:
- `'drive'`: Render `<FileBrowser />`
- `'photos'`: Render `<PhotoTimeline />`
- `'settings'`: Render `<SettingsPanel />`

## 3. File Browser Redesign

### Folders inside File Browser
To emulate Google Drive, folders should be rendered directly in the file browser list rather than only in the sidebar tree.
In `FileList.tsx`, we will fetch the list of folders belonging to the current directory (`currentFolderId`) and render them as a separate "Folders" section preceding the "Files" section.
- **Folder Pills**: Sleek card pills with a folder icon and double-click to enter.
- **File Cards**: Sleek thumbnail preview cards (for media) or custom icon cards (for other types).

### View Mode Toggle
We will support `viewMode: 'grid' | 'list'` toggle in the top bar of `FileBrowser.tsx`.
- **List View**: Dense data table columns (`Name`, `Size`, `Created At`, `Version History Link`, `Actions Button`).
- **Grid View**: A CSS Grid layout (`grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4`) displaying visual cards.

## 4. File Details Collapsible Drawer

Instead of showing independent popup modals, we will introduce a sliding panel in the layout.
When a user clicks on a file row or card:
- Set `selectedFile` in `useFileStore` (or local state).
- The right-side sidebar drawer slides open (`w-80`).
- The drawer displays:
  - Small visual file preview/icon.
  - File Information: full file path, size, encryption iterations, date.
  - **Inline Share Config**: An inline accordion or section showing password-protection toggles, password inputs, expiry selections, link copy inputs, and existing shares list. (Derived from `ShareModal.tsx` logic).
  - **Inline Version History**: An inline list showing file version items and a "Restore" button. (Derived from `VersionHistory.tsx` logic).
- Closing the drawer is triggered by clicking a "close" icon or clicking off-target.

## 5. Persistent Audio Player Floating Dock

The current player is a full-width bottom bar. We will redesign it into a floating glassmorphic dock:
- Located at `bottom-6 right-6 z-50`.
- **Mini-player capsule**: A small rounded bubble showing track title, play/pause toggle, and a button to expand.
- **Expanded mode**: A small card showing album/media preview, progress bar slider, track name, full playback controls (next, prev, volume), and an option to minimize.
- Uses `backdrop-filter: blur(12px) bg-white/70 dark:bg-black/70` for premium glassmorphism.

## 6. Upload UX: Hidden Overlay DropZone

Instead of showing a permanent drop card, `DropZone.tsx` will be refactored to mount drag listeners globally:
- Listening to `dragover`, `dragenter`, `dragleave`, and `drop` on `window`.
- Maintain a state `isDragging` in the upload store.
- When `isDragging` is true, render a full-screen overlay with a blurred backdrop, a central dashed box, and text: "Drop files to upload encrypted to Wyvern Drive".
- Dropping files triggers `handleFiles()` and sets `isDragging` to false.

## 7. Transitions & Easing

All transitions will use native CSS ease-in-out curves to ensure high-end premium response:
- Sidebar slide: `transition-[width] duration-300 cubic-bezier(0.4, 0, 0.2, 1)`
- Details panel: `transition-[width] duration-300 cubic-bezier(0.4, 0, 0.2, 1)`
- Modals and overlays: `transition-opacity duration-200 ease-out`
- Hover state transitions on file cards: `transition-transform duration-200 ease-out hover:-translate-y-0.5`

## 8. Verification Strategy

1. **Unit Tests**:
   - Verify theme switcher state changes theme tag on `document.documentElement`.
   - Verify folder navigation updates when double-clicking folder cards.
2. **E2E Tests**:
   - Validate that clicking settings navigation displays the settings panel.
   - Validate details drawer slides open when clicking on a file card.
   - Validate dropzone overlay shows up when dragging files.

---
*Phase: 05-professional-ui-redesign*
*Research completed: 2026-06-04*
