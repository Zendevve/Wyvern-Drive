---
wave: 2
depends_on: [1]
requirements: [UI-08]
files_modified:
  - src/components/AudioPlayer.tsx
autonomous: true
---

# Plan 04: Floating Glassmorphic Audio Player

**Objective:** Refactor `AudioPlayer.tsx` into a modern floating glassmorphic dock positioned at `bottom-6 right-6` with toggleable expanded and minimized states.

## Must Haves
- Floating positioning at `bottom-6 right-6` with proper z-index.
- Minimized mini-player capsule: displays small progress indication, track name, and play/pause controls.
- Expanded card player: displays volume slider, detailed seek timeline tracker, and standard play/pause/prev/next controls.
- Glassmorphic styling using backdrop blurs (`backdrop-blur-md bg-white/70 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800`).

## Tasks

<task id="audio_player_layout">
  <title>Refactor Player UI Layout & Modes</title>
  <read_first>
    <file>src/components/AudioPlayer.tsx</file>
  </read_first>
  <acceptance_criteria>
    <criterion>src/components/AudioPlayer.tsx imports useState for collapse/expansion control</criterion>
    <criterion>Floating wrapper positioned at bottom-6 right-6 with backdrop-blur classes</criterion>
  </acceptance_criteria>
  <action>
    Modify `src/components/AudioPlayer.tsx` to implement the new UI modes:
    1. Add `isExpanded` local state.
    2. Replace the full-width bottom bar layout with a fixed, absolute-positioned wrapper (`fixed bottom-6 right-6 z-50 transition-all duration-300`).
    3. Design Minimized Mini Capsule: A pill-shaped layout showing a play/pause toggle button, scrolling/truncated track name, and a maximize button.
    4. Design Expanded Card View: A card layout with cover image placeholder, seek timeline tracking slider, full controls (play, pause, next, volume bar), and a minimize button.
    5. Style both modes with rich glassmorphism: `backdrop-blur-md bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/50 dark:border-zinc-800/50 shadow-lg`.
  </action>
</task>

## Verification
- Load an audio track: verify the player displays at `bottom-6 right-6`.
- Toggle between minimized capsule and expanded card: verify play states and progress tracker sync accurately.
