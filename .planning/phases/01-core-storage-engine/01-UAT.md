---
status: testing
phase: 01-core-storage-engine
source: [01-SUMMARY.md]
started: 2026-06-04T10:26:00Z
updated: 2026-06-04T10:26:00Z
---

## Current Test

number: 1
name: Cold Start Smoke Test
expected: |
  Kill any running server/service. Clear ephemeral state (temp DBs, caches, lock files). Start the application from scratch. Server boots without errors, any seed/migration completes, and a primary query (health check, homepage load, or basic API call) returns live data.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server/service. Clear ephemeral state (temp DBs, caches, lock files). Start the application from scratch. Server boots without errors, any seed/migration completes, and a primary query (health check, homepage load, or basic API call) returns live data.
result: [pending]

### 2. Webhook Authentication & Token Generation
expected: Client sends POST `/auth/webhook` with a Discord Webhook URL. The server validates the webhook and returns a signed JWT containing the webhook URL.
result: [pending]

### 3. File Uploading & Chunking
expected: Client uploads a file via POST `/upload` with a valid JWT. The server splits the file into chunks under 24MB and uploads them to Discord, returning JSON metadata.
result: [pending]

### 4. File Download Streaming & Reassembly
expected: Client requests GET `/download` with the chunk metadata. The server streams the reassembled file back. Supports partial content range requests.
result: [pending]

### 5. CDN Attachment URL Refreshing
expected: When requesting a chunk whose CDN URL is expired (403/401), the server automatically refreshes the attachment URL via the Webhook API and successfully returns the data.
result: [pending]

### 6. Storage Bulk Deletion
expected: Client calls DELETE `/delete` with list of message IDs. The server successfully deletes all specified chunk attachments from Discord and returns a success response.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps

[none yet]
