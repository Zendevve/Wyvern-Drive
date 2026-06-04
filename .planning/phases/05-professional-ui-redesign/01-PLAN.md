---
wave: 1
depends_on: []
requirements: [UI-04, UI-05]
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
    Edit `src/index.css` to add theme variables, custom typography, and atmospheric background layers per the UI-SPEC.md (Vault/Editorial aesthetic).

    1. **Import Fonts** at the top of the file:
       ```css
       @import url('https://api.fontshare.com/v2/css?f[]=clash-display@700,600&f[]=satoshi@400,500,700&display=swap');
       ```

    2. Define :root with variables:
       --background: #FAFAFA; /* Alabaster */
       --foreground: #0A0A0C; /* Deep Obsidian */
       --card: #F0F0F3; /* Porcelain */
       --card-hover: #E6E6E9;
       --border: rgba(10, 10, 12, 0.08);
       --text-muted: #6B6B70;
       --primary: #FF5A00; /* Signal Orange */
       --primary-hover: #E04E00;
       --destructive: #FF3366; /* Vermilion */
       --font-display: 'Clash Display', sans-serif;
       --font-body: 'Satoshi', sans-serif;
       
    3. Define .dark block with variables:
       --background: #0A0A0C; /* Deep Obsidian */
       --foreground: #FAFAFA; /* Alabaster */
       --card: #1C1C21; /* Gunmetal */
       --card-hover: #25252B;
       --border: rgba(255, 255, 255, 0.08);
       --text-muted: #A1A1AA;
       --primary: #FF5A00; /* Signal Orange */
       --primary-hover: #FF7A33;
       --destructive: #FF3366; /* Vermilion */
       
    4. Apply globally to body:
       font-family: var(--font-body);
       background-color: var(--background);
       color: var(--foreground);

    5. **Add atmospheric background layers** (apply to body or main wrapper):
       ```css
       background-image:
         radial-gradient(circle at 80% 10%, rgba(255, 90, 0, 0.05), transparent 50%),
         url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.02'/%3E%3C/svg%3E");
       ```

    6. Headings (h1, h2, h3) must use `font-family: var(--font-display); letter-spacing: -0.02em;`.
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
