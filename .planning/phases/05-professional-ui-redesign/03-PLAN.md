---
wave: 2
depends_on: [1]
files_modified:
  - src/components/FileBrowser.tsx
  - src/components/FileList.tsx
autonomous: true
---

# Plan 03: File Browser Grid/List Toggle & Folder Card View

**Objective:** Enhance `FileList.tsx` and `FileBrowser.tsx` to support a visual Grid vs List toggle, render folder navigation cards directly in the view above files, and style files as preview-rich grid cards.

## Must Haves
- Toggleable Grid / List view mode for the active folder content.
- Folders belonging to `currentFolderId` render as compact, double-clickable card pills at the top of the view.
- Grid mode renders files as cards with thumbnail previews for media and file-type specific icons (documents, audio, archives).
- Clicking a file card or list row selects the file (sets it as active file for the right details panel).

## Tasks

<task id="file_browser_layout_cleanup">
  <title>Clean up FileBrowser Wrapper</title>
  <read_first>
    <file>src/components/FileBrowser.tsx</file>
  </read_first>
  <acceptance_criteria>
    <criterion>src/components/FileBrowser.tsx no longer renders the sidebar FolderTree directly</criterion>
  </acceptance_criteria>
  <action>
    Modify `src/components/FileBrowser.tsx` so that it doesn't render `FolderTree` (which is now in the main application left sidebar). Instead, make it render the full width breadcrumbs, folder action buttons, search bar, and the modified `FileList` view.
  </action>
</task>

<task id="render_folders_in_view">
  <title>Render Folder Pills at Top of File View</title>
  <read_first>
    <file>src/components/FileList.tsx</file>
  </read_first>
  <acceptance_criteria>
    <criterion>src/components/FileList.tsx imports useFolderStore folders state</criterion>
    <criterion>Folder cards double-click handler triggers currentFolderId update</criterion>
  </acceptance_criteria>
  <action>
    Modify `src/components/FileList.tsx` to fetch folders from `useFolderStore`.
    1. Filter folders where parent ID is `currentFolderId`.
    2. Render folders in a grid layout (`grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6`) at the top, preceding files.
    3. Each folder card must render a folder icon, name, and handle double-click to navigate into the folder (updating `currentFolderId`).
  </action>
</task>

<task id="grid_list_layout_refactoring">
  <title>Refactor Grid and List Layouts for Files</title>
  <read_first>
    <file>src/components/FileList.tsx</file>
  </read_first>
  <acceptance_criteria>
    <criterion>FileList supports viewMode state toggling between 'grid' and 'list'</criterion>
    <criterion>Grid view renders thumbnail or type icon cards</criterion>
  </acceptance_criteria>
  <action>
    Refactor file list rendering in `src/components/FileList.tsx`:
    1. Remove timeline/photo option (since it is now a dedicated left sidebar tab).
    2. Define View Mode state `'grid' | 'list'`.
    3. In List View: Render a clean, aligned list of file rows.
    4. In Grid View: Render file cards in a responsive grid. Each card displays a card surface, preview thumbnail (if image/video), type-specific icon, file name, size, and secondary metadata.
    5. Clicking a file should set it as the active file (e.g. updating a selected file ID or dispatching selection for details drawer).
  </action>
</task>

## Verification
- Click Grid/List toggles: verify view mode switches seamlessly.
- Click folders in folder section: verify double-clicking enters folders and updates breadcrumbs correctly.
- Select files: verify they highlight and register selection.
