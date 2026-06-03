# Phase 2: File Management - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers file organization capabilities: folder system with nested hierarchy, file versioning with history, advanced search/filtering, drag-and-drop organization, and virtual scrolling for 10K+ files. Users can create folders, move files between them, track file versions, search by name/type/date, and browse large file collections smoothly.

</domain>

<decisions>
## Implementation Decisions

### Folder System Design
- Unlimited nesting depth — FolderRecord.parentId already supports null (root)
- Full path breadcrumbs (e.g., Root > Projects > Photos) — standard file manager UX
- Empty folders show "This folder is empty" message with upload prompt
- Folder creation uses inline rename pattern — click "New Folder", type name, Enter to confirm

### File Versioning
- Store version metadata in FileRecord.version + version history array — each version points to chunk data
- Last 10 versions retained — sufficient for most use cases, bounded storage
- Version restore re-uploads previous version's chunks as new upload — reuses existing pipeline
- Version UI is dropdown on file row showing version list with timestamps

### Search System
- Client-side filtering of loaded files — fast for 10K+ items with IndexedDB
- Persistent search bar in header — always accessible
- AND logic across all active filters — standard expectation
- 300ms debounce on search input — responsive without thrashing re-renders

### Virtual Scrolling & Drag-and-Drop
- @tanstack/react-virtual for virtual scrolling — better than react-window for variable heights
- @dnd-kit/core for drag-and-drop — modern, accessible, tree-friendly
- Drag visual feedback: highlight drop target folder with border color change
- Both files and folders are draggable — supports moving folders into other folders

### the agent's Discretion
- All remaining implementation choices at the agent's discretion

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/types/index.ts` — FolderRecord type already defined (id, name, parentId, path, createdAt, updatedAt)
- `src/lib/db.ts` — folders store already created with parentId and path indexes
- `src/stores/file-store.ts` — currentFolderId state, loadFiles/addFile/deleteFile methods
- `src/components/FileList.tsx` — basic file listing component to extend
- `src/components/DropZone.tsx` — drag-and-drop zone to extend for folder navigation
- `src/utils/format.ts` — formatFileSize and formatDate utilities

### Established Patterns
- Zustand for state management
- IndexedDB via `idb` for metadata storage
- Radix UI for accessible components
- Tailwind CSS for styling
- Web Worker for heavy operations

### Integration Points
- FileRecord.folderId field connects files to folders
- FolderRecord.parentId enables nested hierarchy
- useFileStore.currentFolderId tracks navigation state
- DropZone handles file uploads — needs folder context
- FileList displays files — needs folder filtering

</code_context>

<specifics>
## Specific Ideas

- Folder path stored as materialized path in FolderRecord.path for efficient queries
- Virtual scrolling container wraps FileList when item count exceeds threshold
- Search filters by: name (contains), mimeType (exact/prefix), createdAt (range), folderId (current)
- Drag-and-drop uses @dnd-kit sortable for reordering within folders
- Version history stored as array in FileRecord — each entry has version number, timestamp, chunkRefs

</specifics>

<deferred>
## Deferred Ideas

- File sharing between folders (symlinks) — v2
- Batch move/copy operations — v2
- File tags/labels — v2
- Advanced version diffing — v2

</deferred>
