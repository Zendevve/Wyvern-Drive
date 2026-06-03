# Phase 4: Polish & Ship - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase makes the app production-ready: dark theme polish across all viewports, WCAG AA accessibility, PWA installability via service worker + manifest, and comprehensive test coverage (integration + E2E).

</domain>

<decisions>
## Implementation Decisions

### Dark Theme
- Extend existing Tailwind theme (blurple, dark-bg, darker-bg already defined)
- Add semantic color tokens for success, warning, error states
- Ensure contrast ratios meet WCAG AA (4.5:1 for text, 3:1 for large text)
- Responsive breakpoints: mobile (< 640px), tablet (640-1024px), desktop (> 1024px)

### Accessibility
- WCAG AA target level (not AAA — practical balance)
- All interactive elements keyboard navigable (tab order, focus rings)
- Screen reader labels via aria-label and aria-labelledby
- Focus management for modals (Radix Dialog handles this)
- Skip-to-content link for keyboard users

### PWA
- Basic installability: service worker + web manifest
- Cache-first strategy for static assets (CSS, JS, images)
- Network-first for API calls (Discord webhooks)
- No offline file access (files require Discord CDN)
- Manifest: name, icons, theme_color, background_color, display: standalone

### Testing
- Integration tests: Vitest + React Testing Library (mock Discord API)
- E2E tests: Playwright (core user journeys)
- Test files co-located with source (*.test.ts, *.test.tsx)
- Coverage targets: 80%+ for critical paths (upload, download, encryption, sharing)

### the agent's Discretion
- All remaining implementation choices at the agent's discretion

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/index.css` — Tailwind theme with blurple, dark-bg, darker-bg, discord-text, discord-muted
- `src/App.tsx` — Main layout with header, main content, AudioPlayer
- `src/components/` — All UI components (FileList, FileActions, MediaPreviewModal, etc.)
- `src/stores/` — Zustand stores (auth, file, folder, audio, share, search)

### Established Patterns
- Tailwind CSS v4 for styling
- Radix UI for accessible modals/dialogs
- Zustand for state management
- Vite for build tooling
- TypeScript strict mode

### Integration Points
- `index.html` — needs manifest link and meta tags
- `vite.config.ts` — may need PWA plugin configuration
- `src/main.tsx` — service worker registration
- All components — accessibility audit targets

</code_context>

<specifics>
## Specific Ideas

- Dark theme already partially implemented (Discord-inspired colors)
- Focus visible rings using Tailwind's focus-visible:ring
- Service worker via vite-plugin-pwa or manual implementation
- Playwright config for Chromium, Firefox, WebKit
- Vitest config for unit/integration tests

</specifics>

<deferred>
## Deferred Ideas

- Advanced PWA features (push notifications, background sync) — v2
- Visual regression testing — v2
- Performance monitoring — v2

</deferred>
