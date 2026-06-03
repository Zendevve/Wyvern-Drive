---
created: 2026-06-03T05:30:14.981Z
title: Ensure complete self hosted local architecture
area: general
files:
  - wyvern-web/src/components/AuthScreen.tsx
  - .planning/phases/07.1-localhost-database-and-api-backend-migration/07.1-CONTEXT.md
---

## Problem

The user wants to avoid external cloud dependencies and keep all services and data completely self-hosted on the local machine as much as humanly possible. 

## Solution

Migrate user accounts, metadata storage, and sharing features from cloud-hosted Supabase services to a local Express server powered by better-sqlite3 database files on disk. Keep external media chunk storage on Discord but design the backend/API structure to support pluggable or alternative storage drivers so that a fully local file system storage driver can be used in the future if required.
