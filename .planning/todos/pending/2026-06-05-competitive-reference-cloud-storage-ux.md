---
created: "2026-06-05T00:57:06.000Z"
title: Competitive reference — cloud storage UX benchmarks
area: ui
files: []
---

## Problem

Wyvern Drive needs to look and feel like a proper cloud storage service. The competitive landscape should always be referenced as proof that the concept works — our job is to be better than them. The UI/UX must match or exceed the polish of established players despite using Discord as the backend.

## Competitive References

These are the proven services that validate our model. Use as benchmarks for look-and-feel, not pricing or storage tiers.

| Service | Free Tier | Inactivity Window | Paid $/GB/mo | Notes |
|---------|-----------|-------------------|--------------|-------|
| Google Drive | 5GB (15GB w/ Phone) | 2 Years | ~$3.33 (5TB AI Pro) | Gold standard UX |
| MEGA | 20GB | 3 Months | ~$1.72 (20TB Pro III) | E2EE, clean UI |
| Yandex Disk | 5GB | 2 Years | ~$2.61 (4TB Personal) | |
| Filen | 10GB | 3 Months | ~$3.84 (10TB Pro X) | Requires sign-up for sharing |
| Dropbox | 1–2GB | 12 Months | ~$4.15 (15TB Advanced) | Desktop client |
| MediaFire | 10GB | 8 Months | ~$5.83 (1TB Pro) | |
| Icedrive | 10GB | 3 Months | ~$2.07 (6TB Pro Max) | |
| pCloud | 10GB | 1 Year | ~$2.88 (10TB Ultra) | |
| FEB | 10GB | 1 Month | ~$2.20 (1TB Personal) | |
| Keybase | 250GB | Forever | — | Best free tier |
| Proton Drive | 5GB | 1 Year | ~$6.66 (3TB Workspace Premium) | Privacy focus |
| InfiniCLOUD | 20GB | 1 Year | ~$3.66 (3TB) | |
| CryptFiles | 10GB | 1 Year | ~$9.24 (1–100TB Flexible) | |
| JumpShare | 2GB | 1 Year | ~$5.33 (3TB Business) | |
| FileLu | 10GB | Forever | ~$3.13 (40TB) | |
| MrOwl | 10GB | — | ~$16.67 (1TB Premium Plus) | |
| Blomp | 40GB | 1 Month | ~$1 (10TB+) | |
| Backblaze B2 | 10GB | — | ~$6 | S3-compatible |
| Cloudflare R2 | 10GB | Forever | ~$15 | Zero egress |
| Tresorit | 3GB | Forever | ~$6.94 (4TB Personal Pro) | 500MB per file limit |
| 1Cloud File | 10GB | — | — | |

## Solution

Use this reference table when designing and reviewing Wyvern Drive's UI. Every design decision should be benchmarked against these services — especially Google Drive, MEGA, Dropbox, Icedrive, and pCloud for their clean, professional file manager UX. The goal is to deliver an experience indistinguishable from a paid cloud storage product.

Key UX targets to match:
- **File browser grid/list views** (Google Drive, Dropbox)
- **Drag-and-drop upload** (all of them)
- **Preview pane** (Google Drive, Dropbox)
- **Context menus** (right-click actions)
- **Search and filtering** (Google Drive)
- **Breadcrumb navigation** (universal)
- **Progress indicators** for uploads/downloads (MEGA, pCloud)
- **Responsive mobile layout** (Google Drive, Dropbox)
