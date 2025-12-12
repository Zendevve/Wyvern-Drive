# 🐉 Wyvern Drive

Discord-based cloud storage with encryption, folder operations, and file versioning.

## Features

- ✅ **Modern UI** - Dark theme, drag-and-drop, right-click menu, mobile support
- ✅ **Client-side Encryption** - AES-256-GCM before upload
- ✅ **Folder Operations** - Upload/download/delete entire folders
- ✅ **File Versioning** - Track and restore previous versions
- ✅ **Move & Edit** - Full file management

## Quick Start

```bash
# Web client (http://localhost:5173)
cd wyvern-web && npm install && npm run dev

# Server (http://localhost:8080)
cd wyvern-server && npm install && npm run dev
```

## Structure

- `wyvern-web/` - React 18 + TypeScript web client
- `wyvern-server/` - Express + TypeScript API server
- `wyvern-extension/` - Chrome extension for CORS bypass
- `docs/` - MCAF documentation

## License

MIT
