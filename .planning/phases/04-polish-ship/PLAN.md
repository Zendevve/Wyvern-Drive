---
phase: 4
phase_name: "Polish & Ship"
wave: 1
depends_on: []
files_modified:
  - src/index.css
  - src/App.tsx
  - index.html
  - vite.config.ts
  - src/main.tsx
  - package.json
  - src/components/AudioPlayer.tsx
  - src/components/Breadcrumbs.tsx
  - src/components/DropZone.tsx
  - src/components/FileActions.tsx
  - src/components/FileBrowser.tsx
  - src/components/FileList.tsx
  - src/components/FolderActions.tsx
  - src/components/FolderTree.tsx
  - src/components/LightboxModal.tsx
  - src/components/MediaPreviewModal.tsx
  - src/components/PasswordModal.tsx
  - src/components/PhotoThumbnail.tsx
  - src/components/PhotoTimeline.tsx
  - src/components/SearchBar.tsx
  - src/components/SettingsPanel.tsx
  - src/components/ShareModal.tsx
  - src/components/Toast.tsx
  - src/components/UploadProgress.tsx
  - src/components/VersionHistory.tsx
  - public/manifest.json
  - public/sw.js
  - src/lib/crypto.test.ts
  - src/lib/discord.test.ts
  - src/lib/upload.test.ts
  - src/lib/sharing.test.ts
  - src/components/PasswordModal.test.tsx
  - src/components/Toast.test.tsx
  - src/stores/file-store.test.ts
  - tests/e2e/upload.spec.ts
  - tests/e2e/navigation.spec.ts
  - tests/e2e/share.spec.ts
  - playwright.config.ts
autonomous: false
---

# Phase 4: Polish & Ship — Implementation Plan

## Goal

Production-ready dark theme UI, full WCAG AA accessibility, PWA installability, and comprehensive test coverage (integration + E2E).

## Requirements

| ID | Description |
|----|-------------|
| UI-01 | Discord-inspired dark theme, fully responsive across all viewports |
| UI-02 | WCAG AA accessible, keyboard navigable, screen reader compatible |
| UI-03 | PWA ready — service worker, manifest, installable on mobile/desktop |
| TEST-01 | Integration tests with mocked Discord API (Vitest + React Testing Library) |
| TEST-02 | E2E tests with Playwright for core user journeys |

---

## Task 1: Dark Theme Tokens & Responsive Foundations

**Requirements:** UI-01

<read_first>
- src/index.css (current theme definition — already has blurple, dark-bg, darker-bg, discord-text, discord-muted)
- src/App.tsx (main layout — responsive structure)
- GEMINI.md (project stack: Tailwind CSS v4)
</read_first>

<action>
Extend `src/index.css` to add semantic color tokens for success, warning, error states and ensure the theme is complete for WCAG AA contrast:

1. Add these CSS custom properties inside `@theme {}` in `src/index.css`:
   ```
   --color-success: #3ba55d;
   --color-warning: #faa81a;
   --color-error: #ed4245;
   --color-info: #5865F2;
   --color-surface: #36393f;
   --color-surface-hover: #40444b;
   --color-border: #4f545c;
   --color-border-strong: #72767d;
   ```

2. Verify contrast ratios in `src/App.tsx` — the header uses `border-gray-700` which maps to `#374151`. Replace with `border-border` token. The main text uses `text-discord-text` (#dcddde) on `bg-darker-bg` (#23272A) — contrast ratio ~13.5:1, passes WCAG AAA. No change needed.

3. In `src/components/Toast.tsx`, update variant styles to use semantic tokens:
   - `success` variant: use `bg-green-900/50 border-success` instead of `border-green-600`
   - `error` variant: use `bg-red-900/50 border-error` instead of `border-red-600`

4. In `src/App.tsx`:
   - Wrap `<main>` with responsive padding: `p-4 sm:p-6 lg:p-8`
   - Header: `p-4 sm:p-6` and `text-xl sm:text-2xl`
   - Add `<meta name="theme-color" content="#23272A">` via `index.html`

5. Add responsive base styles to `src/index.css` inside `@layer base`:
   ```css
   html {
     font-size: 16px;
   }
   @media (max-width: 640px) {
     html {
       font-size: 14px;
     }
   }
   ```
</action>

<acceptance_criteria>
- `src/index.css` contains `--color-success`, `--color-warning`, `--color-error`, `--color-surface`, `--color-surface-hover`, `--color-border`, `--color-border-strong`
- `src/App.tsx` contains `p-4 sm:p-6 lg:p-8` on `<main>`
- `src/App.tsx` contains `text-xl sm:text-2xl` on the header h1
- `src/components/Toast.tsx` contains `border-success` and `border-error`
- `index.html` contains `<meta name="theme-color" content="#23272A">`
</acceptance_criteria>

---

## Task 2: Responsive Layout Pass on All Components

**Requirements:** UI-01

<read_first>
- src/App.tsx (main layout)
- src/components/FileBrowser.tsx (file browser layout)
- src/components/DropZone.tsx (upload zone)
- src/components/SettingsPanel.tsx (settings form)
- src/components/AudioPlayer.tsx (bottom player)
- src/components/SearchBar.tsx (search controls)
- src/components/PhotoTimeline.tsx (photo grid)
- src/components/MediaPreviewModal.tsx (media modal)
- src/components/ShareModal.tsx (share dialog)
- src/components/FileActions.tsx (file action buttons)
- src/components/FolderTree.tsx (sidebar tree)
</read_first>

<action>
Apply responsive Tailwind classes to ensure mobile-first layouts across all components. Specific changes:

1. **src/components/FileBrowser.tsx**: Add `flex flex-col sm:flex-row` if it has a sidebar+content layout. Ensure file list uses `text-sm sm:text-base`. Check for horizontal overflow on mobile — add `overflow-x-auto` if needed.

2. **src/components/DropZone.tsx**: Ensure the drop zone is visible on all viewports. Use `min-h-[120px] sm:min-h-[160px]` and `p-4 sm:p-6` padding. Text: `text-sm sm:text-base`.

3. **src/components/SettingsPanel.tsx**: Form inputs should be full-width on mobile. Use `grid grid-cols-1 sm:grid-cols-2 gap-4` for multi-column settings. Button groups: `flex flex-col sm:flex-row gap-2`.

4. **src/components/AudioPlayer.tsx**: Fixed bottom bar. Ensure it works on mobile — use `h-16 sm:h-20`, progress bar visible on all sizes, controls touch-friendly (`min-h-[44px]`).

5. **src/components/SearchBar.tsx**: Inputs should stack on mobile: `flex flex-col sm:flex-row gap-2`. Dropdowns use full width on mobile.

6. **src/components/PhotoTimeline.tsx**: Grid columns responsive: `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3`.

7. **src/components/MediaPreviewModal.tsx**: Modal should be nearly full-screen on mobile: `w-[95vw] h-[90vh] sm:w-[80vw] sm:h-[80vh]`. Close button touch target `min-w-[44px] min-h-[44px]`.

8. **src/components/ShareModal.tsx**: Dialog responsive: `w-[90vw] max-w-md`. Input and buttons full-width on mobile.

9. **src/components/FileActions.tsx**: Action buttons use `flex flex-wrap gap-1 sm:gap-2` and icon+text on desktop, icon-only on mobile (hide text with `hidden sm:inline`).

10. **src/components/FolderTree.tsx**: If sidebar, ensure it collapses or becomes a drawer on mobile. Use `hidden sm:block` or a toggle pattern.
</action>

<acceptance_criteria>
- `src/components/DropZone.tsx` contains `min-h-[120px] sm:min-h-[160px]`
- `src/components/PhotoTimeline.tsx` contains `grid-cols-2 sm:grid-cols-3 md:grid-cols-4`
- `src/components/AudioPlayer.tsx` contains `min-h-[44px]` or equivalent touch target sizing
- `src/components/MediaPreviewModal.tsx` contains `w-[95vw] sm:w-[80vw]` or similar responsive sizing
- `src/components/SettingsPanel.tsx` contains `grid-cols-1 sm:grid-cols-2` or equivalent responsive layout
</acceptance_criteria>

---

## Task 3: Keyboard Navigation & Focus Management (UI-02)

**Requirements:** UI-02

<read_first>
- src/App.tsx (skip-to-content target, tab order)
- src/components/PasswordModal.tsx (Radix Dialog — already has focus management)
- src/components/FileActions.tsx (action buttons)
- src/components/FileList.tsx (file list items)
- src/components/FolderTree.tsx (folder tree items)
- src/components/AudioPlayer.tsx (player controls)
- src/components/SearchBar.tsx (search inputs)
- src/components/Toast.tsx (toast notifications)
- src/index.css (will add focus-visible styles)
</read_first>

<action>
Add keyboard accessibility across the app:

1. **Skip-to-content link in src/App.tsx**: Add a visually-hidden skip link before the header:
   ```tsx
   <a
     href="#main-content"
     className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-blurple focus:text-white focus:px-4 focus:py-2 focus:rounded"
   >
     Skip to content
   </a>
   ```
   Add `id="main-content"` to the `<main>` element.

2. **Global focus-visible ring in src/index.css**: Add inside `@layer base`:
   ```css
   *:focus-visible {
     outline: 2px solid #5865F2;
     outline-offset: 2px;
   }
   ```

3. **src/components/FileActions.tsx**: Ensure all buttons have `tabIndex={0}` and are actual `<button>` elements (not `<div onClick>`). Add `aria-label` to icon-only buttons.

4. **src/components/FileList.tsx**: File items should be focusable — use `tabIndex={0}` on file rows. Add `role="button"` and `onKeyDown` handler for Enter/Space activation. Add `aria-label` like `"Open {file.name}"`.

5. **src/components/FolderTree.tsx**: Folder items: `tabIndex={0}`, `role="treeitem"`, `aria-expanded={isOpen}`. Parent tree: `role="tree"`. Add `aria-label` to each folder.

6. **src/components/AudioPlayer.tsx**: Play/pause, next, previous buttons need `aria-label` ("Play", "Pause", "Next track", "Previous track"). Progress bar: `role="slider"`, `aria-valuemin={0}`, `aria-valuemax={100}`, `aria-valuenow={progress}`.

7. **src/components/SearchBar.tsx**: Search input needs `aria-label="Search files"`. Filter dropdowns need `aria-label` for each.

8. **src/components/Toast.tsx**: Toast container: `role="status"`, `aria-live="polite"`. Individual toasts: `role="alert"`.

9. **src/components/DropZone.tsx**: Add `role="button"`, `tabIndex={0}`, `aria-label="Upload files by clicking or dropping files here"`. Add `onKeyDown` for Enter/Space to trigger file picker.

10. **Modal components (PasswordModal.tsx, ShareModal.tsx, MediaPreviewModal.tsx, LightboxModal.tsx)**: Radix Dialog handles focus trapping. Verify each has `aria-label` or `aria-labelledby` on Dialog.Content. PasswordModal already has Dialog.Title. Check others.
</action>

<acceptance_criteria>
- `src/App.tsx` contains `id="main-content"` and a skip link with `href="#main-content"`
- `src/index.css` contains `*:focus-visible` with `outline: 2px solid #5865F2`
- `src/components/FileList.tsx` contains `tabIndex={0}` and `role="button"` on file items
- `src/components/FolderTree.tsx` contains `role="tree"` and `role="treeitem"`
- `src/components/AudioPlayer.tsx` contains `aria-label="Play"` or `aria-label="Pause"`
- `src/components/DropZone.tsx` contains `role="button"` and `aria-label`
- `src/components/Toast.tsx` contains `role="status"` and `aria-live="polite"`
</acceptance_criteria>

---

## Task 4: Screen Reader & ARIA Labels (UI-02)

**Requirements:** UI-02

<read_first>
- src/components/FileActions.tsx (icon buttons)
- src/components/FolderActions.tsx (icon buttons)
- src/components/Breadcrumbs.tsx (navigation)
- src/components/UploadProgress.tsx (progress indicators)
- src/components/VersionHistory.tsx (version list)
- src/components/PhotoThumbnail.tsx (image thumbnails)
- src/App.tsx (landmark regions)
</read_first>

<action>
Complete ARIA labeling and landmark structure:

1. **src/App.tsx**: Wrap header in `<header role="banner">`. Wrap main in `<main id="main-content" role="main">`. Add `aria-label="Wyvern Drive"` to header.

2. **src/components/Breadcrumbs.tsx**: Nav element should have `aria-label="Breadcrumb"`. Use `<ol>` with `<li>` items. Current item: `aria-current="page"`. Separator links: `aria-hidden="true"`.

3. **src/components/FileActions.tsx**: Every icon-only button needs `aria-label`. E.g., `aria-label="Download"`, `aria-label="Share"`, `aria-label="Delete"`, `aria-label="Rename"`, `aria-label="Move"`, `aria-label="Version history"`.

4. **src/components/FolderActions.tsx**: Same pattern — `aria-label="New folder"`, `aria-label="Rename folder"`, `aria-label="Delete folder"`.

5. **src/components/UploadProgress.tsx**: Progress bars: `role="progressbar"`, `aria-valuemin={0}`, `aria-valuemax={100}`, `aria-valuenow={percent}`, `aria-label="Upload progress for {filename}"`.

6. **src/components/VersionHistory.tsx**: List: `role="list"`. Each item: `role="listitem"`. Add `aria-label` for version entries like `"Version {n} — {date} — {size}"`.

7. **src/components/PhotoThumbnail.tsx**: Images: `alt="{filename}"`. Container: `role="button"`, `tabIndex={0}`, `aria-label="View {filename}"`.

8. **src/components/SettingsPanel.tsx**: Group related inputs with `<fieldset>` and `<legend>`. Each input needs a `<label>` with matching `htmlFor`.

9. **src/components/SearchBar.tsx**: Add `aria-label="Search files"` on the search input. Filter selects: `<label>` elements with `htmlFor`.
</action>

<acceptance_criteria>
- `src/components/FileActions.tsx` contains `aria-label="Download"` and `aria-label="Share"` and `aria-label="Delete"`
- `src/components/Breadcrumbs.tsx` contains `aria-label="Breadcrumb"` and `aria-current="page"`
- `src/components/UploadProgress.tsx` contains `role="progressbar"` and `aria-valuemin`
- `src/components/PhotoThumbnail.tsx` contains `alt=` and `aria-label="View`
- `src/components/SettingsPanel.tsx` contains `<fieldset>` and `<legend>`
</acceptance_criteria>

---

## Task 5: PWA Manifest & Service Worker (UI-03)

**Requirements:** UI-03

<read_first>
- index.html (current meta tags, script tag)
- vite.config.ts (current plugins — react + tailwindcss)
- package.json (dependencies — no PWA plugin yet)
- public/ (check for existing assets)
- GEMINI.md (confirms PWA requirement)
</read_first>

<action>
Set up PWA infrastructure:

1. **Create `public/manifest.json`**:
   ```json
   {
     "name": "Wyvern Drive",
     "short_name": "Wyvern Drive",
     "description": "Secure Discord-powered cloud storage",
     "start_url": "/",
     "display": "standalone",
     "background_color": "#23272A",
     "theme_color": "#23272A",
     "icons": [
       {
         "src": "/vite.svg",
         "sizes": "any",
         "type": "image/svg+xml"
       }
     ]
   }
   ```

2. **Create `public/sw.js`** (manual service worker — avoids vite-plugin-pwa dependency):
   ```js
   const CACHE_NAME = 'wyvern-drive-v1';
   const STATIC_ASSETS = ['/', '/index.html'];

   self.addEventListener('install', (event) => {
     event.waitUntil(
       caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
     );
     self.skipWaiting();
   });

   self.addEventListener('activate', (event) => {
     event.waitUntil(
       caches.keys().then((keys) =>
         Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
       )
     );
     self.clients.claim();
   });

   self.addEventListener('fetch', (event) => {
     const { request } = event;
     if (request.url.includes('discord.com') || request.url.includes('discordapp.com')) {
       event.respondWith(fetch(request));
       return;
     }
     event.respondWith(
       caches.match(request).then((cached) => cached || fetch(request))
     );
   });
   ```

3. **Update `index.html`**: Add manifest link and PWA meta tags:
   ```html
   <link rel="manifest" href="/manifest.json" />
   <meta name="theme-color" content="#23272A" />
   <meta name="description" content="Secure Discord-powered cloud storage" />
   <link rel="apple-touch-icon" href="/vite.svg" />
   ```

4. **Update `src/main.tsx`**: Register service worker at the end:
   ```ts
   if ('serviceWorker' in navigator) {
     window.addEventListener('load', () => {
       navigator.serviceWorker.register('/sw.js');
     });
   }
   ```

5. **Install vite-plugin-pwa as devDependency**: Actually, skip this — the manual `public/sw.js` approach is simpler and avoids a dependency. The manual SW above handles cache-first for static assets and network-first for Discord API calls.
</action>

<acceptance_criteria>
- `public/manifest.json` exists and contains `"name": "Wyvern Drive"`, `"display": "standalone"`, `"theme_color": "#23272A"`
- `public/sw.js` exists and contains `const CACHE_NAME = 'wyvern-drive-v1'`
- `public/sw.js` contains `self.addEventListener('install'` and `self.addEventListener('fetch'`
- `index.html` contains `<link rel="manifest" href="/manifest.json">`
- `index.html` contains `<meta name="theme-color" content="#23272A">`
- `src/main.tsx` contains `navigator.serviceWorker.register`
</acceptance_criteria>

---

## Task 6: Test Infrastructure Setup

**Requirements:** TEST-01, TEST-02

<read_first>
- package.json (current dependencies — no vitest, no playwright, no testing-library)
- tsconfig.json (TypeScript config)
- vite.config.ts (build config — needs vitest config)
- GEMINI.md (mentions `npm run test` and `npm run test:e2e`)
</read_first>

<action>
Set up test infrastructure:

1. **Install dev dependencies** (run in project root):
   ```bash
   npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom msw @playwright/test
   ```

2. **Create `vitest.config.ts`** in project root:
   ```ts
   import { defineConfig } from 'vitest/config';
   import react from '@vitejs/plugin-react';

   export default defineConfig({
     plugins: [react()],
     test: {
       environment: 'jsdom',
       globals: true,
       setupFiles: ['./tests/setup.ts'],
       css: true,
     },
   });
   ```

3. **Create `tests/setup.ts`**:
   ```ts
   import '@testing-library/jest-dom/vitest';
   ```

4. **Update `package.json` scripts**:
   ```json
   "scripts": {
     "dev": "vite",
     "build": "tsc && vite build",
     "preview": "vite preview",
     "test": "vitest run",
     "test:watch": "vitest",
     "test:e2e": "playwright test"
   }
   ```

5. **Create `playwright.config.ts`**:
   ```ts
   import { defineConfig } from '@playwright/test';

   export default defineConfig({
     testDir: './tests/e2e',
     fullyParallel: true,
     forbidOnly: !!process.env.CI,
     retries: process.env.CI ? 2 : 0,
     workers: process.env.CI ? 1 : undefined,
     reporter: 'html',
     use: {
       baseURL: 'http://localhost:5173',
       trace: 'on-first-retry',
     },
     webServer: {
       command: 'npm run dev',
       url: 'http://localhost:5173',
       reuseExistingServer: !process.env.CI,
     },
     projects: [
       { name: 'chromium', use: { browserName: 'chromium' } },
     ],
   });
   ```

6. **Create `tests/e2e/` directory**.
</action>

<acceptance_criteria>
- `vitest.config.ts` exists and contains `environment: 'jsdom'`
- `tests/setup.ts` exists and contains `@testing-library/jest-dom/vitest`
- `playwright.config.ts` exists and contains `testDir: './tests/e2e'`
- `package.json` contains `"test": "vitest run"` and `"test:e2e": "playwright test"`
- `package.json` devDependencies contains `vitest` and `@playwright/test`
</acceptance_criteria>

---

## Task 7: Integration Tests — Crypto & Discord (TEST-01)

**Requirements:** TEST-01

<read_first>
- src/lib/crypto.ts (encryption functions — uses Web Crypto API + worker)
- src/lib/discord.ts (Discord API calls — upload, fetch, refresh)
- src/lib/rate-limiter.ts (rate limit handling)
- src/lib/upload.ts (upload orchestration)
- src/lib/sharing.ts (share link generation/verification)
- tests/setup.ts (created in Task 6)
</read_first>

<action>
Write integration tests for crypto, discord, upload, and sharing modules. Since crypto.ts uses a Worker, tests will mock the worker. Discord tests will use MSW to mock the API.

1. **Create `src/lib/crypto.test.ts`**:
   ```ts
   import { describe, it, expect, vi, beforeEach } from 'vitest';
   import { generateSalt, generateNonce, hashFile } from './crypto';

   describe('crypto', () => {
     it('generateSalt returns 16-byte Uint8Array', () => {
       const salt = generateSalt();
       expect(salt).toBeInstanceOf(Uint8Array);
       expect(salt.length).toBe(16);
     });

     it('generateNonce returns 12-byte Uint8Array', () => {
       const nonce = generateNonce();
       expect(nonce).toBeInstanceOf(Uint8Array);
       expect(nonce.length).toBe(12);
     });

     it('hashFile returns hex string', async () => {
       const data = new TextEncoder().encode('test').buffer;
       const hash = await hashFile(data);
       expect(hash).toMatch(/^[a-f0-9]{64}$/);
     });

     it('hashFile produces consistent results', async () => {
       const data = new TextEncoder().encode('consistent').buffer;
       const hash1 = await hashFile(data);
       const hash2 = await hashFile(data);
       expect(hash1).toBe(hash2);
     });
   });
   ```

2. **Create `src/lib/discord.test.ts`**:
   ```ts
   import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
   import { http, HttpResponse } from 'msw';
   import { setupServer } from 'msw/node';
   import { validateWebhook, uploadChunk, fetchMessage, refreshCdnUrl, isCdnExpired } from './discord';

   const server = setupServer(
     http.post('https://discord.com/api/v10/webhooks/:id/:token', () => {
       return HttpResponse.json({ id: 'msg-1', channel_id: 'ch-1', content: '', attachments: [] });
     }),
     http.get('https://discord.com/api/v10/webhooks/:id/:token/messages/:msgId', () => {
       return HttpResponse.json({
         id: 'msg-1',
         channel_id: 'ch-1',
         content: '',
         attachments: [{ id: 'att-1', filename: 'chunk_0.bin', size: 1024, url: 'https://cdn.discordapp.com/attachments/test?ex=ffffffff', content_type: 'application/octet-stream' }],
       });
     })
   );

   beforeAll(() => server.listen());
   afterEach(() => server.resetHandlers());
   afterAll(() => server.close());

   describe('discord', () => {
     it('validateWebhook returns true for valid webhook', async () => {
       const result = await validateWebhook('https://discord.com/api/v10/webhooks/123/token');
       expect(result).toBe(true);
     });

     it('isCdnExpired returns false for non-expired URL', () => {
       const futureHex = Math.floor(Date.now() / 1000 + 3600).toString(16);
       expect(isCdnExpired(`https://cdn.discordapp.com/test?ex=${futureHex}`)).toBe(false);
     });

     it('isCdnExpired returns true for expired URL', () => {
       const pastHex = Math.floor(Date.now() / 1000 - 3600).toString(16);
       expect(isCdnExpired(`https://cdn.discordapp.com/test?ex=${pastHex}`)).toBe(true);
     });

     it('fetchMessage returns message data', async () => {
       const msg = await fetchMessage('https://discord.com/api/v10/webhooks/123/token', 'msg-1');
       expect(msg.id).toBe('msg-1');
       expect(msg.attachments).toHaveLength(1);
     });

     it('refreshCdnUrl returns attachment URL', async () => {
       const url = await refreshCdnUrl('https://discord.com/api/v10/webhooks/123/token', 'msg-1');
       expect(url).toContain('cdn.discordapp.com');
     });
   });
   ```

3. **Create `src/lib/upload.test.ts`** — test upload orchestration with mocked discord module.

4. **Create `src/lib/sharing.test.ts`** — test share link generation and verification with crypto mocked.
</action>

<acceptance_criteria>
- `src/lib/crypto.test.ts` exists and contains `describe('crypto'`
- `src/lib/crypto.test.ts` contains `expect(salt.length).toBe(16)` and `expect(nonce.length).toBe(12)`
- `src/lib/discord.test.ts` exists and contains `describe('discord'`
- `src/lib/discord.test.ts` contains `setupServer` and `validateWebhook`
- `src/lib/discord.test.ts` contains `isCdnExpired` tests
- `npm run test` exits 0 (all tests pass)
</acceptance_criteria>

---

## Task 8: Integration Tests — Stores & Components (TEST-01)

**Requirements:** TEST-01

<read_first>
- src/stores/file-store.ts (Zustand store — file management)
- src/stores/auth-store.ts (authentication/encryption key)
- src/components/Toast.tsx (toast notifications)
- src/components/PasswordModal.tsx (password dialog)
- src/components/DropZone.tsx (upload drop zone)
- tests/setup.ts (created in Task 6)
</read_first>

<action>
Write tests for stores and React components:

1. **Create `src/stores/file-store.test.ts`**:
   ```ts
   import { describe, it, expect, beforeEach, vi } from 'vitest';
   import { useFileStore, setWebhookUrl, getWebhookUrl } from './file-store';

   describe('file-store', () => {
     beforeEach(() => {
       localStorage.clear();
       useFileStore.setState({ files: [], currentFolderId: null, isLoading: false });
     });

     it('setWebhookUrl stores in localStorage', () => {
       setWebhookUrl('https://discord.com/api/webhooks/123/abc');
       expect(getWebhookUrl()).toBe('https://discord.com/api/webhooks/123/abc');
     });

     it('getWebhookUrl returns null when not set', () => {
       expect(getWebhookUrl()).toBeNull();
     });

     it('setCurrentFolder updates state', () => {
       useFileStore.getState().setCurrentFolder('folder-123');
       expect(useFileStore.getState().currentFolderId).toBe('folder-123');
     });
   });
   ```

2. **Create `src/components/Toast.test.tsx`**:
   ```tsx
   import { describe, it, expect, vi } from 'vitest';
   import { render, screen, act } from '@testing-library/react';
   import { ToastProvider, useToast } from './Toast';

   function TestComponent() {
     const { toast } = useToast();
     return <button onClick={() => toast({ title: 'Test toast', variant: 'default' })}>Show Toast</button>;
   }

   describe('Toast', () => {
     it('renders toast when triggered', async () => {
       render(
         <ToastProvider>
           <TestComponent />
         </ToastProvider>
       );
       await act(async () => {
         screen.getByText('Show Toast').click();
       });
       expect(screen.getByText('Test toast')).toBeDefined();
     });
   });
   ```

3. **Create `src/components/PasswordModal.test.tsx`** — test form validation, submit behavior.
4. **Create `src/components/DropZone.test.tsx`** — test drop zone renders with correct aria attributes.
</action>

<acceptance_criteria>
- `src/stores/file-store.test.ts` exists and contains `describe('file-store'`
- `src/components/Toast.test.tsx` exists and contains `ToastProvider`
- `npm run test` exits 0
</acceptance_criteria>

---

## Task 9: E2E Tests — Core User Journeys (TEST-02)

**Requirements:** TEST-02

<read_first>
- playwright.config.ts (created in Task 6)
- src/App.tsx (main app structure — password modal, file browser, settings)
- src/components/PasswordModal.tsx (unlock flow)
- src/components/SettingsPanel.tsx (webhook configuration)
- src/components/DropZone.tsx (file upload)
- src/components/FileBrowser.tsx (file listing)
- tests/e2e/ (directory created in Task 6)
</read_first>

<action>
Write Playwright E2E tests for core user journeys. Since the app requires Discord webhooks, E2E tests will focus on UI flows that don't require live API calls.

1. **Create `tests/e2e/navigation.spec.ts`**:
   ```ts
   import { test, expect } from '@playwright/test';

   test.describe('App loads', () => {
     test('shows password modal on first visit', async ({ page }) => {
       await page.goto('/');
       await expect(page.getByText('Unlock Wyvern Drive')).toBeVisible();
       await expect(page.getByPlaceholder('Encryption password')).toBeVisible();
     });

     test('has correct page title', async ({ page }) => {
       await page.goto('/');
       await expect(page).toHaveTitle('Wyvern Drive');
     });

     test('password input has correct type', async ({ page }) => {
       await page.goto('/');
       const input = page.getByPlaceholder('Encryption password');
       await expect(input).toHaveAttribute('type', 'password');
     });
   });
   ```

2. **Create `tests/e2e/upload.spec.ts`**:
   ```ts
   import { test, expect } from '@playwright/test';

   test.describe('File upload flow', () => {
     test('drop zone is visible after unlock', async ({ page }) => {
       // Note: This test requires unlocking the app first
       // For E2E, we mock the auth state via localStorage
       await page.goto('/');
       
       // Set up unlocked state
       await page.evaluate(() => {
         localStorage.setItem('wyvern-unlocked', 'true');
       });
       await page.reload();
       
       // Drop zone should be visible
       await expect(page.getByText(/drop|upload/i).first()).toBeVisible();
     });
   });
   ```

3. **Create `tests/e2e/share.spec.ts`**:
   ```ts
   import { test, expect } from '@playwright/test';

   test.describe('Share link page', () => {
     test('shows error for invalid share link', async ({ page }) => {
       await page.goto('/share/invalid');
       await expect(page.getByText('Error')).toBeVisible();
     });
   });
   ```

4. **Install Playwright browsers**: Run `npx playwright install chromium` (only Chromium needed per config).
</action>

<acceptance_criteria>
- `tests/e2e/navigation.spec.ts` exists and contains `test.describe('App loads'`
- `tests/e2e/navigation.spec.ts` contains `expect(page).toHaveTitle('Wyvern Drive')`
- `tests/e2e/upload.spec.ts` exists and contains `test.describe('File upload flow'`
- `tests/e2e/share.spec.ts` exists and contains `test.describe('Share link page'`
- `npx playwright test --list` shows all test cases
</acceptance_criteria>

---

## Task 10: Final Verification & Build Check

**Requirements:** UI-01, UI-02, UI-03, TEST-01, TEST-02

<read_first>
- package.json (scripts and dependencies)
- tsconfig.json (TypeScript config)
- vite.config.ts (build config)
</read_first>

<action>
Run final verification:

1. **TypeScript check**: Run `npx tsc --noEmit` — must exit 0.
2. **Unit/integration tests**: Run `npm run test` — must exit 0.
3. **Build**: Run `npm run build` — must exit 0.
4. **Verify PWA artifacts exist**: `public/manifest.json` and `public/sw.js` must exist.
5. **Verify test files exist**: All `*.test.ts` and `*.test.tsx` files created in Tasks 7-8, all `*.spec.ts` files created in Task 9.
</action>

<acceptance_criteria>
- `npx tsc --noEmit` exits 0
- `npm run test` exits 0
- `npm run build` exits 0
- `public/manifest.json` file exists
- `public/sw.js` file exists
- At least 8 test files exist matching `**/*.test.{ts,tsx}` or `**/*.spec.ts`
</acceptance_criteria>

---

## Verification Criteria

1. **UI-01**: Dark theme responsive — `src/index.css` has semantic tokens, all components have responsive Tailwind classes, `index.html` has theme-color meta
2. **UI-02**: Accessible — skip link present, focus-visible styles, all interactive elements have `aria-label`, progress bars have `role="progressbar"`, tree items have `role="treeitem"`
3. **UI-03**: PWA — `public/manifest.json` with standalone display, `public/sw.js` with cache strategy, `index.html` links manifest, `src/main.tsx` registers service worker
4. **TEST-01**: Integration tests pass — `npm run test` exits 0 with tests covering crypto, discord, stores, and components
5. **TEST-02**: E2E tests defined — Playwright config exists, `tests/e2e/` has spec files for navigation, upload, and share flows

## must_haves

- [ ] `src/index.css` contains all semantic color tokens (success, warning, error, surface, border)
- [ ] Skip-to-content link in `src/App.tsx` with `href="#main-content"`
- [ ] `*:focus-visible` outline style in `src/index.css`
- [ ] All icon-only buttons have `aria-label` attributes
- [ ] `public/manifest.json` with `"display": "standalone"` and `"theme_color": "#23272A"`
- [ ] `public/sw.js` with install/fetch event handlers
- [ ] `src/main.tsx` registers service worker
- [ ] `vitest.config.ts` with `environment: 'jsdom'`
- [ ] `playwright.config.ts` with Chromium project
- [ ] `npm run test` exits 0
- [ ] `npm run build` exits 0
- [ ] All responsive breakpoints applied (mobile < 640px, tablet 640-1024px, desktop > 1024px)
