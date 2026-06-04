---
wave: 1
depends_on: [1]
files_modified:
  - src/components/DropZone.tsx
autonomous: true
---

# Plan 02: Fullscreen Upload DropZone Overlay

**Objective:** Refactor `DropZone.tsx` from a static card block to a global fullscreen drag-and-drop overlay.

## Must Haves
- Global window-level drag-and-drop event listeners.
- Render a fullscreen blurred glassmorphic overlay with a central dashed zone when files are dragged anywhere on the window.
- The input element for clicking to browse files should be integrated into the navigation actions (such as header or sidebar "Upload Files" button) using a shared trigger or file input mechanism.
- Trigger file parsing, chunk encryption, and Discord CDN upload upon file drop.

## Tasks

<task id="window_drag_listeners">
  <title>Window Drag Event Listeners</title>
  <read_first>
    <file>src/components/DropZone.tsx</file>
  </read_first>
  <acceptance_criteria>
    <criterion>src/components/DropZone.tsx uses useEffect to bind event listeners to window</criterion>
    <criterion>src/components/DropZone.tsx exposes an invisible file input element and a globally accessible browse trigger</criterion>
  </acceptance_criteria>
  <action>
    Modify `DropZone.tsx` to handle window-level drag events:
    1. Maintain `isDragging` state. Keep track of drag counter (`dragCounterRef.current`) to handle child elements dragenter/dragleave accurately.
    2. Add `dragenter`, `dragover`, `dragleave`, and `drop` event listeners to `window` inside a `useEffect` hook.
    3. Ensure event listeners call `preventDefault()` and update the dragging state appropriately.
    4. Implement clean-up functions for window listeners in the useEffect return.
  </action>
</task>

<task id="render_drag_overlay">
  <title>Render Blurred Fullscreen Drag Overlay</title>
  <read_first>
    <file>src/components/DropZone.tsx</file>
  </read_first>
  <acceptance_criteria>
    <criterion>src/components/DropZone.tsx renders a fixed fullscreen div when isDragging is true</criterion>
    <criterion>Overlay features glassmorphic background blur and dashed target box</criterion>
  </acceptance_criteria>
  <action>
    Modify the render markup of `DropZone.tsx`:
    1. If `isDragging` is true, render a fixed overlay covering the entire screen (`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md pointer-events-none`).
    2. Inside the overlay, render a dashed boundary box (`border-4 border-dashed border-primary rounded-2xl p-8 max-w-lg text-center`) containing an upload icon and title "Drop Files Anywhere to Encrypt and Upload".
    3. Expose a global mechanism or window event trigger `window.dispatchEvent(new CustomEvent('trigger-file-browse'))` so that sidebar/header "Upload Files" buttons can programmatically click the hidden `<input type="file" />` within DropZone.
  </action>
</task>

## Verification
- Drag a file over the browser window: verify the fullscreen blurred drop overlay displays immediately.
- Move cursor away or drag out: verify the overlay disappears.
- Drop the file: verify the overlay closes and the upload progress state begins.
