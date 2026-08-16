package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"time"
	"wyvern-drive/pkg/crypto"
	"wyvern-drive/pkg/discord"
	"wyvern-drive/pkg/engine"
	"wyvern-drive/pkg/s3"
	"wyvern-drive/pkg/server"
	"wyvern-drive/pkg/storage"
	appSync "wyvern-drive/pkg/sync"
	"wyvern-drive/pkg/webdav"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// FileListResult returns a paginated list of files and total count.
type FileListResult struct {
	Files []storage.File `json:"files"`
	Total int64          `json:"total"`
}

// App struct
type App struct {
	ctx           context.Context
	store         *storage.Store
	discordClient *discord.Client
	engine        *engine.Engine
	server        *server.Server
	webdavServer  *webdav.Server
	s3Server      *s3.Server
	folderWatcher *appSync.FolderWatcher
	dataDir       string
	mu            sync.Mutex
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Determine user data directory
	userConfigDir, err := os.UserConfigDir()
	if err != nil {
		userConfigDir = "."
	}
	a.dataDir = filepath.Join(userConfigDir, "WyvernDrive")
	_ = os.MkdirAll(a.dataDir, 0755)

	dbPath := filepath.Join(a.dataDir, "wyvern.db")
	store, err := storage.NewStore(dbPath)
	if err != nil {
		wailsRuntime.LogErrorf(ctx, "Failed to initialize SQLite store: %v", err)
		return
	}
	a.store = store

	a.discordClient = discord.NewClient(nil)
	a.engine = engine.NewEngine(a.store, a.discordClient)

	// Fetch settings
	settings, _ := a.store.GetAppSettings()
	streamPort := 49152
	webdavPort := 49153
	s3Port := 49154

	if settings != nil {
		if settings.ServerPort > 0 {
			streamPort = settings.ServerPort
		}
		if settings.WebDAVPort > 0 {
			webdavPort = settings.WebDAVPort
		}
		if settings.S3Port > 0 {
			s3Port = settings.S3Port
		}
	}

	// 1. Streaming media server
	a.server = server.NewServer(a.store, a.engine, streamPort)
	if settings == nil || settings.AutoLaunchServer {
		if err := a.server.Start(); err != nil {
			wailsRuntime.LogErrorf(ctx, "Failed to launch streaming server: %v", err)
		} else {
			wailsRuntime.LogInfof(ctx, "Wyvern Drive streaming server listening on port %d", a.server.Port())
		}
	}

	// 2. Embedded WebDAV server
	a.webdavServer = webdav.NewServer(a.store, a.engine, webdavPort)
	if settings == nil || settings.WebDAVEnabled {
		if err := a.webdavServer.Start(); err != nil {
			wailsRuntime.LogErrorf(ctx, "Failed to launch WebDAV server: %v", err)
		} else {
			wailsRuntime.LogInfof(ctx, "Wyvern Drive WebDAV server listening on port %d", a.webdavServer.Port())
		}
	}

	// 3. Embedded S3-compatible gateway
	a.s3Server = s3.NewServer(a.store, a.engine, s3Port)
	if settings != nil && settings.S3Enabled {
		if err := a.s3Server.Start(); err != nil {
			wailsRuntime.LogErrorf(ctx, "Failed to launch S3 server: %v", err)
		} else {
			wailsRuntime.LogInfof(ctx, "Wyvern Drive S3 server listening on port %d", a.s3Server.Port())
		}
	}

	// 4. Background Folder Watcher
	a.folderWatcher = appSync.NewFolderWatcher(a.store, a.engine, 10*time.Second)
	a.folderWatcher.Start()
}

// shutdown is called at application termination
func (a *App) shutdown(ctx context.Context) {
	if a.folderWatcher != nil {
		a.folderWatcher.Stop()
	}
	if a.webdavServer != nil {
		_ = a.webdavServer.Stop(ctx)
	}
	if a.s3Server != nil {
		_ = a.s3Server.Stop(ctx)
	}
	if a.server != nil {
		_ = a.server.Stop(ctx)
	}
	if a.store != nil {
		_ = a.store.Close()
	}
}

// ValidateWebhook tests a Discord webhook URL
func (a *App) ValidateWebhook(webhookURL string) (*discord.WebhookInfo, error) {
	if a.discordClient == nil {
		return nil, errors.New("client not initialized")
	}
	return a.discordClient.ValidateWebhook(a.ctx, webhookURL)
}

// GetSettings retrieves current application settings
func (a *App) GetSettings() (*storage.AppSettings, error) {
	if a.store == nil {
		return nil, errors.New("database not initialized")
	}
	return a.store.GetAppSettings()
}

// SaveSettings persists updated application settings and reloads runtime engines
func (a *App) SaveSettings(settings storage.AppSettings) error {
	if a.store == nil {
		return errors.New("database not initialized")
	}
	if err := a.store.SaveAppSettings(&settings); err != nil {
		return err
	}
	if a.engine != nil {
		a.engine.ReloadPool()
	}
	return nil
}

// GetStats returns storage statistics
func (a *App) GetStats() (*storage.StorageStats, error) {
	if a.store == nil {
		return nil, errors.New("database not initialized")
	}
	return a.store.GetStats()
}

// ListFolders returns folders inside parentID or root folders
func (a *App) ListFolders(parentID *string) ([]storage.Folder, error) {
	if a.store == nil {
		return nil, errors.New("database not initialized")
	}
	return a.store.ListFolders(parentID)
}

// CreateFolder creates a new folder
func (a *App) CreateFolder(parentID *string, name string, color, icon string) (*storage.Folder, error) {
	if a.store == nil {
		return nil, errors.New("database not initialized")
	}
	return a.store.CreateFolder(parentID, name, color, icon)
}

// RenameFolder renames a folder
func (a *App) RenameFolder(id string, newName string) error {
	if a.store == nil {
		return errors.New("database not initialized")
	}
	return a.store.RenameFolder(id, newName)
}

// DeleteFolder deletes a folder
func (a *App) DeleteFolder(id string, recursive bool) error {
	if a.store == nil {
		return errors.New("database not initialized")
	}
	return a.store.DeleteFolder(id, recursive)
}

// ListFiles lists files with filtering and sorting
func (a *App) ListFiles(folderID *string, filter string, sortBy string, sortOrder string, limit, offset int) (*FileListResult, error) {
	if a.store == nil {
		return nil, errors.New("database not initialized")
	}
	files, total, err := a.store.ListFiles(folderID, filter, sortBy, sortOrder, limit, offset)
	if err != nil {
		return nil, err
	}
	return &FileListResult{
		Files: files,
		Total: total,
	}, nil
}

// SearchFiles searches files by name or tag
func (a *App) SearchFiles(query string) ([]storage.File, error) {
	if a.store == nil {
		return nil, errors.New("database not initialized")
	}
	return a.store.SearchFiles(query)
}

// GetFile retrieves a single file record
func (a *App) GetFile(id string) (*storage.File, error) {
	if a.store == nil {
		return nil, errors.New("database not initialized")
	}
	return a.store.GetFile(id)
}

// GetFileDetails retrieves a file including all chunk manifests
func (a *App) GetFileDetails(id string) (*storage.File, error) {
	if a.store == nil {
		return nil, errors.New("database not initialized")
	}
	return a.store.GetFileWithChunks(id)
}

// RenameFile renames a file
func (a *App) RenameFile(id string, newName string) error {
	if a.store == nil {
		return errors.New("database not initialized")
	}
	return a.store.RenameFile(id, newName)
}

// MoveFile moves a file to another folder
func (a *App) MoveFile(id string, targetFolderID *string) error {
	if a.store == nil {
		return errors.New("database not initialized")
	}
	return a.store.MoveFile(id, targetFolderID)
}

// ToggleFavorite toggles favorite flag
func (a *App) ToggleFavorite(id string) (bool, error) {
	if a.store == nil {
		return false, errors.New("database not initialized")
	}
	return a.store.ToggleFavorite(id)
}

// DeleteFile deletes or moves to trash
func (a *App) DeleteFile(id string, permanent bool) error {
	if a.store == nil {
		return errors.New("database not initialized")
	}
	return a.store.DeleteFile(id, permanent)
}

// RestoreFile restores a file from trash
func (a *App) RestoreFile(id string) error {
	if a.store == nil {
		return errors.New("database not initialized")
	}
	return a.store.RestoreFile(id)
}

// UploadFiles uploads a list of local files
func (a *App) UploadFiles(folderID *string, filePaths []string) ([]storage.File, error) {
	if a.engine == nil {
		return nil, errors.New("engine not initialized")
	}

	var uploaded []storage.File
	for _, fp := range filePaths {
		fileRecord, err := a.engine.UploadFile(a.ctx, fp, engine.UploadOptions{
			FolderID: folderID,
		})
		if err != nil {
			return uploaded, fmt.Errorf("failed uploading %s: %w", fp, err)
		}
		uploaded = append(uploaded, *fileRecord)
	}

	return uploaded, nil
}

// SelectAndUploadFiles opens a file selection dialog and uploads selected files
func (a *App) SelectAndUploadFiles(folderID *string) ([]storage.File, error) {
	files, err := wailsRuntime.OpenMultipleFilesDialog(a.ctx, wailsRuntime.OpenDialogOptions{
		Title: "Select Files to Upload to Wyvern Drive",
	})
	if err != nil {
		return nil, err
	}
	if len(files) == 0 {
		return []storage.File{}, nil
	}
	return a.UploadFiles(folderID, files)
}

// DownloadFile downloads a file to the specified destination path
func (a *App) DownloadFile(fileID string, destinationPath string) error {
	if a.engine == nil {
		return errors.New("engine not initialized")
	}
	return a.engine.DownloadFile(a.ctx, fileID, destinationPath)
}

// DownloadFileWithDialog opens a save file dialog and downloads the file
func (a *App) DownloadFileWithDialog(fileID string) (string, error) {
	if a.store == nil || a.engine == nil {
		return "", errors.New("application not initialized")
	}

	file, err := a.store.GetFile(fileID)
	if err != nil {
		return "", err
	}

	savePath, err := wailsRuntime.SaveFileDialog(a.ctx, wailsRuntime.SaveDialogOptions{
		Title:           "Save File As",
		DefaultFilename: file.Name,
	})
	if err != nil {
		return "", err
	}
	if savePath == "" {
		return "", nil // User cancelled
	}

	err = a.engine.DownloadFile(a.ctx, fileID, savePath)
	return savePath, err
}

// GetTransfers returns the list of active/recent transfers
func (a *App) GetTransfers() ([]storage.Transfer, error) {
	if a.store == nil {
		return nil, errors.New("database not initialized")
	}
	return a.store.ListTransfers("")
}

// CancelTransfer cancels an ongoing transfer
func (a *App) CancelTransfer(transferID string) bool {
	if a.engine == nil {
		return false
	}
	return a.engine.CancelTransfer(transferID)
}

// ClearCompletedTransfers cleans finished transfers
func (a *App) ClearCompletedTransfers() error {
	if a.store == nil {
		return errors.New("database not initialized")
	}
	return a.store.ClearCompletedTransfers()
}

// GetStreamURL returns the local streaming URL for in-app media playback
func (a *App) GetStreamURL(fileID string) string {
	if a.server == nil {
		return ""
	}
	return a.server.GetStreamURL(fileID)
}

// ExportMetadata exports all metadata to JSON string
func (a *App) ExportMetadata() (string, error) {
	if a.store == nil {
		return "", errors.New("database not initialized")
	}
	manifest, err := a.store.ExportManifest()
	if err != nil {
		return "", err
	}
	b, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// ----------------------------------------------------
// Webhook Shard Management (Multi-Webhook Pooling)
// ----------------------------------------------------

// ListWebhookShards returns all configured webhook shards
func (a *App) ListWebhookShards() ([]storage.WebhookShard, error) {
	if a.store == nil {
		return nil, errors.New("store not initialized")
	}
	return a.store.ListWebhookShards()
}

// CreateWebhookShard adds a new webhook shard to the pool
func (a *App) CreateWebhookShard(name, url, channelID, guildID string, priority int) (*storage.WebhookShard, error) {
	if a.store == nil {
		return nil, errors.New("store not initialized")
	}
	shard, err := a.store.CreateWebhookShard(name, url, channelID, guildID, priority)
	if err == nil && a.engine != nil {
		a.engine.ReloadPool()
	}
	return shard, err
}

// UpdateWebhookShard updates a shard's properties
func (a *App) UpdateWebhookShard(shard storage.WebhookShard) error {
	if a.store == nil {
		return errors.New("store not initialized")
	}
	err := a.store.UpdateWebhookShard(shard)
	if err == nil && a.engine != nil {
		a.engine.ReloadPool()
	}
	return err
}

// DeleteWebhookShard removes a shard from the pool
func (a *App) DeleteWebhookShard(id string) error {
	if a.store == nil {
		return errors.New("store not initialized")
	}
	err := a.store.DeleteWebhookShard(id)
	if err == nil && a.engine != nil {
		a.engine.ReloadPool()
	}
	return err
}

// ----------------------------------------------------
// Background Sync Folders Management
// ----------------------------------------------------

// ListSyncFolders returns all active directory sync bindings
func (a *App) ListSyncFolders() ([]storage.SyncFolder, error) {
	if a.store == nil {
		return nil, errors.New("store not initialized")
	}
	return a.store.ListSyncFolders()
}

// CreateSyncFolder adds a directory for background sync
func (a *App) CreateSyncFolder(localPath string, remoteFolderID *string) (*storage.SyncFolder, error) {
	if a.store == nil {
		return nil, errors.New("store not initialized")
	}
	sf, err := a.store.CreateSyncFolder(localPath, remoteFolderID)
	if err == nil && a.folderWatcher != nil {
		a.folderWatcher.SyncAllFolders()
	}
	return sf, err
}

// UpdateSyncFolder updates a sync directory status or target
func (a *App) UpdateSyncFolder(folder storage.SyncFolder) error {
	if a.store == nil {
		return errors.New("store not initialized")
	}
	return a.store.UpdateSyncFolder(folder)
}

// DeleteSyncFolder removes a directory from background sync
func (a *App) DeleteSyncFolder(id string) error {
	if a.store == nil {
		return errors.New("store not initialized")
	}
	return a.store.DeleteSyncFolder(id)
}

// SyncFoldersNow immediately checks all folders
func (a *App) SyncFoldersNow() error {
	if a.folderWatcher == nil {
		return errors.New("folder watcher not running")
	}
	a.folderWatcher.SyncAllFolders()
	return nil
}

// ----------------------------------------------------
// Zero-Knowledge Sharing & Gateways
// ----------------------------------------------------

// GenerateShareLink creates a zero-knowledge share link for a file
func (a *App) GenerateShareLink(fileID string) (map[string]string, error) {
	if a.store == nil {
		return nil, errors.New("store not initialized")
	}

	file, err := a.store.GetFileWithChunks(fileID)
	if err != nil {
		return nil, err
	}

	settings, _ := a.store.GetAppSettings()
	serverPort := 49152
	if settings != nil && settings.ServerPort > 0 {
		serverPort = settings.ServerPort
	}

	shareKeyHex, _, err := crypto.GenerateShareKey()
	if err != nil {
		return nil, fmt.Errorf("failed to generate share key: %w", err)
	}

	shareURL := fmt.Sprintf("http://127.0.0.1:%d/stream/%s#key=%s", serverPort, file.ID, shareKeyHex)

	return map[string]string{
		"file_id":   file.ID,
		"file_name": file.Name,
		"share_url": shareURL,
		"share_key": shareKeyHex,
	}, nil
}

// GetGatewaysStatus returns runtime statuses for WebDAV and S3 servers
func (a *App) GetGatewaysStatus() map[string]interface{} {
	webdavRunning := false
	webdavPort := 49153
	if a.webdavServer != nil {
		webdavRunning = a.webdavServer.IsRunning()
		webdavPort = a.webdavServer.Port()
	}

	s3Running := false
	s3Port := 49154
	if a.s3Server != nil {
		s3Running = a.s3Server.IsRunning()
		s3Port = a.s3Server.Port()
	}

	return map[string]interface{}{
		"webdav": map[string]interface{}{
			"running": webdavRunning,
			"port":    webdavPort,
			"url":     fmt.Sprintf("http://127.0.0.1:%d/webdav", webdavPort),
		},
		"s3": map[string]interface{}{
			"running": s3Running,
			"port":    s3Port,
			"url":     fmt.Sprintf("http://127.0.0.1:%d", s3Port),
		},
	}
}

// SelectFile opens standard open file dialog
func (a *App) SelectFile() (string, error) {
	return wailsRuntime.OpenFileDialog(a.ctx, wailsRuntime.OpenDialogOptions{
		Title: "Select File",
	})
}

// SelectDirectory opens standard directory picker
func (a *App) SelectDirectory() (string, error) {
	return wailsRuntime.OpenDirectoryDialog(a.ctx, wailsRuntime.OpenDialogOptions{
		Title: "Select Directory",
	})
}

// GetPlatform returns operating system name
func (a *App) GetPlatform() string {
	return runtime.GOOS
}
