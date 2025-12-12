# Feature: File Upload

## Purpose
Allow users to upload files to Discord storage with optional encryption.

## Business Rules
- Files larger than chunk size (25MB default, 50MB for Nitro) are split
- Each chunk is uploaded as a Discord attachment via webhook
- Encrypted files store IV alongside content references
- Duplicate filenames get incremented suffix (file (1).txt)

## Main Flow
1. User selects file(s) via button or drag-and-drop
2. System checks file size and determines chunk count
3. If encryption enabled, derive key from password
4. For each chunk: encrypt (optional) → upload → store message ID
5. Save file metadata to server with content references
6. Display success with file in list

## Edge Cases
- Upload cancelled mid-way: delete already-uploaded chunks
- Network failure: retry with exponential backoff (max 3 attempts)
- Discord rate limit: wait and retry automatically
- Very large files (>1GB): show warning about upload time

## Test Flows

| Scenario | Input | Expected Result |
|----------|-------|-----------------|
| Small file upload | 1MB file | Uploads in 1 chunk, appears in list |
| Large file upload | 100MB file | Splits into 4 chunks, progress shows |
| Encrypted upload | File + password | Encrypts before upload, stores IV |
| Duplicate name | Same filename exists | Renamed to "file (1).ext" |
| Network failure | Disconnect during upload | Retries 3x, then shows error |

## Definition of Done
- [ ] File appears in list after upload
- [ ] Progress bar shows accurate percentage
- [ ] Large files split correctly
- [ ] Encryption works end-to-end
- [ ] Integration test passes
