# Getting Started

## Prerequisites

- **Node.js 20+** and **npm 10+**
- A **Discord server** where you have permission to create webhooks
- A modern browser (Chrome 120+, Firefox 121+, Safari 17+, Edge 120+)

---

## Install

```bash
git clone https://github.com/Zendevve/Wyvern-Drive.git
cd Wyvern-Drive
npm install
```

---

## Run the Dev Server

```bash
npm run dev
```

Vite serves the app on `http://localhost:5173` with hot module replacement.

---

## First-Time Setup

1. **Open the app** — you'll be greeted with a vault password prompt.
2. **Create a vault password.** This password derives the encryption key (PBKDF2, 600K iterations). **There is no password recovery** — if you forget it, your files are unrecoverable.
3. **Open Settings** in the sidebar.
4. **Paste a Discord webhook URL.** See the next section for how to create one.
5. **Save.** The sidebar footer will show a green dot if the webhook is valid.

You can now drag files into the window or click the upload card to begin.

---

## Creating a Discord Webhook

1. In Discord, right-click your server icon → **Server Settings**.
2. Navigate to **Integrations → Webhooks**.
3. Click **New Webhook**, name it (e.g. "Wyvern Drive"), pick a channel.
4. Click **Copy Webhook URL**.
5. Paste it into Wyvern Drive's Settings panel.

### Limits to Know

| Constraint | Limit | Notes |
|------------|-------|-------|
| File size per message | 10 MB (default) / 25 MB (Nitro) | Wyvern Drive chunks at 8 MB to stay safe |
| Rate limit | ~50 req/sec | Backoff is automatic; see `lib/rate-limiter.ts` |
| CDN URL expiration | Variable | Always store the message ID for refresh |

---

## Build for Production

```bash
npm run build
```

Outputs static files to `dist/`. Deploy that folder to any static host:

- **GitHub Pages** — push `dist/` to a `gh-pages` branch
- **Cloudflare Pages** — connect the repo, set build command to `npm run build`, output dir to `dist`
- **Netlify / Vercel** — same build command and output dir
- **Self-hosted** — `scp -r dist/ user@server:/var/www/wyvern/`

No backend server is required.

---

## Smoke Test

After deployment:

```bash
npm run preview        # serves dist/ locally
# OR visit your hosted URL
```

Upload a small test file, lock the vault (sidebar footer → Lock), unlock it, and download the file. If decryption succeeds, the pipeline is working end-to-end.

---

## Run the Tests

```bash
npm test               # unit + integration (Vitest, 28 tests)
npm run test:e2e       # end-to-end (Playwright, requires browsers installed)
```

See [docs/TESTING.md](TESTING.md) for the full test strategy.

---

## Troubleshooting

**"Invalid password" on every unlock**
The vault password derives the encryption key directly. There is no reset flow — you must use the exact password you set during creation.

**Uploads fail with 429**
You're hitting Discord's rate limit. The app backs off automatically, but if you see persistent failures, reduce the chunk size in `lib/chunker.ts` (default 8 MB).

**Sidebar webhook dot is red**
The webhook URL is invalid or the channel was deleted. Re-create the webhook in Discord and update it in Settings.

**Build warnings about chunk size**
Vite warns when a single bundle exceeds 500 KB. Wyvern Drive's main bundle is well under that — if you see this after adding dependencies, consider code-splitting the heavy import.
