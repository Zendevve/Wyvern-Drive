# Configuration & Settings Dictionary

This document details all configuration keys, storage limits, default parameters, and runtime options for Wyvern Drive.

---

## 1. Vault Settings Reference

Settings are stored in the local SQLite `settings` table and mapped through `storage.AppSettings`.

| Key | Type | Default | Description |
|---|---|---|---|
| `webhook_url` | String | `""` | Full Discord webhook URL used for storage uploads. |
| `webhook_name` | String | `"Discord Storage Vault"` | Friendly display name of target Discord webhook. |
| `channel_id` | String | `""` | Discord channel snowflake ID linked to the webhook. |
| `guild_id` | String | `""` | Discord server (guild) ID. |
| `master_key` | String | `""` | User master encryption key / passphrase. |
| `encryption_enabled` | Boolean | `true` | When `true`, all chunks are encrypted with AES-256-GCM before upload. |
| `chunk_size_bytes` | Integer | `18874368` (18 MB) | Maximum byte size per chunk slice uploaded to Discord. |
| `max_concurrency` | Integer | `4` | Number of concurrent chunk upload/download worker threads. |
| `auto_launch_server`| Boolean | `true` | Automatically starts the local HTTP media streaming server on boot. |
| `server_port` | Integer | `49152` | Local TCP port for embedded streaming server. |
| `theme` | String | `"dark"` | UI theme (`"dark"`). |
| `setup_completed` | Boolean | `false` | Indicates whether the initial Onboarding Wizard has finished. |

---

## 2. Chunk Size Guidelines & Discord Limits

Discord enforces file size limits per attachment based on the server tier:

| Tier | Maximum Upload Limit | Recommended Wyvern Chunk Size |
|---|---|---|
| **Free Tier (Default)** | **20.0 MB** | **18.0 MB** (`18874368` bytes) |
| Nitro Basic | 50.0 MB | 45.0 MB |
| Server Boost Level 2 | 50.0 MB | 45.0 MB |
| Server Boost Level 3 | 100.0 MB | 90.0 MB |

> 💡 **Why 18MB?** Setting the default chunk size to 18MB provides a ~2MB safety buffer for multipart MIME form headers, JSON payloads, and AES-GCM authentication tags, avoiding hitting Discord's 20MB free upload limit.

---

## 3. Concurrency Recommendations

- **1–2 Workers**: Best for slower connections or to strictly prevent triggering Discord's HTTP 429 rate limit bucket.
- **4 Workers (Default)**: Ideal balance of maximum throughput (~15–30 MB/s) and webhook rate limit headroom.
- **6–8 Workers**: High throughput on boosted Discord servers with high-speed fiber internet.

---

## 4. Local Storage Paths

| Operating System | Default Database Path |
|---|---|
| **Windows** | `%APPDATA%\WyvernDrive\wyvern.db` |
| **macOS** | `~/Library/Application Support/WyvernDrive/wyvern.db` |
| **Linux** | `~/.config/WyvernDrive/wyvern.db` |
