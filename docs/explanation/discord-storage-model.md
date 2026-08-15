# The Discord Webhook Storage Model

This document explains the conceptual architecture of using Discord Webhooks as an object storage backend in Wyvern Drive.

---

## 1. The Core Paradigm: Discord as a Content-Addressable Blob Store

Discord is primarily known as a communication platform. However, at its infrastructure level, every text channel is an append-only message log, and every message can contain binary file attachments hosted on Discord's globally distributed Content Delivery Network (`cdn.discordapp.com`).

```
┌─────────────────────────────────────────────────────────────┐
│                       LOCAL WORKSTATION                     │
│                                                             │
│   Source File (e.g. 50MB)                                   │
│        │                                                    │
│        ├─► Chunk 0 (18MB) ──► AES-GCM Encrypt ──┐           │
│        ├─► Chunk 1 (18MB) ──► AES-GCM Encrypt ──┼──► Webhook │
│        └─► Chunk 2 (14MB) ──► AES-GCM Encrypt ──┘    Upload │
└───────────────────────────────────────────────────────┬─────┘
                                                        │
                                                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    DISCORD CLOUD INFRASTRUCTURE             │
│                                                             │
│   #cloud-storage Channel                                    │
│   ├── Message #101 ──► Attachment: chunk_00000.wyv (18MB)   │
│   ├── Message #102 ──► Attachment: chunk_00001.wyv (18MB)   │
│   └── Message #103 ──► Attachment: chunk_00002.wyv (14MB)   │
└─────────────────────────────────────────────────────────────┘
```

When a file is uploaded to Discord:
1. Discord stores the binary blob on its CDN.
2. Discord issues a persistent **Attachment Snowflake ID**, **Attachment URL**, and **Message ID**.
3. Passing `?wait=true` to the webhook URL forces the API to synchronously return this attachment metadata in the HTTP response.

---

## 2. Why Webhooks over Bot Tokens?

Wyvern Drive utilizes **Discord Webhooks** rather than Discord Bot applications for several deliberate architectural reasons:

1. **Zero Bot Setup & Zero OAuth2 Flows**:
   Creating a Discord Bot requires setting up a developer portal application, configuring bot permissions, generating bot tokens, enabling privileged gateway intents, and completing an OAuth2 invite flow. Webhooks, in contrast, are created in two clicks inside Discord channel settings.

2. **Scoped Minimal Privileges**:
   A webhook is strictly bound to a single text channel. It cannot read user direct messages, cannot inspect guild member lists, cannot modify server settings, and has no presence overhead.

3. **No Gateway WebSocket Overhead**:
   Bot clients maintain persistent WebSocket connections to Discord's gateway servers. Webhooks communicate purely over standard stateless HTTP `POST`, `GET`, and `DELETE` requests.

---

## 3. The 20MB Chunking Engine

In recent updates, Discord raised its free-tier attachment upload limit to **20MB** per file. 

To store files of arbitrary size (from a 50MB audio album to a 20GB 4K video), Wyvern Drive utilizes a fixed-slice stream chunker:
- Files are sliced into deterministic **18MB boundaries**.
- Each slice is uploaded independently.
- The local SQLite store records the manifest containing the sequential order of message IDs and attachment URLs.
- During downloads or streaming, chunks are fetched and reassembled transparently.
