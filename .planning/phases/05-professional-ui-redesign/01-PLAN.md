---
wave: 1
depends_on: []
files_modified:
  - src/index.css
  - src/stores/theme-store.ts
  - src/App.tsx
autonomous: true
---

# Plan 01: Theme System & App Grid Shell

**Objective:** Set up the theme store, update `src/index.css` with semantic CSS variables for dark/light modes, and restructure `src/App.tsx` to implement a two-column sidebar layout and collateral pages (My Drive, Photos, Settings).

## Must Haves
- Theme toggles dynamically on the document element class (`dark` vs `light`).
- Responsive flexbox/grid layout containing collapsible sidebar, top bar, content viewport, and placeholder container for details panel.
- Sidebar contains navigation links (My Drive, Photos, Settings), active webhook status indicator, theme toggle switch, and database lock button.

## Tasks

<task id="create_theme_store">
  <title>Create Theme Store</title>
  <read_first>
    <file>src/stores/auth-store.ts</file>
  </read_first>
  <acceptance_criteria>
    <criterion>File src/stores/theme-store.ts exists</criterion>
    <criterion>src/stores/theme-store.ts contains 'createThemeStore' or 'useThemeStore'</criterion>
  </acceptance_criteria>
  <action>
    Create a new file `src/stores/theme-store.ts` with a Zustand store that manages theme state. It must load the theme from localStorage (defaulting to 'dark' or system preference), set the class '.dark' or '.light' on `document.documentElement` whenever the theme changes, and expose a `toggleTheme()` function.
  </action>
</task>

<task id="update_global_styles">
  <title>Update CSS Theme Variables</title>
  <read_first>
    <file>src/index.css</file>
  </read_first>
  <acceptance_criteria>
    <criterion>src/index.css contains ':root' variable definitions for light theme</criterion>
    <criterion>src/index.css contains '.dark' block with variables for dark theme</criterion>
  </acceptance_criteria>
  <action>
    Edit `src/index.css` to add theme variables.
    Define :root with variables:
    --background: #f4f4f5;
    --foreground: #09090b;
    --card: #ffffff;
    --card-hover: #fafafa;
    --border: #e4e4e7;
    --text-muted: #71717a;
    --primary: #5865F2;
    --primary-hover: #4752c4;
    
    Define .dark block with variables:
    --background: #09090b;
    --foreground: #f4f4f5;
    --card: #18181b;
    --card-hover: #27272a;
    --border: #27272a;
    --text-muted: #a1a1aa;
    
    Apply background-color: var(--background) and color: var(--foreground) globally to body.
  </action>
</task>

<task id="restructure_app_layout">
  <title>Restructure App Layout & Sidebar</title>
  <read_first>
    <file>src/App.tsx</file>
  </read_first>
  <acceptance_criteria>
    <criterion>src/App.tsx renders collapsible sidebar</criterion>
    <criterion>src/App.tsx renders page views conditionally based on state (drive, photos, settings)</criterion>
  </acceptance_criteria>
  <action>
    Restructure `src/App.tsx` main return block (when `isUnlocked` is true) to use the two-column sidebar layout.
    1. Render a left sidebar containing logo, navigation items (My Drive, Photos, Settings), active webhook status indicator (green/red indicator for validateWebhook), theme switcher, and a Lock button.
    2. Main area should contain a top header showing active breadcrumbs/view, search bar integration, and content section.
    3. Keep a conditional details-panel placeholder container on the right side.
    4. Render views conditionally based on the sidebar selected option ('drive' -> FileBrowser, 'photos' -> PhotoTimeline, 'settings' -> SettingsPanel).
    5. Clean up showSettings flag since SettingsPanel is now rendered in-content.
  </action>
</task>

## Verification
- Run local dev server: `npm run dev`
- Toggle theme: verify color themes switch correctly.
- Click sidebar links: verify views change without resetting page state.
