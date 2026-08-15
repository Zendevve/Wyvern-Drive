package server

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"wyvern-drive/pkg/discord"
	"wyvern-drive/pkg/engine"
	"wyvern-drive/pkg/storage"
)

func setupStreamingServerTest(t *testing.T) (*Server, *engine.Engine, *storage.Store, []byte, string, func()) {
	tmpDir, err := os.MkdirTemp("", "wyvern_server_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}

	dbPath := filepath.Join(tmpDir, "server_test.db")
	store, err := storage.NewStore(dbPath)
	if err != nil {
		_ = os.RemoveAll(tmpDir)
		t.Fatalf("failed to create store: %v", err)
	}

	var mu sync.Mutex
	attachments := make(map[string][]byte)
	var attCounter int

	mockDiscord := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			_ = r.ParseMultipartForm(32 * 1024 * 1024)
			file, header, _ := r.FormFile("files[0]")
			defer file.Close()

			var buf bytes.Buffer
			_, _ = buf.ReadFrom(file)

			mu.Lock()
			attCounter++
			attID := fmt.Sprintf("att_%d", attCounter)
			attachments[attID] = buf.Bytes()
			mu.Unlock()

			msg := discord.MessageResponse{
				ID: fmt.Sprintf("msg_%d", attCounter),
				Attachments: []discord.Attachment{
					{
						ID:       attID,
						Filename: header.Filename,
						Size:     int64(buf.Len()),
						URL:      "http://" + r.Host + "/attachments/" + attID,
					},
				},
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(msg)
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
			_, _ = w.Write(data)
			return
		}

		w.WriteHeader(http.StatusNotFound)
	}))

	_ = store.SaveAppSettings(&storage.AppSettings{
		WebhookURL:        mockDiscord.URL,
		MasterKey:         "streaming-server-secret-key-12345",
		EncryptionEnabled: true,
		ChunkSizeBytes:    32 * 1024, // 32KB
		SetupCompleted:    true,
	})

	discordClient := discord.NewClient(mockDiscord.Client())
	eng := engine.NewEngine(store, discordClient)

	// Create test file (100KB of video simulation data)
	testContent := make([]byte, 100*1024)
	for i := range testContent {
		testContent[i] = byte(i % 256)
	}

	tmpFile, _ := os.CreateTemp("", "test_stream_*.mp4")
	_, _ = tmpFile.Write(testContent)
	tmpFile.Close()

	fileRecord, err := eng.UploadFile(context.Background(), tmpFile.Name(), engine.UploadOptions{
		CustomName: "sample_video.mp4",
	})
	_ = os.Remove(tmpFile.Name())

	if err != nil {
		t.Fatalf("failed to upload sample file for streaming: %v", err)
	}

	srv := NewServer(store, eng, 0) // Port 0 chooses random available port
	if err := srv.Start(); err != nil {
		t.Fatalf("failed to start server: %v", err)
	}

	cleanup := func() {
		_ = srv.Stop(context.Background())
		mockDiscord.Close()
		_ = store.Close()
		_ = os.RemoveAll(tmpDir)
	}

	return srv, eng, store, testContent, fileRecord.ID, cleanup
}

func TestServerHealth(t *testing.T) {
	srv, _, _, _, _, cleanup := setupStreamingServerTest(t)
	defer cleanup()

	url := fmt.Sprintf("http://127.0.0.1:%d/api/health", srv.Port())
	resp, err := http.Get(url)
	if err != nil {
		t.Fatalf("GET /api/health failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", resp.StatusCode)
	}

	var data map[string]interface{}
	_ = json.NewDecoder(resp.Body).Decode(&data)
	if data["status"] != "ok" {
		t.Fatalf("unexpected health response: %+v", data)
	}
}

func TestServerFullStreamAndRangeRequests(t *testing.T) {
	srv, _, _, originalData, fileID, cleanup := setupStreamingServerTest(t)
	defer cleanup()

	streamURL := srv.GetStreamURL(fileID)

	// 1. Full Stream GET
	req, _ := http.NewRequest(http.MethodGet, streamURL, nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("stream GET failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("failed to read stream body: %v", err)
	}

	if !bytes.Equal(body, originalData) {
		t.Fatalf("stream data mismatch: len(body)=%d != len(original)=%d", len(body), len(originalData))
	}

	// 2. HTTP Range Request (bytes=1000-4999)
	rangeReq, _ := http.NewRequest(http.MethodGet, streamURL, nil)
	rangeReq.Header.Set("Range", "bytes=1000-4999")

	rangeResp, err := http.DefaultClient.Do(rangeReq)
	if err != nil {
		t.Fatalf("range GET failed: %v", err)
	}
	defer rangeResp.Body.Close()

	if rangeResp.StatusCode != http.StatusPartialContent {
		t.Fatalf("expected 206 Partial Content, got %d", rangeResp.StatusCode)
	}

	contentRange := rangeResp.Header.Get("Content-Range")
	expectedRangeHeader := fmt.Sprintf("bytes 1000-4999/%d", len(originalData))
	if contentRange != expectedRangeHeader {
		t.Fatalf("unexpected Content-Range header: got %s, expected %s", contentRange, expectedRangeHeader)
	}

	rangeBody, err := io.ReadAll(rangeResp.Body)
	if err != nil {
		t.Fatalf("failed reading range body: %v", err)
	}

	if len(rangeBody) != 4000 {
		t.Fatalf("expected 4000 bytes, got %d", len(rangeBody))
	}

	if !bytes.Equal(rangeBody, originalData[1000:5000]) {
		t.Fatalf("range body content mismatch")
	}
}

func TestServerDirectDownload(t *testing.T) {
	srv, _, _, originalData, fileID, cleanup := setupStreamingServerTest(t)
	defer cleanup()

	downloadURL := fmt.Sprintf("http://127.0.0.1:%d/api/download/%s", srv.Port(), fileID)
	resp, err := http.Get(downloadURL)
	if err != nil {
		t.Fatalf("direct download failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", resp.StatusCode)
	}

	disp := resp.Header.Get("Content-Disposition")
	if !strings.Contains(disp, "sample_video.mp4") {
		t.Fatalf("missing filename in Content-Disposition: %s", disp)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("failed reading direct download body: %v", err)
	}

	if !bytes.Equal(body, originalData) {
		t.Fatalf("downloaded data mismatch")
	}
}
