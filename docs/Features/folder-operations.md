# Feature: Folder Operations

## Purpose
Allow users to upload, download, and delete entire folders.

**Note:** This is a key differentiator from Disbox which lacks folder operations.

## Business Rules
- Folder upload preserves directory structure
- Folder download creates a ZIP file
- Delete folder prompts for confirmation if non-empty
- Recursive operations show aggregate progress

## Upload Folder Flow
1. User selects folder via input or drag-and-drop
2. System reads all files with relative paths
3. Create directory structure on server
4. Upload files in parallel (max 3 concurrent)
5. Progress shows total files and bytes

## Download Folder Flow
1. User clicks download on folder
2. System fetches all descendant files recursively
3. Download each file (parallel)
4. Add to ZIP with relative paths preserved
5. Trigger browser download of ZIP

## Delete Folder Flow
1. User clicks delete on non-empty folder
2. Show confirmation: "Delete folder and X files?"
3. Recursively delete all children (files first, then subdirs)
4. Delete parent folder
5. Remove from UI

## Test Flows

| Scenario | Input | Expected Result |
|----------|-------|-----------------|
| Upload folder | Folder with 5 files | All files appear in correct structure |
| Nested folders | 3-level deep folder | Structure preserved |
| Download folder | Folder with 10 files | ZIP downloads with correct structure |
| Delete empty folder | Empty folder | Deletes immediately |
| Delete non-empty | Folder with files | Shows confirmation, deletes all |

## Definition of Done
- [ ] Folder upload creates correct structure
- [ ] Folder download produces valid ZIP
- [ ] Recursive delete removes all children
- [ ] Progress shows aggregate for folder ops
- [ ] Integration tests pass
