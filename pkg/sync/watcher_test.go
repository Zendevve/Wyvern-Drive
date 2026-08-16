package sync

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"wyvern-drive/pkg/discord"
	"wyvern-drive/pkg/engine"
	"wyvern-drive/pkg/storage"
)

func setupTestWatcher(t *testing.T) (*FolderWatcher, *storage.Store, string, func()) {
	tmpDir, err := os.MkdirTemp("", "wyvern_watcher_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}

	syncDir := filepath.Join(tmpDir, "sync_folder")
	_ = os.MkdirAll(syncDir, 0755)

	dbPath := filepath.Join(tmpDir, "test.db")
	store, err := storage.NewStore(dbPath)
	if err != nil {
		t.Fatalf("failed to open store: %v", err)
	}

	mockDiscord := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"id":"msg_sync","attachments":[{"id":"att_sync","url":"http://example.com/sync"}]}`))
	}))

	_ = store.SaveAppSettings(&storage.AppSettings{
		WebhookURL:        mockDiscord.URL,
		SetupCompleted:    true,
		EncryptionEnabled: false,
	})

	discordClient := discord.NewClient(mockDiscord.Client())
	eng := engine.NewEngine(store, discordClient)

	watcher := NewFolderWatcher(store, eng, 100*time.Millisecond)

	cleanup := func() {
		watcher.Stop()
		mockDiscord.Close()
		_ = store.Close()
		_ = os.RemoveAll(tmpDir)
	}

	return watcher, store, syncDir, cleanup
}

func TestFolderWatcherSync(t *testing.T) {
	watcher, store, syncDir, cleanup := setupTestWatcher(t)
	defer cleanup()

	// Register sync folder
	sf, err := store.CreateSyncFolder(syncDir, nil)
	if err != nil {
		t.Fatalf("failed to create sync folder: %v", err)
	}

	// Create test file in syncDir
	testFilePath := filepath.Join(syncDir, "auto_synced_document.pdf")
	_ = os.WriteFile(testFilePath, []byte("test pdf document payload"), 0644)

	// Trigger sync
	err = watcher.SyncFolder(*sf)
	if err != nil {
		t.Fatalf("SyncFolder returned error: %v", err)
	}

	// Verify file was recorded in vault
	files, _, err := store.ListFiles(nil, "all", "name", "ASC", 10, 0)
	if err != nil || len(files) != 1 || files[0].Name != "auto_synced_document.pdf" {
		t.Fatalf("expected auto_synced_document.pdf in vault, got: %+v (err: %v)", files, err)
	}
}
