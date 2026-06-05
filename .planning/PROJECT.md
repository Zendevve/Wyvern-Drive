# Wyvern Drive

## What This Is

Wyvern Drive is a browser-based personal cloud storage application that utilizes Discord as a free, unlimited blob storage backend. Files are split into chunks of up to 24MB, uploaded via Discord webhooks, and indexed in a metadata database, providing a Google Drive-like user experience with zero server-side storage costs.

## Core Value

Users get free, unlimited personal cloud storage with standard file manager features (folders, uploads, downloads) using their own Discord webhooks as the backend.

## Current Milestone: v2.0 Professional Cloud Storage UX

**Goal:** Deliver a premium, visually stunning, and highly interactive Google Drive/MEGA-grade cloud storage interface.

**Target features:**
- **Premium Design System & Theme:** Off-white warm canvas (`#F8F9FA`), white card modules with thin borders, and harmonious HSL accent gradients (sky-blue/golden-orange).
- **Responsive Dashboard Sidebar & Widgets:** Left sidebar navigation with an arc-gauge storage indicator displaying used storage vs. limits, plus file category weights.
- **Enhanced Directory Browser:** Grid & list toggle views, color-coded files/folders with nested avatar piles for collaborative elements, and visual type category filter chips.
- **Detail & Preview Side-Pane:** Right-hand collapsible sidebar displaying detailed file metadata (size, upload timestamp, CDN URL status), quick sharing options, and file-type visual previews.
- **Custom Context Menus:** Right-click context menus for files and folders (Rename, Delete, Share, Open/Download) matching native desktop behaviors.
- **Active Upload/Download Queue Overlay:** Floating task queue in the bottom right corner showing real-time speed, progress bars, and queue status, styled after MEGA/pCloud.

## Requirements

### Validated

- **F-01**: Webhook-based account setup and stateless JWT authentication (Validated in v1.0)
- **F-02**: File upload with automatic chunking (24MB limit per chunk) (Validated in v1.0)
- **F-03**: File download with chunk reassembly and dynamic CDN URL refresh (Validated in v1.0)
- **F-04**: Folder creation and directory hierarchy management (Validated in v1.0)
- **F-05**: File/folder virtual filesystem listing scoped by hashed webhook (Validated in v1.0)
- **F-06**: Delete file (cascade delete in metadata and associated Discord messages) (Validated in v1.0)
- **F-07**: Upload progress indicator (per-chunk progress) (Validated in v1.0)
- **F-08**: Drag-and-drop file upload (Validated in v1.0)
- **F-09**: Breadcrumb navigation (Validated in v1.0)
- **F-10**: File type icon mapping (Validated in v1.0)
- **F-11**: Database backup & restore (export/import virtual drive metadata JSON) (Validated in v1.0)

### Active

- [ ] **F-12**: Color-coded premium UI design system with off-white canvas, smooth gradients, and micro-animations
- [ ] **F-13**: Sidebar storage gauge widget (semi-circular arc representation) displaying category size breakdown
- [ ] **F-14**: Directory browser grid/list toggle, type category visual filter chips, and custom folder card style with collaborative avatar stack mockups
- [ ] **F-15**: Right collapsible detail pane showing metadata details and file preview cards
- [ ] **F-16**: Desktop-grade custom right-click context menu options for folders and files
- [ ] **F-17**: Bottom-right floating tasks queue overlay showing active upload/download speeds and progress bars

### Out of Scope

- Multi-user / team shared folders — High complexity, not aligned with personal storage focus.
- Native mobile/desktop application wrappers — Deferred to future milestones, focusing on web SPA first.
- Bot account integration — Avoided to keep setup bot-less and minimize complexity.

## Context

### Technical Environment
- **Frontend**: React 18, Vite, TypeScript, Zustand, Vanilla CSS (rich/premium custom aesthetics).
- **Backend**: Node.js 20+, Fastify, better-sqlite3.
- **Blob Engine**: Discord Webhook API.

### Ecosystem Limitations
- **Discord CDN Expiration**: In late 2023, Discord forced CDN attachment URLs to expire after 24 hours. The app must dynamically refresh URLs.
- **Discord Rate Limits**: 30 requests/minute per webhook. Rate limiting must be gracefully handled via queue, backoff, and jitter.

## Constraints

- **Storage Limit**: Chunks must be under 25MB (limit is set to 24MB to allow margin).
- **Zero Cost**: Architecture must run locally or on free VPS tiers with no database hosting fees.
- **Stateless Backend**: The server must not store webhook URLs persistently as credentials; authentication is handled via JWTs containing the webhook URL.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Webhook URL Message Fetching | Dynamic CDN URL refresh is achieved via `GET /webhooks/{id}/{token}/messages/{msgId}` to get fresh attachment links. | — Pending |
| Stateless JWT Auth | JWT contains the webhook URL. Hashing the URL provides a unique `accountId` to isolate file nodes in SQLite. | — Pending |
| JSON Metadata Import/Export | Enables backup and recovery of the SQLite virtual drive metadata without running secondary database servers. | — Pending |
| Swappable Storage Interface | Abstracing operations into `StorageBackend` allows switching from Discord to other engines in the future. | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-05 for milestone v2.0*
