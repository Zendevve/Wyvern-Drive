# Wyvern Drive Documentation

Welcome to the **Wyvern Drive** documentation, organized strictly according to the [Diátaxis Framework](https://diataxis.fr/).

```
                        LEARNING-ORIENTED
                               ▲
                               │
               TUTORIALS       │      EXPLANATIONS
          (Get Started Lesson) │ (Architecture & Concepts)
                               │
   PRACTICAL ──────────────────┼────────────────── THEORETICAL
   PROBLEMS                    │                   KNOWLEDGE
              HOW-TO GUIDES    │       REFERENCE
             (Task Recipes)    │ (APIs, Schemas, Config)
                               │
                               ▼
                      INFORMATION-ORIENTED
```

---

## 1. 🎓 Tutorials (Learning-Oriented)
Practical, guided lessons designed to take you from a fresh installation to a fully operational Discord-backed personal cloud drive:
- [Getting Started with Wyvern Drive](tutorials/getting-started.md) — Create your first Discord storage vault, upload multi-chunk encrypted files, and stream media in under 10 minutes.

---

## 2. 🛠️ How-To Guides (Problem-Oriented)
Step-by-step recipes to solve specific real-world challenges:
- [How to Configure & Test Discord Webhooks](how-to/configure-webhooks.md) — Generate webhooks, test latency, and manage storage channels.
- [How to Manage AES-256-GCM Encryption](how-to/encryption-and-security.md) — Configure master keys, Argon2id derivation, and zero-knowledge storage.
- [How to Backup, Export & Restore Vault Metadata](how-to/backup-and-restore.md) — Export portable JSON manifests and migrate between machines.
- [How to Build Wyvern Drive from Source](how-to/build-from-source.md) — Compile the Go backend, React frontend, and package native desktop binaries.

---

## 3. 📖 Reference (Information-Oriented)
Exact, technical descriptions of the engine, APIs, SQLite schemas, and configuration parameters:
- [Backend Engine & Package Reference](reference/backend-architecture.md) — Deep technical reference for `pkg/crypto`, `pkg/discord`, `pkg/storage`, `pkg/engine`, and `pkg/server`.
- [Wails IPC & Frontend API Reference](reference/wails-ipc-api.md) — TypeScript bindings, data models, and Go inter-process communication bridge.
- [Configuration & Settings Dictionary](reference/configuration.md) — Chunk size limits, concurrency options, streaming server parameters, and environment settings.

---

## 4. 💡 Explanation (Understanding-Oriented)
In-depth discussions and conceptual breakdowns of Wyvern Drive's architecture:
- [The Discord Webhook Storage Model](explanation/discord-storage-model.md) — How multipart attachments, 20MB chunking, and Discord CDN URLs provide unlimited cloud storage.
- [Zero-Knowledge Cryptographic Architecture](explanation/cryptography-model.md) — Why Discord never sees plaintext file data or file names.
- [Byte-Range Media Streaming](explanation/byte-range-streaming.md) — How in-app video and audio seeking works across distributed chunk attachments.
- [Rate Limiting, Jitter & Retry Resilience](explanation/rate-limits-and-resilience.md) — Exponential backoff handling for Discord HTTP 429 responses.
