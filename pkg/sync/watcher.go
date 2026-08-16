package sync

import (
	"context"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sync"
	"time"

	"wyvern-drive/pkg/engine"
	"wyvern-drive/pkg/storage"
)

// FolderWatcher monitors registered local directories and automatically uploads new/modified files.
type FolderWatcher struct {
	store    *storage.Store
	engine   *engine.Engine
	mu       sync.Mutex
	stopChan chan struct{}
	running  bool
	interval time.Duration
}

// NewFolderWatcher creates a new background folder sync manager.
func NewFolderWatcher(store *storage.Store, eng *engine.Engine, pollInterval time.Duration) *FolderWatcher {
	if pollInterval <= 0 {
		pollInterval = 10 * time.Second
	}
	return &FolderWatcher{
		store:    store,
		engine:   eng,
		interval: pollInterval,
	}
}

// Start begins background directory monitoring.
func (w *FolderWatcher) Start() {
	w.mu.Lock()
	defer w.mu.Unlock()

	if w.running {
		return
	}

	w.running = true
	w.stopChan = make(chan struct{})

	go w.pollLoop()
}

// Stop halts background directory monitoring.
func (w *FolderWatcher) Stop() {
	w.mu.Lock()
	defer w.mu.Unlock()

	if !w.running {
		return
	}

	w.running = false
	close(w.stopChan)
}

// IsRunning returns whether the watcher is active.
func (w *FolderWatcher) IsRunning() bool {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.running
}

func (w *FolderWatcher) pollLoop() {
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	// Initial sync run immediately
	w.SyncAllFolders()

	for {
		select {
		case <-w.stopChan:
			return
		case <-ticker.C:
			w.SyncAllFolders()
		}
	}
}

// SyncAllFolders triggers an immediate sync check on all active folders.
func (w *FolderWatcher) SyncAllFolders() {
	folders, err := w.store.ListSyncFolders()
	if err != nil {
		return
	}

	for _, sf := range folders {
		if !sf.Enabled {
			continue
		}
		_ = w.SyncFolder(sf)
	}
}

// SyncFolder scans a single directory and uploads new or modified files.
func (w *FolderWatcher) SyncFolder(sf storage.SyncFolder) error {
	info, err := os.Stat(sf.LocalPath)
	if err != nil || !info.IsDir() {
		sf.SyncStatus = "error"
		_ = w.store.UpdateSyncFolder(sf)
		return fmt.Errorf("sync directory inaccessible: %w", err)
	}

	sf.SyncStatus = "syncing"
	_ = w.store.UpdateSyncFolder(sf)

	existingFiles, _, _ := w.store.ListFiles(sf.RemoteFolderID, "all", "name", "ASC", 10000, 0)
	fileMap := make(map[string]storage.File)
	for _, f := range existingFiles {
		fileMap[f.Name] = f
	}

	err = filepath.WalkDir(sf.LocalPath, func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil || d.IsDir() {
			return nil
		}

		fileInfo, statErr := d.Info()
		if statErr != nil {
			return nil
		}

		fileName := d.Name()
		// Skip temporary or hidden files
		if len(fileName) > 0 && (fileName[0] == '.' || fileName[0] == '~') {
			return nil
		}

		existing, exists := fileMap[fileName]
		if !exists || existing.Size != fileInfo.Size() {
			// Upload new or changed file
			_, upErr := w.engine.UploadFile(context.Background(), path, engine.UploadOptions{
				FolderID:   sf.RemoteFolderID,
				CustomName: fileName,
			})
			if upErr != nil {
				return nil
			}
		}

		return nil
	})

	sf.SyncStatus = "idle"
	sf.LastSyncTime = time.Now()
	_ = w.store.UpdateSyncFolder(sf)
	return err
}
