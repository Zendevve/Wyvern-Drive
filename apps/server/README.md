# @disbox/server

Hono server for Disbox v2. Filled in during **Phase 2**.

Stack: Hono + discord.js-selfbot-v13 + Drizzle ORM + better-sqlite3 + jose (JWT).

The server is the **only** component that talks to Discord. The web app talks to the server over REST; the server proxies all chunked upload/download traffic, manages rate limits, and persists metadata in SQLite.

⚠ **Self-bot mode**: uses `discord.js-selfbot-v13`. See top-level `README.md` for the ToS warning.
