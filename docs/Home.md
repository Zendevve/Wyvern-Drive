# Wyvern Drive Documentation

Welcome to the Wyvern Drive documentation.

## Quick Links

- [Features](./Features/) - Feature specifications
- [ADR](./ADR/) - Architecture Decision Records
- [Testing](./Testing/) - Test strategy and guides
- [Development](./Development/) - Setup and workflow

## What is Wyvern Drive?

Wyvern Drive is a Discord-based cloud storage service that improves upon Disbox with:

- **Modern UI/UX** - Dark mode, animations, drag-and-drop, mobile support
- **Client-side Encryption** - AES-256-GCM before upload
- **Folder Operations** - Upload/download/delete entire folders
- **File Versioning** - Track and restore previous versions
- **Move & Edit** - Full file management capabilities

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web Client    │────▶│     Server      │────▶│    Database     │
│  (React + TS)   │     │  (Express + TS) │     │    (SQLite)     │
└────────┬────────┘     └─────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│  Discord API    │
│   (Webhooks)    │
└─────────────────┘
```
