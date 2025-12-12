# Feature: File Move & Edit

## Purpose
Allow users to move files between folders and edit/overwrite existing files.

**Note:** Disbox has these marked as "Coming soon (Untested)". We implement them properly.

## Move File Flow
1. User drags file to different folder OR uses right-click → Move
2. System validates target folder exists
3. Update file's parent_id in database
4. Refresh source and target folder views
5. Show success toast

## Edit/Overwrite File Flow
1. User uploads file with same name to same location
2. System detects existing file
3. Prompt: "Replace existing file?"
4. If yes: delete old chunks, upload new, update metadata
5. Optionally create version of old file first

## Business Rules
- Move is metadata-only (no re-upload of chunks)
- Cannot move file to its own subdirectory
- Edit creates version if versioning enabled
- Overwrite deletes old Discord messages

## Test Flows

| Scenario | Input | Expected Result |
|----------|-------|-----------------|
| Move to folder | Drag file to subfolder | File appears in new location |
| Move to root | Drag file to root | parent_id set to null |
| Overwrite file | Upload same filename | Old file replaced |
| Edit with version | Overwrite with versioning on | Old version saved |

## Definition of Done
- [ ] Drag-and-drop move works
- [ ] Right-click move menu works
- [ ] Overwrite prompts user
- [ ] Versioning integration tested
