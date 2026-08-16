package webdav

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"wyvern-drive/pkg/discord"
	"wyvern-drive/pkg/engine"
	"wyvern-drive/pkg/storage"
)

func setupTestWebDAV(t *testing.T) (*Server, *storage.Store, *engine.Engine, func()) {
	tmpDir, err := os.MkdirTemp("", "wyvern_webdav_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}

	dbPath := filepath.Join(tmpDir, "test.db")
	store, err := storage.NewStore(dbPath)
	if err != nil {
		t.Fatalf("failed to open store: %v", err)
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	discordClient := discord.NewClient(server.Client())
	eng := engine.NewEngine(store, discordClient)

	webdavServer := NewServer(store, eng, 0) // Port will be bound by test

	cleanup := func() {
		server.Close()
		_ = store.Close()
		_ = os.RemoveAll(tmpDir)
	}

	return webdavServer, store, eng, cleanup
}

func TestWebDAVBasicOperations(t *testing.T) {
	_, store, eng, cleanup := setupTestWebDAV(t)
	defer cleanup()

	fs := &wyvernFS{
		store:  store,
		engine: eng,
	}

	ctx := context.Background()

	// 1. Stat root
	info, err := fs.Stat(ctx, "/")
	if err != nil || !info.IsDir() {
		t.Fatalf("failed to stat root directory: %v", err)
	}

	// 2. Mkdir
	err = fs.Mkdir(ctx, "/Projects", 0755)
	if err != nil {
		t.Fatalf("failed to create directory via WebDAV: %v", err)
	}

	// 3. Stat created folder
	folderInfo, err := fs.Stat(ctx, "/Projects")
	if err != nil || !folderInfo.IsDir() || folderInfo.Name() != "Projects" {
		t.Fatalf("failed to stat created folder: %v", err)
	}

	// 4. Rename folder
	err = fs.Rename(ctx, "/Projects", "/ArchivedProjects")
	if err != nil {
		t.Fatalf("failed to rename folder via WebDAV: %v", err)
	}

	// 5. Remove folder
	err = fs.RemoveAll(ctx, "/ArchivedProjects")
	if err != nil {
		t.Fatalf("failed to remove folder via WebDAV: %v", err)
	}
}
