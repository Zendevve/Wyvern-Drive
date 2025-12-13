# Feature: Navigation & UX Foundation

## Purpose
Enhance the core file system navigation and interaction to feel native and snappy. This corresponds to Phase 3 of the roadmap.

## Business Rules
- **Breadcrumbs**:
  - Must display the full path from Root to Current Folder.
  - Each segment must be clickable to navigate to that ancestor.
  - "Home" acts as Root.

- **Selection**:
  - **Single Click**: Selects an item (highlights it).
  - **Ctrl/Cmd + Click**: Toggles selection of item (additive).
  - **Shift + Click**: Selects a range of items from last selected to current.
  - **Drag Selection**: Clicking and dragging on the grid background selects items within the box.
  - **Click Background**: Clears selection.

- **Navigation**:
  - **Double Click (Files)**: Opens preview/download.
  - **Double Click (Folders)**: Navigates into folder.
  - **History**: Browser Back/Forward buttons should work for folder navigation.

- **Context Menu**:
  - **Single Item**: Shows actions relevant to that item (Open, Rename, Delete, etc.).
  - **Multiple Items**: Shows bulk actions (Delete X items, Download as ZIP).

## Navigation Flow
1. User interacts with folder (Double click or Breadcrumb).
2. URL updates (optional, or internal store updates).
3. Store loads new directory content.
4. Breadcrumb updates to reflect new path.
5. Selection is cleared on navigation.

## Selection Flow
1. User clicks File A.
   - `selectedIds` = [A]
2. User Ctrl+Clicks File B.
   - `selectedIds` = [A, B]
3. User Shifts+Clicks File D (assuming order A, B, C, D).
   - `selectedIds` = [A, B, C, D] (Range logic depends on visual order).

## Test Flows

| Scenario | Input | Expected Result |
|----------|-------|-----------------|
| Navigate Breadcrumb | Click grandparent folder | View changes to grandparent, selection cleared |
| Multi-Select | Ctrl+Click 3 random files | 3 files selected, Context menu shows bulk options |
| Range Select | Click Index 1, Shift+Click Index 5 | Index 1, 2, 3, 4, 5 selected |
| Drag Select | Drag box over 4 items | 4 items selected |
| Context Menu (Multi) | Right-click selection of 3 files | "Delete (3)" option available |

## Definition of Done
- [ ] Breadcrumbs show correct path and are navigable.
- [ ] Browser Back/Forward buttons navigate folder history.
- [ ] Shift+Click and Ctrl+Click work as expected.
- [ ] Drag selection box works on FileGrid.
- [ ] Status bar shows count of selected items.
- [ ] Right-click menu adapts to single vs multi-selection.
