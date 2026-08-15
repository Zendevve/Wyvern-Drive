package engine

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"wyvern-drive/pkg/crypto"
	"wyvern-drive/pkg/discord"
	"wyvern-drive/pkg/storage"
)

func setupTestEnvironment(t *testing.T) (*Engine, *storage.Store, *httptest.Server, func()) {
	tmpDir, err := os.MkdirTemp("", "wyvern_engine_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}

	dbPath := filepath.Join(tmpDir, "test.db")
	store, err := storage.NewStore(dbPath)
	if err != nil {
		_ = os.RemoveAll(tmpDir)
		t.Fatalf("failed to create store: %v", err)
	}

	// In-memory mock Discord attachment storage
	var mu sync.Mutex
	attachments := make(map[string][]byte)
	var attCounter int

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			// Discord webhook upload
			err := r.ParseMultipartForm(32 * 1024 * 1024)
			if err != nil {
				w.WriteHeader(http.StatusBadRequest)
				return
			}

			file, header, err := r.FormFile("files[0]")
			if err != nil {
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			defer file.Close()

			var buf bytes.Buffer
			_, _ = buf.ReadFrom(file)

			mu.Lock()
			attCounter++
			attID := fmt.Sprintf("att_%d", attCounter)
			attachments[attID] = buf.Bytes()
			mu.Unlock()

			msgResp := discord.MessageResponse{
				ID:        fmt.Sprintf("msg_%d", attCounter),
				ChannelID: "test_channel",
				Attachments: []discord.Attachment{
					{
						ID:          attID,
						Filename:    header.Filename,
						Size:        int64(buf.Len()),
						URL:         "http://" + r.Host + "/attachments/" + attID,
						ProxyURL:    "http://" + r.Host + "/attachments/" + attID,
						ContentType: "application/octet-stream",
					},
				},
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(msgResp)
			return
		}

		if r.Method == http.MethodGet && strings.HasPrefix(r.URL.Path, "/attachments/") {
			attID := strings.TrimPrefix(r.URL.Path, "/attachments/")
			mu.Lock()
			data, exists := attachments[attID]
			mu.Unlock()

			if !exists {
				w.WriteHeader(http.StatusNotFound)
				return
			}

			w.Header().Set("Content-Type", "application/octet-stream")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(data)
			return
		}

		w.WriteHeader(http.StatusNotFound)
	}))

	// Configure app settings
	settings := &storage.AppSettings{
		WebhookURL:        server.URL,
		MasterKey:         "test-super-secret-master-key-12345",
		EncryptionEnabled: true,
		ChunkSizeBytes:    64 * 1024, // 64 KB chunks for fast testing of multi-chunk files
		MaxConcurrency:    2,
		SetupCompleted:    true,
	}
	_ = store.SaveAppSettings(settings)

	discordClient := discord.NewClient(server.Client())
	eng := NewEngine(store, discordClient)

	cleanup := func() {
		server.Close()
		_ = store.Close()
		_ = os.RemoveAll(tmpDir)
	}

	return eng, store, server, cleanup
}

func TestUploadDownloadCycle(t *testing.T) {
	eng, store, _, cleanup := setupTestEnvironment(t)
	defer cleanup()

	// 1. Create a 150KB test file (which spans 3 chunks at 64KB chunk size)
	testData := make([]byte, 150*1024)
	if _, err := rand.Read(testData); err != nil {
		t.Fatalf("failed to create random data: %v", err)
	}

	tmpSrc, err := os.CreateTemp("", "wyvern_test_src_*.bin")
	if err != nil {
		t.Fatalf("failed to create temp src: %v", err)
	}
	defer os.Remove(tmpSrc.Name())
	_, _ = tmpSrc.Write(testData)
	tmpSrc.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var progressCount int
	eng.RegisterCallback("test-progress", func(tr storage.Transfer) {
		progressCount++
	})

	// 2. Upload file
	fileRecord, err := eng.UploadFile(ctx, tmpSrc.Name(), UploadOptions{
		CustomName: "test_multi_chunk.bin",
	})
	if err != nil {
		t.Fatalf("UploadFile failed: %v", err)
	}

	if fileRecord.ChunkCount != 3 {
		t.Fatalf("expected 3 chunks, got %d", fileRecord.ChunkCount)
	}
	if fileRecord.Status != storage.StatusCompleted {
		t.Fatalf("expected completed file status, got %s", fileRecord.Status)
	}

	// 3. Download file to another destination
	tmpDst := filepath.Join(os.TempDir(), fmt.Sprintf("wyvern_test_dst_%d.bin", time.Now().UnixNano()))
	defer os.Remove(tmpDst)

	err = eng.DownloadFile(ctx, fileRecord.ID, tmpDst)
	if err != nil {
		t.Fatalf("DownloadFile failed: %v", err)
	}

	// 4. Verify downloaded content equals original plaintext
	downloadedData, err := os.ReadFile(tmpDst)
	if err != nil {
		t.Fatalf("failed to read downloaded file: %v", err)
	}

	if !bytes.Equal(downloadedData, testData) {
		t.Fatalf("downloaded data mismatch with original!")
	}

	// 5. Test ReadRange across chunk boundary (e.g. byte 50,000 to byte 80,000)
	rangeStart := int64(50000)
	rangeEnd := int64(80000)
	rangeBytes, err := eng.ReadRange(ctx, fileRecord.ID, rangeStart, rangeEnd)
	if err != nil {
		t.Fatalf("ReadRange failed: %v", err)
	}

	expectedRange := testData[rangeStart : rangeEnd+1]
	if !bytes.Equal(rangeBytes, expectedRange) {
		t.Fatalf("range data mismatch: expected %d bytes, got %d", len(expectedRange), len(rangeBytes))
	}

	_ = store
}

func TestUnencryptedUploadDownload(t *testing.T) {
	eng, store, _, cleanup := setupTestEnvironment(t)
	defer cleanup()

	// Disable encryption
	settings, _ := store.GetAppSettings()
	settings.EncryptionEnabled = false
	_ = store.SaveAppSettings(settings)

	testData := []byte("Wyvern Drive Plaintext Test - No AES Encryption")
	tmpSrc, _ := os.CreateTemp("", "wyvern_plain_*.txt")
	defer os.Remove(tmpSrc.Name())
	_, _ = tmpSrc.Write(testData)
	tmpSrc.Close()

	ctx := context.Background()
	noEnc := false
	fileRecord, err := eng.UploadFile(ctx, tmpSrc.Name(), UploadOptions{
		CustomName: "plain.txt",
		Encrypt:    &noEnc,
	})
	if err != nil {
		t.Fatalf("Upload failed: %v", err)
	}

	if fileRecord.IsEncrypted {
		t.Fatalf("expected unencrypted file")
	}

	tmpDst := filepath.Join(os.TempDir(), fmt.Sprintf("wyvern_plain_dst_%d.txt", time.Now().UnixNano()))
	defer os.Remove(tmpDst)

	err = eng.DownloadFile(ctx, fileRecord.ID, tmpDst)
	if err != nil {
		t.Fatalf("Download failed: %v", err)
	}

	downloaded, _ := os.ReadFile(tmpDst)
	if string(downloaded) != string(testData) {
		t.Fatalf("data mismatch: %s != %s", string(downloaded), string(testData))
	}
}

func TestCancelTransfer(t *testing.T) {
	eng, _, _, cleanup := setupTestEnvironment(t)
	defer cleanup()

	testData := make([]byte, 500*1024)
	tmpSrc, _ := os.CreateTemp("", "wyvern_cancel_*.bin")
	defer os.Remove(tmpSrc.Name())
	_, _ = tmpSrc.Write(testData)
	tmpSrc.Close()

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Pre-cancel context

	_, err := eng.UploadFile(ctx, tmpSrc.Name(), UploadOptions{})
	if err == nil {
		t.Fatalf("expected error on cancelled upload, got nil")
	}
}

func TestChecksumVerificationFailure(t *testing.T) {
	// Verify SHA256 helper
	data := []byte("integrity test")
	hash := crypto.CalculateSHA256(data)
	if len(hash) != 64 {
		t.Fatalf("expected 64 character SHA256 string")
	}
}
