<div align="center">

```
 __      __                                 _____          _             
 \ \    / /                                |  __ \        (_)            
  \ \  / /   _ _ __ ___ _ __ _ __          | |  | |_ __ ___   _____      
   \ \/ / | | | '__/ _ \ '__| '_ \  ______ | |  | | '__| \ \ / / _ \     
    \  /| |_| | | |  __/ |  | | | ||______|| |__| | |  | |\ V /  __/     
     \/  \__, |_|  \___|_|  |_| |_|        |_____/|_|  |_| \_/ \___|     
          __/ |                                                          
         |___/                                                           
```

### Discord-Backed Personal Cloud Drive

[![Go Version](https://img.shields.io/badge/Go-1.23+-00ADD8?style=flat&logo=go)](https://golang.org)
[![Wails](https://img.shields.io/badge/Wails-v2-DF0000?style=flat&logo=wails)](https://wails.io)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat&logo=react)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)](https://github.com)

*A desktop cloud storage application that transforms private Discord channels into encrypted personal vaults.*

---

</div>

## Overview

**Wyvern Drive** provides personal cloud storage backed by Discord attachment infrastructure. Built with Go, Wails v2, React, and TypeScript, it allows you to store files of arbitrary size with client-side encryption and in-app media streaming.

Files are split into 18 MB slices (configured for Discord's 20 MB limit), encrypted locally with **AES-256-GCM** using **Argon2id** key derivation, and uploaded via webhooks. An embedded local HTTP server enables direct video and audio streaming with byte-range seeking without downloading full files first.

> [!NOTE]
> All encryption and decryption occurs locally on your machine before data is transmitted. Discord servers only store encrypted binary ciphertext with opaque names.

---

## Features

- **Free & Unlimited Storage**: Powered by your private Discord server channel attachments with zero subscription costs.
- **Client-Side AES-256-GCM**: Key derivation via Argon2id with unique 12-byte random nonces per chunk. Discord has no access to plaintext content or filenames.
- **High-Throughput Chunking Engine**: Automatically slices multi-gigabyte files into 18 MB pieces with concurrent worker threads and exponential backoff retry handling.
- **Byte-Range Media Streaming**: Embedded local HTTP server supporting `Accept-Ranges: bytes` for seeking video and audio directly in the desktop player.
- **Onboarding Wizard**: Step-by-step interactive setup wizard to create your private Discord server, generate a webhook, test latency, and configure master encryption keys.
- **Modern Desktop UI**: Cards and table view modes, fast search (`Ctrl+K`), custom color folder trees, favorites, and drag-and-drop dropzone.
- **Transfer Manager**: Real-time throughput metrics (MB/s), progress bars, ETA estimates, chunk counters, and cancellation controls.
- **Chunk Manifest Inspector**: Deep inspection of individual Discord attachment URLs, message IDs, nonces, and SHA-256 integrity checksums.
- **Local SQLite Store**: Thread-safe WAL SQLite database for local index management with JSON manifest export and import.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 WYVERN DRIVE (Desktop App)                  │
│                                                             │
│   React 18 + TypeScript + Tailwind CSS UI (Wails v2)        │
│   ├── Onboarding Wizard & Setup Flow                        │
│   ├── Cloud Explorer (Grid / Table / Virtual Folders)       │
│   ├── Transfer Center Drawer & In-App Media Player          │
│   └── Settings & Manifest Inspector                         │
└──────────────────────────────┬──────────────────────────────┘
                               │ Wails IPC & Local HTTP
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 GO STORAGE & STREAMING ENGINE               │
│                                                             │
│   ├── pkg/crypto   : Argon2id Key Derivation + AES-256-GCM  │
│   ├── pkg/discord  : Multipart Uploader + 429 Rate Limiter  │
│   ├── pkg/storage  : SQLite WAL Metadata Store              │
│   ├── pkg/engine   : 18MB Chunker, Range Seeker, Integrity  │
│   └── pkg/server   : Range HTTP Streaming (127.0.0.1:49152) │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS Multipart Attachments
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                DISCORD CLOUD INFRASTRUCTURE                 │
│                                                             │
│   Private Discord Server Channel Webhook                    │
│   └── cdn.discordapp.com (Distributed 18MB Encrypted Blobs) │
└─────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

Before building or running the project, ensure you have:

- **Go**: Version 1.23 or newer ([golang.org/dl](https://golang.org/dl))
- **Node.js**: Version 18.x or newer with npm ([nodejs.org](https://nodejs.org))
- **Wails CLI v2**: Version 2.10+ ([wails.io](https://wails.io/docs/gettingstarted/installation))
  ```bash
  go install github.com/wailsapp/wails/v2/cmd/wails@latest
  ```

---

## Quick Start

### 1. Clone Repository & Install Dependencies

```bash
git clone https://github.com/your-org/wyvern-drive.git
cd wyvern-drive

# Download Go backend dependencies
go mod download

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 2. Run Tests

Verify all packages pass:

```bash
go test -v ./...
```

Expected output:
```
ok  	wyvern-drive/pkg/crypto
ok  	wyvern-drive/pkg/discord
ok  	wyvern-drive/pkg/engine
ok  	wyvern-drive/pkg/server
ok  	wyvern-drive/pkg/storage
```

### 3. Build & Package

Compile the standalone production desktop executable:

```bash
# Build frontend bundle
cd frontend && npm run build && cd ..

# Build native binary
go build -ldflags="-s -w" -o wyvern-drive.exe .
```

> [!TIP]
> You can also run in live development mode with hot module replacement using `wails dev`.

---

## Usage Guide

### 1. Webhook Setup
1. Open Discord and create a private server.
2. Navigate to **Server Settings** → **Integrations** → **Webhooks**.
3. Click **Create Webhook**, select your storage text channel, and copy the Webhook URL.
4. Paste the URL into Wyvern Drive during onboarding or in **Settings** and click **Test Connection**.

### 2. Uploading Files
- Click the **Upload** button in the top navigation bar or drag and drop files directly onto the window.
- The engine automatically computes file hashes, encrypts chunks, and coordinates parallel delivery.

### 3. Media Streaming & Playback
- Double-click any uploaded video (`.mp4`, `.webm`, `.mkv`), audio (`.mp3`, `.flac`), or image to launch the in-app media previewer.
- Video seeks jump directly to the target byte offsets without waiting for prior chunks.

> [!IMPORTANT]
> Keep a backup of your **Master Encryption Passphrase**. If you switch computers, you will need the exact same passphrase to decrypt files.

---

## Project Structure

```
wyvern-drive/
├── main.go                     # Desktop entrypoint and Wails window configuration
├── app.go                      # Wails IPC bindings exposed to React
├── wails.json                  # Wails application manifest
├── pkg/
│   ├── crypto/                 # AES-256-GCM encryption & Argon2id key derivation
│   ├── discord/                # Discord Webhook API client & 429 backoff handling
│   ├── storage/                # SQLite WAL database & metadata persistence
│   ├── engine/                 # 18MB chunker, worker pools & Range reader
│   └── server/                 # Embedded local media streaming server
├── frontend/
│   ├── src/
│   │   ├── components/         # Sidebar, Header, FileGrid, TransferCenter, Modals
│   │   ├── services/api.ts     # Unified IPC bridge with browser mock mode
│   │   ├── types/index.ts      # TypeScript interfaces and contracts
│   │   └── App.tsx             # Root React application
│   └── package.json
└── docs/                       # Complete Diátaxis documentation suite
```

---

## Documentation

Full documentation is available in the [`docs/`](docs/) directory, structured according to the Diátaxis framework:

- **Tutorials**: [Getting Started with Wyvern Drive](docs/tutorials/getting-started.md)
- **How-To Guides**:
  - [Configure & Test Webhooks](docs/how-to/configure-webhooks.md)
  - [Manage AES-256-GCM Encryption](docs/how-to/encryption-and-security.md)
  - [Backup, Export & Restore Vault Metadata](docs/how-to/backup-and-restore.md)
  - [Build from Source](docs/how-to/build-from-source.md)
- **Reference**:
  - [Backend Architecture](docs/reference/backend-architecture.md)
  - [Wails IPC API](docs/reference/wails-ipc-api.md)
  - [Configuration Dictionary](docs/reference/configuration.md)
- **Explanation**:
  - [The Discord Storage Model](docs/explanation/discord-storage-model.md)
  - [Zero-Knowledge Cryptographic Architecture](docs/explanation/cryptography-model.md)
  - [Byte-Range Media Streaming](docs/explanation/byte-range-streaming.md)
  - [Rate Limiting & Transfer Resilience](docs/explanation/rate-limits-and-resilience.md)
