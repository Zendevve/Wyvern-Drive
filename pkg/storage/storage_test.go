package storage

import (
	"os"
	"path/filepath"
	"testing"
)

func createTestStore(t *testing.T) (*Store, func()) {
	tmpDir, err := os.MkdirTemp("", "wyvern_storage_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}

	dbPath := filepath.Join(tmpDir, "test_wyvern.db")
	store, err := NewStore(dbPath)
	if err != nil {
		_ = os.RemoveAll(tmpDir)
		t.Fatalf("failed to create store: %v", err)
	}

	cleanup := func() {
		_ = store.Close()
		_ = os.RemoveAll(tmpDir)
	}

	return store, cleanup
}

func TestFoldersCRUD(t *testing.T) {
	store, cleanup := createTestStore(t)
	defer cleanup()

	// 1. Create root folder
	rootFolder, err := store.CreateFolder(nil, "Documents", "#3b82f6", "folder")
	if err != nil {
		t.Fatalf("failed to create folder: %v", err)
	}
	if rootFolder.Name != "Documents" || rootFolder.Path != "/Documents" {
		t.Fatalf("unexpected folder data: %+v", rootFolder)
	}

	// 2. Create sub folder
	subFolder, err := store.CreateFolder(&rootFolder.ID, "Invoices", "#10b981", "folder")
	if err != nil {
		t.Fatalf("failed to create subfolder: %v", err)
	}
	if subFolder.Path != "/Documents/Invoices" {
		t.Fatalf("unexpected subfolder path: %s", subFolder.Path)
	}

	// 3. List root folders
	roots, err := store.ListFolders(nil)
	if err != nil {
		t.Fatalf("failed to list root folders: %v", err)
	}
	if len(roots) != 1 || roots[0].ID != rootFolder.ID {
		t.Fatalf("expected 1 root folder, got %d", len(roots))
	}

	// 4. List subfolders
	subs, err := store.ListFolders(&rootFolder.ID)
	if err != nil {
		t.Fatalf("failed to list subfolders: %v", err)
	}
	if len(subs) != 1 || subs[0].ID != subFolder.ID {
		t.Fatalf("expected 1 subfolder, got %d", len(subs))
	}
}

func TestFilesAndChunksCRUD(t *testing.T) {
	store, cleanup := createTestStore(t)
	defer cleanup()

	// Create test file
	file := &File{
		Name:        "archive.zip",
		Size:        50 * 1024 * 1024,
		MimeType:    "application/zip",
		SHA256:      "a1b2c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef0123",
		IsEncrypted: true,
		ChunkCount:  3,
		ChunkSize:   18 * 1024 * 1024,
		Status:      StatusCompleted,
		Favorite:    true,
	}

	err := store.CreateFile(file)
	if err != nil {
		t.Fatalf("failed to create file: %v", err)
	}

	// Batch insert chunks
	chunks := []Chunk{
		{
			FileID:        file.ID,
			ChunkIndex:    0,
			MessageID:     "msg_0",
			AttachmentID:  "att_0",
			AttachmentURL: "https://discord.com/att_0",
			Size:          18 * 1024 * 1024,
			ChunkHash:     "hash0",
			Nonce:         "00112233445566778899aabb",
		},
		{
			FileID:        file.ID,
			ChunkIndex:    1,
			MessageID:     "msg_1",
			AttachmentID:  "att_1",
			AttachmentURL: "https://discord.com/att_1",
			Size:          18 * 1024 * 1024,
			ChunkHash:     "hash1",
			Nonce:         "112233445566778899aabbcc",
		},
		{
			FileID:        file.ID,
			ChunkIndex:    2,
			MessageID:     "msg_2",
			AttachmentID:  "att_2",
			AttachmentURL: "https://discord.com/att_2",
			Size:          14 * 1024 * 1024,
			ChunkHash:     "hash2",
			Nonce:         "2233445566778899aabbccdd",
		},
	}

	err = store.CreateChunksBatch(chunks)
	if err != nil {
		t.Fatalf("failed to batch create chunks: %v", err)
	}

	// Fetch file with chunks
	fullFile, err := store.GetFileWithChunks(file.ID)
	if err != nil {
		t.Fatalf("failed to get file with chunks: %v", err)
	}

	if len(fullFile.Chunks) != 3 {
		t.Fatalf("expected 3 chunks, got %d", len(fullFile.Chunks))
	}
	if fullFile.Chunks[1].AttachmentID != "att_1" {
		t.Fatalf("unexpected chunk order or data: %s", fullFile.Chunks[1].AttachmentID)
	}

	// Test Search
	searchResults, err := store.SearchFiles("archive")
	if err != nil {
		t.Fatalf("search failed: %v", err)
	}
	if len(searchResults) != 1 || searchResults[0].ID != file.ID {
		t.Fatalf("expected 1 search result, got %d", len(searchResults))
	}

	// Test Favorite filter
	favs, total, err := store.ListFiles(nil, "favorites", "name", "ASC", 10, 0)
	if err != nil {
		t.Fatalf("failed to list favorites: %v", err)
	}
	if total != 1 || len(favs) != 1 {
		t.Fatalf("expected 1 favorite, got %d (total: %d)", len(favs), total)
	}

	// Test Stats
	stats, err := store.GetStats()
	if err != nil {
		t.Fatalf("failed to get stats: %v", err)
	}
	if stats.TotalFiles != 1 || stats.TotalChunks != 3 || stats.TotalBytes != file.Size {
		t.Fatalf("unexpected stats: %+v", stats)
	}
}

func TestSettings(t *testing.T) {
	store, cleanup := createTestStore(t)
	defer cleanup()

	settings, err := store.GetAppSettings()
	if err != nil {
		t.Fatalf("failed to get default settings: %v", err)
	}

	settings.WebhookURL = "https://discord.com/api/webhooks/123/abc"
	settings.MasterKey = "my-secret-key"
	settings.SetupCompleted = true

	err = store.SaveAppSettings(settings)
	if err != nil {
		t.Fatalf("failed to save settings: %v", err)
	}

	loaded, err := store.GetAppSettings()
	if err != nil {
		t.Fatalf("failed to load saved settings: %v", err)
	}

	if loaded.WebhookURL != settings.WebhookURL || !loaded.SetupCompleted || loaded.MasterKey != settings.MasterKey {
		t.Fatalf("saved settings mismatch: %+v", loaded)
	}
}
