# Phase 5: Professional UI Redesign - Context

**Gathered:** 2026-06-04
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase redesigns the entire application's user interface, elevating it from a basic drag-and-drop hobby project into a premium, responsive, desktop-grade cloud storage application. It implements a two-column sidebar layout, full dual light and dark themes, a toggleable grid/list browser, a right-side collapsible file details panel, a floating glassmorphic persistent player, and polished CSS animations.

</domain>

<decisions>
## Implementation Decisions

### Layout & Navigation
- **D-01:** Implement a classic desktop two-column dashboard: a collapsible left-side sidebar (for "My Drive", "Photos", "Shared Links", "Settings") and a main content area.
- **D-02:** Add a unified top bar in the main viewport containing the search field, breadcrumbs for navigation, active view status, and lock/unlock indicators.
- **D-03:** Relocate settings panel integration directly into the sidebar and main routing viewport, removing the toggle button from the header.

### Visual Style & Theming
- **D-04:** Refine the color palette to support a dual light/dark mode switch.
- **D-05:** Use slate/zinc color tokens (`#09090b` for dark background, `#ffffff` for light background) with semi-transparent glassmorphic panels (`backdrop-filter: blur()`).
- **D-06:** Implement premium modern typography (Inter as primary font) and unified border weights (thin 1px borders with sleek container shadows).
- **D-07:** Apply Tailwind CSS v4 custom variables for consistent component coloring across both themes.

### File Browser & Views
- **D-08:** Support view toggling between:
  - *Grid View*: Large visual cards displaying file preview thumbnails (for images/videos/audio) or big clean file type icons (for documents/archives), folders as neat pills.
  - *List View*: A compact table layout showing name, owner/discord tag, size, upload date, and a version pill.
- **D-09:** Build a collapsible right-side info drawer (File Details Panel) that opens when a file is selected, showing metadata (size, upload timestamp, encryption status), password-protected sharing controls, and version history.

### Audio Player
- **D-10:** Redesign the persistent audio player as a floating glassmorphic dock in the bottom-right corner. It should collapse to a mini-controller and expand on click/hover without interrupting playback.

### Upload UX
- **D-11:** Implement a fullscreen dropzone overlay that activates only when a file is dragged anywhere over the window. Remove the permanent dashboard dropzone panel for a cleaner aesthetic.

### Animations
- **D-12:** Use Tailwind v4 native CSS transitions for smooth visual micro-interactions (sidebar toggle sliding, details panel slide-in, grid/list viewport flip, and hover lift effects).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/PROJECT.md` — Core value, constraints, and non-negotiables.
- `.planning/REQUIREMENTS.md` — Technical and functional specifications.
- `src/App.tsx` — Root component layout and routing structure.
- `src/index.css` — Custom theme definitions and tailwind styling.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/AudioPlayer.tsx` — Evolve into the floating dock component.
- `src/components/FileBrowser.tsx` — Needs to support view mode toggle (list vs grid).
- `src/components/VersionHistory.tsx` — Extract and render inside the right-side Details drawer.
- `src/components/ShareModal.tsx` — Integrate sharing configuration panel into the Details drawer.

### Established Patterns
- Tailwind CSS v4 variables in `src/index.css`.
- Zustand stores for state management (`useAuthStore`, `useFileStore`, `useFolderStore`, etc.).
- Radix UI dialogs for focus-trapped password and configuration modals.

### Integration Points
- `src/App.tsx` — Needs restructuring for the sidebar/main grid layout.
- `src/index.css` — Needs configuration of light mode styling tokens.
- `src/components/DropZone.tsx` — Convert from a static card block to a fullscreen overlay listener.

</code_context>

<specifics>
## Specific Ideas

- The light mode should use soft grays (`#f4f4f5`) with crisp border lines (`#e4e4e7`) and clean dark text (`#09090b`) to emulate Google Drive's sleek workspace aesthetic.
- The dark mode should use rich zinc colors (`#09090b` for background, `#18181b` for sidebar/main cards) rather than the standard blue-gray Discord color scheme.

</specifics>

<deferred>
## Deferred Ideas

- Custom themes beyond light/dark (e.g., custom primary colors) — Deferred to v2.
- Interactive file dragging to move files into sidebar folders — Deferred to v2.

</deferred>

---
*Phase: 05-professional-ui-redesign*
*Context gathered: 2026-06-04*
