package s3

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"wyvern-drive/pkg/discord"
	"wyvern-drive/pkg/engine"
	"wyvern-drive/pkg/storage"
)

func setupTestS3(t *testing.T) (*Server, *storage.Store, *engine.Engine, func()) {
	tmpDir, err := os.MkdirTemp("", "wyvern_s3_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}

	dbPath := filepath.Join(tmpDir, "test.db")
	store, err := storage.NewStore(dbPath)
	if err != nil {
		t.Fatalf("failed to open store: %v", err)
	}

	mockDiscord := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	discordClient := discord.NewClient(mockDiscord.Client())
	eng := engine.NewEngine(store, discordClient)

	s3Server := NewServer(store, eng, 0)

	cleanup := func() {
		mockDiscord.Close()
		_ = store.Close()
		_ = os.RemoveAll(tmpDir)
	}

	return s3Server, store, eng, cleanup
}

func TestS3ListBucketsAndObjects(t *testing.T) {
	s3Server, store, _, cleanup := setupTestS3(t)
	defer cleanup()

	_, _ = store.CreateFolder(nil, "backups", "#10b981", "folder")

	// 1. Test ListBuckets (GET /)
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	s3Server.handleS3Request(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "backups") || !strings.Contains(rec.Body.String(), "wyvern-vault") {
		t.Fatalf("expected XML to contain bucket names, got: %s", rec.Body.String())
	}

	// 2. Test ListObjects (GET /backups)
	reqObj := httptest.NewRequest(http.MethodGet, "/backups", nil)
	recObj := httptest.NewRecorder()
	s3Server.handleS3Request(recObj, reqObj)

	if recObj.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for ListObjects, got %d", recObj.Code)
	}
	if !strings.Contains(recObj.Body.String(), "ListBucketResult") {
		t.Fatalf("expected ListBucketResult XML, got: %s", recObj.Body.String())
	}
}
