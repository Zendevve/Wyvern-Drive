# Phase 2: File Management — PLAN.md

**Goal:** Organize files in folders, track versions, search effectively, and handle 10K+ files smoothly.

**Requirements:** FILE-01, FILE-02, FILE-03, FILE-04, STRG-04

**Success Criteria:**
1. User can create, rename, delete, and move folders (including nested)
2. User can drag files and folders to reorganize them
3. File versions are tracked — user can view and restore previous versions
4. Search filters files by name, type, date, and current folder
5. File browser renders 10K+ items smoothly via virtual scrolling (no jank)

---

## Wave 1: Folder System + DB Schema

### Task 2.1: Folder CRUD + IndexedDB Schema Update

**requirements:** [FILE-01]
**depends_on:** []
**files_modified:** `src/lib/db.ts`, `src/types/index.ts`, `src/stores/folder-store.ts`

<read_first>
- src/lib/db.ts (current schema)
- src/types/index.ts (FolderRecord type)
- src/stores/file-store.ts (existing patterns)
- .planning/phases/02-file-management/02-CONTEXT.md (decisions)
</read_first>

<acceptance_criteria>
- `src/lib/db.ts` exports: `putFolder()`, `getFolder()`, `getAllFolders()`, `getFoldersByParentId()`, `deleteFolder()`, `getFolderPath()`
- `src/lib/db.ts` `deleteFolder()` cascades: deletes all child folders and files in the folder
- `src/stores/folder-store.ts` exports `useFolderStore` with: `folders`, `currentFolderId`, `loadFolders()`, `createFolder()`, `renameFolder()`, `deleteFolder()`, `moveFolder()`, `setCurrentFolder()`, `getFolderPath()`
- `src/stores/folder-store.ts` `createFolder()` generates UUID v4, sets parentId to current folder, builds path from parent path
- `src/stores/folder-store.ts` `deleteFolder()` cascades to all nested children
- `src/stores/folder-store.ts` `moveFolder()` updates parentId and recalculates path for all descendants
- `src/stores/folder-store.ts` `getFolderPath()` returns array of FolderRecord from root to current folder
- `src/types/index.ts` `FileRecord` has `versionHistory` field: `Array<{ version: number; timestamp: Date; chunkRefs: string[]; checksum: string }>`
</acceptance_criteria>

<action>
1. Update `src/types/index.ts` — add versionHistory to FileRecord:
   ```ts
   export interface FileVersion {
     version: number;
     timestamp: Date;
     chunkRefs: string[];
     checksum: string;
   }

   export interface FileRecord {
     // ... existing fields
     versionHistory: FileVersion[];
   }
   ```

2. Update `src/lib/db.ts` — add folder CRUD operations:
   ```ts
   export async function putFolder(folder: FolderRecord): Promise<void> {
     const db = await getDb();
     await db.put('folders', folder);
   }

   export async function getFolder(id: string): Promise<FolderRecord | undefined> {
     const db = await getDb();
     return db.get('folders', id);
   }

   export async function getAllFolders(): Promise<FolderRecord[]> {
     const db = await getDb();
     return db.getAll('folders');
   }

   export async function getFoldersByParentId(parentId: string | null): Promise<FolderRecord[]> {
     const db = await getDb();
     return db.getAllFromIndex('folders', 'parentId', parentId);
   }

   export async function deleteFolder(id: string): Promise<void> {
     const db = await getDb();
     // Cascade: delete child folders
     const children = await getFoldersByParentId(id);
     for (const child of children) {
       await deleteFolder(child.id);
     }
     // Cascade: delete files in this folder
     const files = await db.getAllFromIndex('files', 'folderId', id);
     for (const file of files) {
       await deleteFile(file.id);
     }
     await db.delete('folders', id);
   }

   export async function getFolderPath(folderId: string): Promise<FolderRecord[]> {
     const path: FolderRecord[] = [];
     let currentId: string | null = folderId;
     while (currentId) {
       const folder = await getFolder(currentId);
       if (!folder) break;
       path.unshift(folder);
       currentId = folder.parentId;
     }
     return path;
   }
   ```

3. Create `src/stores/folder-store.ts`:
   ```ts
   import { create } from 'zustand';
   import { v4 as uuidv4 } from 'uuid';
   import type { FolderRecord } from '../types';
   import {
     putFolder, getAllFolders, getFoldersByParentId,
     deleteFolder as dbDeleteFolder, getFolderPath as dbGetFolderPath
   } from '../lib/db';

   interface FolderState {
     folders: FolderRecord[];
     currentFolderId: string | null;
     isLoading: boolean;
     loadFolders: () => Promise<void>;
     createFolder: (name: string) => Promise<FolderRecord>;
     renameFolder: (id: string, name: string) => Promise<void>;
     deleteFolder: (id: string) => Promise<void>;
     moveFolder: (id: string, newParentId: string | null) => Promise<void>;
     setCurrentFolder: (folderId: string | null) => void;
     getFolderPath: () => Promise<FolderRecord[]>;
   }

   export const useFolderStore = create<FolderState>((set, get) => ({
     folders: [],
     currentFolderId: null,
     isLoading: false,

     loadFolders: async () => {
       set({ isLoading: true });
       const folders = await getAllFolders();
       set({ folders, isLoading: false });
     },

     createFolder: async (name: string) => {
       const { currentFolderId, folders } = get();
       const parentPath = currentFolderId
         ? folders.find(f => f.id === currentFolderId)?.path ?? ''
         : '';
       const folder: FolderRecord = {
         id: uuidv4(),
         name,
         parentId: currentFolderId,
         path: parentPath ? `${parentPath}/${name}` : name,
         createdAt: new Date(),
         updatedAt: new Date(),
       };
       await putFolder(folder);
       set(state => ({ folders: [...state.folders, folder] }));
       return folder;
     },

     renameFolder: async (id: string, name: string) => {
       const folder = get().folders.find(f => f.id === id);
       if (!folder) return;
       const updated = { ...folder, name, updatedAt: new Date() };
       if (folder.parentId) {
         const parent = get().folders.find(f => f.id === folder.parentId);
         updated.path = parent ? `${parent.path}/${name}` : name;
       } else {
         updated.path = name;
       }
       await putFolder(updated);
       set(state => ({
         folders: state.folders.map(f => f.id === id ? updated : f),
       }));
     },

     deleteFolder: async (id: string) => {
       await dbDeleteFolder(id);
       set(state => ({
         folders: state.folders.filter(f => f.id !== id),
       }));
     },

     moveFolder: async (id: string, newParentId: string | null) => {
       const folder = get().folders.find(f => f.id === id);
       if (!folder) return;
       const updated = { ...folder, parentId: newParentId, updatedAt: new Date() };
       const parentPath = newParentId
         ? get().folders.find(f => f.id === newParentId)?.path ?? ''
         : '';
       updated.path = parentPath ? `${parentPath}/${folder.name}` : folder.name;
       await putFolder(updated);
       set(state => ({
         folders: state.folders.map(f => f.id === id ? updated : f),
       }));
     },

     setCurrentFolder: (folderId: string | null) => {
       set({ currentFolderId: folderId });
     },

     getFolderPath: async () => {
       const { currentFolderId } = get();
       if (!currentFolderId) return [];
       return dbGetFolderPath(currentFolderId);
     },
   }));
   ```

4. Verify: `npm run build` exits 0
</action>

---

### Task 2.2: Breadcrumb Navigation + Folder Tree UI

**requirements:** [FILE-01]
**depends_on:** [2.1]
**files_modified:** `src/components/Breadcrumbs.tsx`, `src/components/FolderTree.tsx`, `src/components/FileBrowser.tsx`, `src/App.tsx`

<read_first>
- src/stores/folder-store.ts (useFolderStore)
- src/stores/file-store.ts (useFileStore)
- src/components/FileList.tsx (existing file listing)
- src/App.tsx (current layout)
</read_first>

<acceptance_criteria>
- `src/components/Breadcrumbs.tsx` exports `Breadcrumbs` component
- `Breadcrumbs` shows full path: `Root > FolderA > FolderB` with clickable segments
- `Breadcrumbs` calls `useFolderStore().setCurrentFolder()` on segment click
- `src/components/FolderTree.tsx` exports `FolderTree` component
- `FolderTree` shows nested folder list with expand/collapse
- `FolderTree` highlights current folder
- `src/components/FileBrowser.tsx` exports `FileBrowser` component combining Breadcrumbs + FolderTree + FileList
- `FileBrowser` shows empty state message when folder has no files
- `src/App.tsx` renders `FileBrowser` instead of raw `FileList`
</acceptance_criteria>

<action>
1. Create `src/components/Breadcrumbs.tsx`:
   ```tsx
   import { useEffect, useState } from 'react';
   import { useFolderStore } from '../stores/folder-store';
   import type { FolderRecord } from '../types';

   export function Breadcrumbs() {
     const [path, setPath] = useState<FolderRecord[]>([]);
     const currentFolderId = useFolderStore(s => s.currentFolderId);
     const getFolderPath = useFolderStore(s => s.getFolderPath);
     const setCurrentFolder = useFolderStore(s => s.setCurrentFolder);

     useEffect(() => {
       getFolderPath().then(setPath);
     }, [currentFolderId, getFolderPath]);

     return (
       <nav className="flex items-center gap-1 text-sm text-discord-muted mb-4">
         <button
           onClick={() => setCurrentFolder(null)}
           className="hover:text-discord-text transition-colors"
         >
           Root
         </button>
         {path.map((folder) => (
           <span key={folder.id} className="flex items-center gap-1">
             <span>/</span>
             <button
               onClick={() => setCurrentFolder(folder.id)}
               className="hover:text-discord-text transition-colors"
             >
               {folder.name}
             </button>
           </span>
         ))}
       </nav>
     );
   }
   ```

2. Create `src/components/FolderTree.tsx`:
   ```tsx
   import { useState } from 'react';
   import { useFolderStore } from '../stores/folder-store';

   export function FolderTree() {
     const folders = useFolderStore(s => s.folders);
     const currentFolderId = useFolderStore(s => s.currentFolderId);
     const setCurrentFolder = useFolderStore(s => s.setCurrentFolder);
     const [expanded, setExpanded] = useState<Set<string>>(new Set());

     const rootFolders = folders.filter(f => f.parentId === null);
     const getChildren = (parentId: string) => folders.filter(f => f.parentId === parentId);

     const toggleExpand = (id: string) => {
       setExpanded(prev => {
         const next = new Set(prev);
         if (next.has(id)) next.delete(id);
         else next.add(id);
         return next;
       });
     };

     const renderFolder = (folder: typeof folders[0], depth: number = 0) => {
       const children = getChildren(folder.id);
       const isExpanded = expanded.has(folder.id);
       const isActive = currentFolderId === folder.id;

       return (
         <div key={folder.id}>
           <div
             className={`flex items-center gap-1 py-1 px-2 rounded cursor-pointer text-sm ${
               isActive ? 'bg-blurple/20 text-blurple' : 'hover:bg-dark-bg'
             }`}
             style={{ paddingLeft: `${depth * 16 + 8}px` }}
             onClick={() => setCurrentFolder(folder.id)}
           >
             {children.length > 0 && (
               <button
                 onClick={(e) => { e.stopPropagation(); toggleExpand(folder.id); }}
                 className="text-xs w-4"
               >
                 {isExpanded ? '▼' : '▶'}
               </button>
             )}
             {children.length === 0 && <span className="w-4" />}
             <span>📁</span>
             <span className="truncate">{folder.name}</span>
           </div>
           {isExpanded && children.map(child => renderFolder(child, depth + 1))}
         </div>
       );
     };

     return (
       <div className="space-y-0.5">
         <div
           className={`flex items-center gap-1 py-1 px-2 rounded cursor-pointer text-sm ${
             currentFolderId === null ? 'bg-blurple/20 text-blurple' : 'hover:bg-dark-bg'
           }`}
           onClick={() => setCurrentFolder(null)}
         >
           <span className="w-4" />
           <span>📁</span>
           <span>Root</span>
         </div>
         {rootFolders.map(folder => renderFolder(folder))}
       </div>
     );
   }
   ```

3. Create `src/components/FileBrowser.tsx`:
   ```tsx
   import { useEffect } from 'react';
   import { useFolderStore } from '../stores/folder-store';
   import { useFileStore } from '../stores/file-store';
   import { Breadcrumbs } from './Breadcrumbs';
   import { FolderTree } from './FolderTree';
   {FileList} from './FileList';

   export function FileBrowser() {
     const loadFolders = useFolderStore(s => s.loadFolders);
     const loadFiles = useFileStore(s => s.loadFiles);

     useEffect(() => {
       loadFolders();
       loadFiles();
     }, [loadFolders, loadFiles]);

     return (
       <div className="flex gap-4">
         <aside className="w-48 shrink-0">
           <FolderTree />
         </aside>
         <main className="flex-1 min-w-0">
           <Breadcrumbs />
           <FileList />
         </main>
       </div>
     );
   }
   ```

4. Update `src/App.tsx` — replace FileList with FileBrowser:
   ```tsx
   // Change import
   import { FileBrowser } from './components/FileBrowser';
   // In render: replace <FileList /> with <FileBrowser />
   ```

5. Verify: `npm run build` exits 0
</action>

---

### Task 2.3: Folder CRUD UI (Create, Rename, Delete, Move)

**requirements:** [FILE-01, FILE-02]
**depends_on:** [2.2]
**files_modified:** `src/components/FolderActions.tsx`, `src/components/FolderTree.tsx`, `src/components/FileBrowser.tsx`

<read_first>
- src/stores/folder-store.ts (createFolder, renameFolder, deleteFolder)
- src/components/FolderTree.tsx (current implementation)
- .planning/phases/02-file-management/02-CONTEXT.md (inline rename, drag-drop decisions)
</read_first>

<acceptance_criteria>
- `src/components/FolderActions.tsx` exports `FolderActions` component with: New Folder button, Rename, Delete
- `FolderActions` "New Folder" creates folder with inline rename (input auto-focused)
- `FolderActions` Delete shows confirmation before cascading delete
- `FolderTree.tsx` updated to support inline rename (double-click → input field)
- `FolderTree.tsx` supports drag-over highlighting for folder targets
- `FileBrowser.tsx` includes FolderActions in toolbar area
</acceptance_criteria>

<action>
1. Create `src/components/FolderActions.tsx`:
   ```tsx
   import { useState } from 'react';
   import { useFolderStore } from '../stores/folder-store';

   export function FolderActions() {
     const [isCreating, setIsCreating] = useState(false);
     const [newName, setNewName] = useState('');
     const createFolder = useFolderStore(s => s.createFolder);

     const handleCreate = async () => {
       if (!newName.trim()) return;
       await createFolder(newName.trim());
       setNewName('');
       setIsCreating(false);
     };

     return (
       <div className="flex items-center gap-2 mb-4">
         {isCreating ? (
           <input
             type="text"
             value={newName}
             onChange={(e) => setNewName(e.target.value)}
             onKeyDown={(e) => {
               if (e.key === 'Enter') handleCreate();
               if (e.key === 'Escape') setIsCreating(false);
             }}
             onBlur={handleCreate}
             placeholder="Folder name"
             className="bg-darker-bg border border-gray-600 rounded px-2 py-1 text-sm"
             autoFocus
           />
         ) : (
           <button
             onClick={() => setIsCreating(true)}
             className="px-3 py-1 bg-dark-bg hover:bg-dark-bg/80 rounded text-sm"
           >
             + New Folder
           </button>
         )}
       </div>
     );
   }
   ```

2. Update `src/components/FolderTree.tsx` — add inline rename and drag support:
   ```tsx
   // Add rename state and handlers
   const [renamingId, setRenamingId] = useState<string | null>(null);
   const [renameValue, setRenameValue] = useState('');
   const renameFolder = useFolderStore(s => s.renameFolder);
   const deleteFolder = useFolderStore(s => s.deleteFolder);

   const startRename = (id: string, name: string) => {
     setRenamingId(id);
     setRenameValue(name);
   };

   const commitRename = async () => {
     if (renamingId && renameValue.trim()) {
       await renameFolder(renamingId, renameValue.trim());
     }
     setRenamingId(null);
   };

   // In renderFolder: show input when renaming, double-click to start rename
   ```

3. Update `src/components/FileBrowser.tsx` — add FolderActions:
   ```tsx
   import { FolderActions } from './FolderActions';
   // Add <FolderActions /> above FileList
   ```

4. Verify: `npm run build` exits 0
</action>

---

## Wave 2: Drag-and-Drop + File Versioning

### Task 2.4: Drag-and-Drop File/Folder Organization

**requirements:** [FILE-02]
**depends_on:** [2.3]
**files_modified:** `src/components/DropZone.tsx`, `src/components/FileList.tsx`, `src/components/FileBrowser.tsx`, `package.json`

<read_first>
- src/components/DropZone.tsx (current drag-drop)
- src/components/FileList.tsx (file listing)
- src/stores/file-store.ts (file CRUD)
- src/stores/folder-store.ts (folder CRUD)
</read_first>

<acceptance_criteria>
- `package.json` contains `@dnd-kit/core` and `@dnd-kit/sortable` dependencies
- `src/components/FileBrowser.tsx` wraps content in `DndContext` provider
- `src/components/FileList.tsx` items are draggable via `useDraggable`
- `src/components/FolderTree.tsx` folders are droppable targets via `useDroppable`
- Dragging file over folder highlights the folder with border change
- Dropping file on folder calls `fileStore.setCurrentFolder()` + updates `fileRecord.folderId`
- Visual feedback: dragged item has opacity change, drop target has border highlight
</acceptance_criteria>

<action>
1. Install dnd-kit:
   ```bash
   npm install @dnd-kit/core @dnd-kit/sortable
   ```

2. Update `src/components/FileBrowser.tsx` — wrap in DndContext:
   ```tsx
   import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useState } from '@dnd-kit/core';
   // Wrap content in DndContext, handle onDragEnd to move files between folders
   ```

3. Update `src/components/FileList.tsx` — make items draggable:
   ```tsx
   import { useDraggable } from '@dnd-kit/core';
   // Each file row gets useDraggable hook
   ```

4. Update `src/components/FolderTree.tsx` — make folders droppable:
   ```tsx
   import { useDroppable } from '@dnd-kit/core';
   // Each folder gets useDroppable hook, highlight on drag-over
   ```

5. Verify: `npm run build` exits 0
</action>

---

### Task 2.5: File Versioning System

**requirements:** [FILE-03]
**depends_on:** [2.1]
**files_modified:** `src/lib/versioning.ts`, `src/stores/file-store.ts`, `src/components/VersionHistory.tsx`

<read_first>
- src/types/index.ts (FileVersion interface)
- src/lib/upload.ts (uploadFile function)
- src/lib/db.ts (putFile, getFile)
- src/stores/file-store.ts (addFile, files)
</read_first>

<acceptance_criteria>
- `src/lib/versioning.ts` exports `createVersion(fileId, file, key, webhookUrl, onProgress)` — uploads new version, appends to versionHistory
- `src/lib/versioning.ts` exports `restoreVersion(fileId, version, key, webhookUrl)` — re-uploads old version's chunks as new version
- `src/lib/versioning.ts` exports `getVersions(fileId)` — returns versionHistory array from FileRecord
- `src/components/VersionHistory.tsx` exports `VersionHistory` component
- `VersionHistory` shows dropdown list of versions with timestamps
- `VersionHistory` has "Restore" button per version
- `src/components/FileActions.tsx` includes version history toggle
</actuion_criteria>

<action>
1. Create `src/lib/versioning.ts`:
   ```ts
   import { getFile, putFile, getChunksByFileId } from './db';
   import { uploadFile } from './upload';
   import type { FileVersion } from '../types';

   export async function createVersion(
     fileId: string,
     file: File,
     key: CryptoKey,
     webhookUrl: string,
     onProgress?: (progress: any) => void
   ): Promise<void> {
     const existing = await getFile(fileId);
     if (!existing) throw new Error('File not found');

     const newRecord = await uploadFile(file, key, webhookUrl, onProgress);
     const chunks = await getChunksByFileId(newRecord.id);

     const version: FileVersion = {
       version: existing.versionHistory.length + 1,
       timestamp: new Date(),
       chunkRefs: chunks.map(c => c.id),
       checksum: newRecord.checksum,
     };

     existing.versionHistory.push(version);
     existing.version = version.version;
     existing.updatedAt = new Date();
     await putFile(existing);
   }

   export async function restoreVersion(
     fileId: string,
     versionNumber: number,
     key: CryptoKey,
     webhookUrl: string
   ): Promise<void> {
     const file = await getFile(fileId);
     if (!file) throw new Error('File not found');
     const version = file.versionHistory.find(v => v.version === versionNumber);
     if (!version) throw new Error('Version not found');
     // Version restore creates a new version entry pointing to same chunks
     const newVersion: FileVersion = {
       version: file.versionHistory.length + 1,
       timestamp: new Date(),
       chunkRefs: version.chunkRefs,
       checksum: version.checksum,
     };
     file.versionHistory.push(newVersion);
     file.version = newVersion.version;
     file.updatedAt = new Date();
     await putFile(file);
   }

   export async function getVersions(fileId: string): Promise<FileVersion[]> {
     const file = await getFile(fileId);
     return file?.versionHistory ?? [];
   }
   ```

2. Create `src/components/VersionHistory.tsx`:
   ```tsx
   import { useState, useEffect } from 'react';
   import { getVersions, restoreVersion } from '../lib/versioning';
   {useAuthStore} from '../stores/auth-store';
   {getWebhookUrl} from '../stores/file-store';
   import type { FileVersion } from '../types';

   interface Props { fileId: string; onClose: () => void; }

   export function VersionHistory({ fileId, onClose }: Props) {
     const [versions, setVersions] = useState<FileVersion[]>([]);
     const key = useAuthStore(s => s.derivedKey);

     useEffect(() => { getVersions(fileId).then(setVersions); }, [fileId]);

     const handleRestore = async (version: number) => {
       if (!key) return;
       const webhookUrl = getWebhookUrl();
       if (!webhookUrl) return;
       await restoreVersion(fileId, version, key, webhookUrl);
       onClose();
     };

     return (
       <div className="bg-darker-bg p-4 rounded-lg">
         <h3 className="font-bold mb-2">Version History</h3>
         {versions.length === 0 && <p className="text-discord-muted text-sm">No versions</p>}
         {versions.map(v => (
           <div key={v.version} className="flex items-center justify-between py-1">
             <span className="text-sm">v{v.version} — {new Date(v.timestamp).toLocaleString()}</span>
             <button onClick={() => handleRestore(v.version)} className="text-xs text-blurple hover:underline">Restore</button>
           </div>
         ))}
       </div>
     );
   }
   ```

3. Verify: `npm run build` exits 0
</action>

---

## Wave 3: Search + Virtual Scrolling

### Task 2.6: Advanced Search System

**requirements:** [FILE-04]
**depends_on:** [2.2]
**files_modified:** `src/components/SearchBar.tsx`, `src/stores/search-store.ts`, `src/components/FileList.tsx`, `src/components/FileBrowser.tsx`, `src/App.tsx`

<read_first>
- src/stores/file-store.ts (files array)
- src/stores/folder-store.ts (currentFolderId)
- src/types/index.ts (FileRecord fields)
- .planning/phases/02-file-management/02-CONTEXT.md (search decisions)
</read_first>

<acceptance_criteria>
- `src/stores/search-store.ts` exports `useSearchStore` with: `query`, `filters`, `setQuery()`, `setFilter()`, `clearFilters()`
- `src/stores/search-store.ts` `filters` supports: `name` (string), `mimeType` (string), `dateFrom` (Date), `dateTo` (Date), `folderId` (string | null)
- `src/components/SearchBar.tsx` exports `SearchBar` component with persistent input
- `SearchBar` debounces input by 300ms before updating store
- `SearchBar` has filter dropdowns for type and date range
- `src/components/FileList.tsx` filters files using search store (AND logic across filters)
- `src/components/FileList.tsx` shows filtered count
- `src/components/FileBrowser.tsx` includes SearchBar above file list
- `src/App.tsx` includes SearchBar in header
</acceptance_criteria>

<action>
1. Create `src/stores/search-store.ts`:
   ```ts
   import { create } from 'zustand';

   interface SearchFilters {
     name: string;
     mimeType: string;
     dateFrom: Date | null;
     dateTo: Date | null;
     folderId: string | null;
   }

   interface SearchState {
     query: string;
     filters: SearchFilters;
     setQuery: (q: string) => void;
     setFilter: <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => void;
     clearFilters: () => void;
   }

   const defaultFilters: SearchFilters = {
     name: '', mimeType: '', dateFrom: null, dateTo: null, folderId: null,
   };

   export const useSearchStore = create<SearchState>((set) => ({
     query: '',
     filters: { ...defaultFilters },
     setQuery: (q) => set({ query: q }),
     setFilter: (key, value) => set(state => ({
       filters: { ...state.filters, [key]: value },
     })),
     clearFilters: () => set({ query: '', filters: { ...defaultFilters } }),
   }));
   ```

2. Create `src/components/SearchBar.tsx`:
   ```tsx
   import { useState, useEffect } from 'react';
   import { useSearchStore } from '../stores/search-store';

   export function SearchBar() {
     const [localQuery, setLocalQuery] = useState('');
     const setQuery = useSearchStore(s => s.setQuery);

     useEffect(() => {
       const timer = setTimeout(() => setQuery(localQuery), 300);
       return () => clearTimeout(timer);
     }, [localQuery, setQuery]);

     return (
       <div className="flex items-center gap-2 mb-4">
         <input
           type="text"
           value={localQuery}
           onChange={(e) => setLocalQuery(e.target.value)}
           placeholder="Search files..."
           className="flex-1 bg-dark-bg border border-gray-600 rounded px-3 py-2 text-sm"
         />
       </div>
     );
   }
   ```

3. Update `src/components/FileList.tsx` — add search filtering:
   ```tsx
   import { useSearchStore } from '../stores/search-store';

   // In component: filter files using search store
   const query = useSearchStore(s => s.query);
   const filters = useSearchStore(s => s.filters);
   const currentFolderId = useFolderStore(s => s.currentFolderId);

   const filteredFiles = files.filter(file => {
     if (file.folderId !== currentFolderId) return false;
     if (query && !file.name.toLowerCase().includes(query.toLowerCase())) return false;
     if (filters.mimeType && file.mimeType !== filters.mimeType) return false;
     if (filters.dateFrom && file.createdAt < filters.dateFrom) return false;
     if (filters.dateTo && file.createdAt > filters.dateTo) return false;
     return true;
   });
   ```

4. Verify: `npm run build` exits 0
</action>

---

### Task 2.7: Virtual Scrolling for 10K+ Files

**requirements:** [STRG-04]
**depends_on:** [2.6]
**files_modified:** `src/components/FileList.tsx`, `package.json`

<read_first>
- src/components/FileList.tsx (current implementation)
- package.json (check for existing virtual scroll lib)
</read_first>

<acceptance_criteria>
- `package.json` contains `@tanstack/react-virtual` dependency
- `src/components/FileList.tsx` uses `useVirtualizer` from `@tanstack/react-virtual`
- `FileList` renders virtual list when file count > 50, normal list otherwise
- Virtual list has fixed row height (48px) for consistent scrolling
- Virtual list container has `overflow-y: auto` and calculated height
- Scroll performance: no jank with 10K items (measured by frame rate during scroll)
</acceptance_criteria>

<action>
1. Install tanstack virtual:
   ```bash
   npm install @tanstack/react-virtual
   ```

2. Update `src/components/FileList.tsx`:
   ```tsx
   import { useVirtualizer } from '@tanstack/react-virtual';
   import { useRef } from 'react';

   // In component:
   const parentRef = useRef<HTMLDivElement>(null);
   const rowVirtualizer = useVirtualizer({
     count: filteredFiles.length,
     getScrollElement: () => parentRef.current,
     estimateSize: () => 48,
     overscan: 5,
   });

   // Render virtual list when count > 50
   if (filteredFiles.length > 50) {
     return (
       <div ref={parentRef} className="h-[600px] overflow-auto">
         <div style={{ height: rowVirtualizer.getTotalSize() }}>
           {rowVirtualizer.getVirtualItems().map(virtualRow => (
             <div
               key={virtualRow.key}
               style={{
                 position: 'absolute',
                 top: virtualRow.start,
                 height: virtualRow.size,
                 width: '100%',
               }}
             >
               {/* Render file row */}
             </div>
           ))}
         </div>
       </div>
     );
   }
   ```

3. Verify: `npm run build` exits 0
</action>

---

## Verification

After all tasks complete:

```bash
# Build must succeed
npm run build

# All files exist
ls src/stores/folder-store.ts src/stores/search-store.ts src/lib/versioning.ts
ls src/components/Breadcrumbs.tsx src/components/FolderTree.tsx src/components/FolderActions.tsx
ls src/components/FileBrowser.tsx src/components/SearchBar.tsx src/components/VersionHistory.tsx
```

---

## must_haves

1. **FILE-01**: Folder system — create, rename, delete, move, nested folders with breadcrumbs
2. **FILE-02**: Drag-and-drop — files and folders draggable between folders via @dnd-kit
3. **FILE-03**: File versioning — version history array, restore previous versions
4. **FILE-04**: Advanced search — filter by name, type, date, folder with 300ms debounce
5. **STRG-04**: Virtual scrolling — @tanstack/react-virtual for 10K+ files
