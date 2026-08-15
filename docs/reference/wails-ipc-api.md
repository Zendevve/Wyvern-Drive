# Wails IPC & Frontend API Reference

This document details the Inter-Process Communication (IPC) methods exposed by the Go backend (`app.go`) to the React/TypeScript frontend.

All methods are accessible in the frontend via `window.go.main.App.<MethodName>()` or through the unified `api` service module (`frontend/src/services/api.ts`).

---

## 1. Webhook & Configuration API

### `ValidateWebhook(webhookURL string) (*discord.WebhookInfo, error)`
Tests and validates a Discord Webhook URL.
- **Parameters**: `webhookURL` (string) — full webhook URL.
- **Returns**: `WebhookInfo` object containing `id`, `name`, `channel_id`, `guild_id`, and `latency_ms`.

### `GetSettings() (*storage.AppSettings, error)`
Retrieves current global vault configuration.
- **Returns**: `AppSettings` object (webhook URL, encryption settings, chunk size, port, theme).

### `SaveSettings(settings storage.AppSettings) error`
Persists updated configuration to the local SQLite database.

### `GetStats() (*storage.StorageStats, error)`
Compiles storage metrics.
- **Returns**: `total_files`, `total_folders`, `total_bytes`, `total_chunks`, `encrypted_files`, `category_counts`, `category_bytes`.

---

## 2. File Explorer & Hierarchy API

### `ListFolders(parentID *string) ([]storage.Folder, error)`
Returns child virtual folders for a given parent folder ID (or root if `nil`).

### `CreateFolder(parentID *string, name string, color, icon string) (*storage.Folder, error)`
Creates a new virtual directory.

### `RenameFolder(id string, newName string) error`
Renames a virtual folder.

### `DeleteFolder(id string, recursive bool) error`
Deletes a folder and optionally deletes all contained files.

### `ListFiles(folderID *string, filter string, sortBy string, sortOrder string, limit, offset int) (*FileListResult, error)`
Queries files with filtering and pagination.
- **Filters**: `"all"`, `"favorites"`, `"recent"`, `"media_image"`, `"media_video"`, `"media_audio"`, `"documents"`, `"trash"`.
- **Sort Fields**: `"name"`, `"size"`, `"created_at"`.
- **Sort Orders**: `"asc"`, `"desc"`.

### `SearchFiles(query string) ([]storage.File, error)`
Performs a substring search across file names and tags.

### `GetFile(id string) (*storage.File, error)`
Fetches file metadata without chunk manifests.

### `GetFileDetails(id string) (*storage.File, error)`
Fetches complete file record including all chunk manifests (`[]storage.Chunk`).

### `ToggleFavorite(id string) (bool, error)`
Flips the favorite boolean flag for a file.

### `DeleteFile(id string, permanent bool) error`
Moves a file to trash or permanently deletes its database records and manifests.

---

## 3. Transfer & Media Streaming API

### `SelectAndUploadFiles(folderID *string) ([]storage.File, error)`
Opens the native OS file picker and initiates multi-chunk encrypted upload for selected files.

### `DownloadFileWithDialog(fileID string) (string, error)`
Opens the native OS save file dialog, streams chunks from Discord, decrypts them, and saves to the selected path.

### `GetTransfers() ([]storage.Transfer, error)`
Returns active, queued, and recently completed file transfers.

### `CancelTransfer(transferID string) bool`
Cancels an ongoing upload or download context.

### `ClearCompletedTransfers() error`
Clears completed, failed, or cancelled transfers from the active list.

### `GetStreamURL(fileID string) string`
Returns the local playback URL (e.g., `http://127.0.0.1:49152/api/stream/{fileID}`) for in-app media playback.
