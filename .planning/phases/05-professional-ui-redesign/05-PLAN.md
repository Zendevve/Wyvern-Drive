---
wave: 2
depends_on: [1, 3]
requirements: [UI-07]
files_modified:
  - src/App.tsx
  - src/components/FileDetailsDrawer.tsx
autonomous: true
---

# Plan 05: Collapsible Right-Side Details Drawer

**Objective:** Build and integrate a collapsible details drawer panel on the right side of the main application layout to render metadata, inline version history, and sharing details.

## Must Haves
- Sliding drawer panel (`w-80`) on the right side that opens when a file is selected and can be collapsed.
- Detailed file metadata display: Name, Type, Size, Created date, Webhook CDN link.
- Inline Version History list allowing restoration of older versions directly from the panel.
- Inline Sharing details allowing creation of password-protected links with custom expiries, clipboard copy controls, and revocation of existing shares.

## Tasks

<task id="create_details_drawer">
  <title>Create FileDetailsDrawer Component</title>
  <read_first>
    <file>src/components/ShareModal.tsx</file>
    <file>src/components/VersionHistory.tsx</file>
  </read_first>
  <acceptance_criteria>
    <criterion>File src/components/FileDetailsDrawer.tsx exists</criterion>
    <criterion>FileDetailsDrawer renders file name, size, type metadata</criterion>
    <criterion>FileDetailsDrawer contains inline version restoring controls</criterion>
    <criterion>FileDetailsDrawer contains sharing configuration inputs</criterion>
  </acceptance_criteria>
  <action>
    Create `src/components/FileDetailsDrawer.tsx` as a sliding sidebar panel component:
    1. Define `Props` taking the selected `file: FileRecord`, a `onClose: () => void` callback, and any other required properties.
    2. Render a clean visual header with file icon/thumbnail and detailed properties (Name, type, size, modified date).
    3. Port the logic from `ShareModal.tsx` to render inline password-protection inputs, expiry selectors, "Generate Link" actions, clipboard copy buttons, and existing shares list.
    4. Port the logic from `VersionHistory.tsx` to list versions and support restoring to older versions.
  </action>
</task>

<task id="integrate_drawer_to_app">
  <title>Integrate Details Drawer into App Layout</title>
  <read_first>
    <file>src/App.tsx</file>
  </read_first>
  <acceptance_criteria>
    <criterion>src/App.tsx renders FileDetailsDrawer on the right side of the main container</criterion>
    <criterion>Drawer is collapsible and transitions smoothly when opening or closing</criterion>
  </acceptance_criteria>
  <action>
    Modify `src/App.tsx` and files selection state:
    1. Track selected file state in `App.tsx` or a shared hook/store.
    2. Render `<FileDetailsDrawer file={selectedFile} onClose={() => setSelectedFile(null)} />` inside the collapsible right-side sidebar panel container.
    3. Ensure the drawer transitions open (`w-80` with background surface and borders) when `selectedFile` is present, and slides shut (`w-0 border-l-0`) when closed.
  </action>
</task>

## Verification
- Select a file in the file browser list/grid: verify the right details panel slides open.
- Verify metadata, version history list, and sharing options display correctly.
- Generate a share link inline: verify creation works and copy button copies link to clipboard.
- Click the close button: verify panel collapses smoothly.
