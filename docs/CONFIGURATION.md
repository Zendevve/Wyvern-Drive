# Configuration

## Environment Variables

Wyvern Drive is a static SPA — there are **no required environment variables** at build time. The Discord webhook URL is configured at runtime through the Settings panel and stored in IndexedDB.

If you want to pre-bake a default webhook (e.g. for a demo deployment), create a `.env` file:

```bash
# .env (optional, Vite reads VITE_ prefixed vars)
VITE_DEFAULT_WEBHOOK_URL=https://discord.com/api/webhooks/your-webhook-id/your-webhook-token
```

Read with `import.meta.env.VITE_DEFAULT_WEBHOOK_URL` in client code.

---

## Theme Tokens

All theme values are CSS custom properties defined in `src/index.css`. The full set:

### Colors

| Token | Light | Dark |
|-------|-------|------|
| `--background` | `#FAFAFA` | `#0A0A0C` |
| `--foreground` | `#0A0A0C` | `#FAFAFA` |
| `--card` | `#F0F0F3` | `#1C1C21` |
| `--card-hover` | `#E6E6E9` | `#25252B` |
| `--border` | `rgba(10,10,12,0.08)` | `rgba(255,255,255,0.08)` |
| `--text-muted` | `#6B6B70` | `#A1A1AA` |
| `--primary` | `#FF5A00` | `#FF5A00` |
| `--primary-hover` | `#E04E00` | `#FF7A33` |
| `--destructive` | `#FF3366` | `#FF3366` |

### Typography

- `--font-display`: `'Clash Display', sans-serif` (headings, weight 600/700)
- `--font-body`: `'Satoshi', sans-serif` (UI text, weight 400/500/700)

Both fonts load from Fontshare via `@import url(...)` in `src/index.css`.

### Tailwind v4 Theme Bridge

The `@theme` block in `src/index.css` maps the CSS variables to Tailwind utilities:

```css
@theme {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  /* ... */
  --font-display: var(--font-display);
  --font-body: var(--font-body);
}
```

This lets you write `bg-background`, `text-foreground`, `font-display`, etc. in JSX.

---

## Theme Toggle

The active theme is stored in `src/stores/theme-store.ts` (Zustand). On load it:

1. Checks `localStorage['wyvern-theme']`.
2. Falls back to `prefers-color-scheme`.
3. Adds `.dark` or `.light` to `document.documentElement`.

The theme can be toggled from the sidebar footer in `App.tsx`.

---

## Discord Webhook

### Creating a Webhook

1. In Discord, open **Server Settings → Integrations → Webhooks**.
2. Create a new webhook and copy its URL.
3. In Wyvern Drive, open **Settings** and paste the URL.
4. The app validates the webhook by issuing a `GET` request; status is shown in the sidebar footer dot.

### Constraints

- **25 MB per message** (Nitro-boosted servers only). Non-Nitro servers cap at 10 MB — Wyvern Drive defaults to 8 MB chunks for safety.
- **Rate limits** apply. `lib/rate-limiter.ts` implements exponential backoff.
- **CDN URLs expire.** Always store the Discord message ID alongside the webhook URL so the CDN URL can be refreshed.

<!-- VERIFY: Confirm Discord webhook message retention and CDN URL expiration policies against current Discord docs. -->

---

## Build Configuration

`vite.config.ts` controls the build:

- `@vitejs/plugin-react` for Fast Refresh and JSX transform
- `@tailwindcss/vite` for Tailwind v4 (no PostCSS config needed)
- `vitest` for unit tests with `jsdom` environment

No custom Vite plugins or bundler overrides.

---

## Browser Support

Requires a browser with:

- Web Crypto API (all modern browsers)
- IndexedDB (all modern browsers)
- Service Worker (for PWA install)
- ES2022+ syntax (Vite transpiles for older targets)

Tested on Chrome 120+, Firefox 121+, Safari 17+, Edge 120+.
