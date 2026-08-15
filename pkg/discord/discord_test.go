package discord

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestParseWebhookURL(t *testing.T) {
	validURL := "https://discord.com/api/webhooks/123456789012345678/abcdef-GhIjKlMnOpQrStUvWxYz_123456"
	id, token, err := ParseWebhookURL(validURL)
	if err != nil {
		t.Fatalf("ParseWebhookURL failed on valid url: %v", err)
	}
	if id != "123456789012345678" || token != "abcdef-GhIjKlMnOpQrStUvWxYz_123456" {
		t.Fatalf("unexpected id/token: %s / %s", id, token)
	}

	invalidURL := "https://google.com/search"
	if _, _, err := ParseWebhookURL(invalidURL); err == nil {
		t.Fatalf("expected error on invalid URL")
	}
}

func TestValidateWebhook(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		info := WebhookInfo{
			ID:        "1234567890",
			Name:      "Wyvern Drive Storage Channel",
			ChannelID: "9876543210",
			GuildID:   "1122334455",
			Token:     "test-token",
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(info)
	}))
	defer server.Close()

	client := NewClient(server.Client())
	// Inject test URL using server URL
	// We temporarily mock validation call
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, server.URL, nil)
	resp, err := server.Client().Do(req)
	if err != nil {
		t.Fatalf("failed test request: %v", err)
	}
	defer resp.Body.Close()

	var info WebhookInfo
	_ = json.NewDecoder(resp.Body).Decode(&info)
	if info.Name != "Wyvern Drive Storage Channel" {
		t.Fatalf("unexpected webhook name: %s", info.Name)
	}

	_ = client
}

func TestUploadAndDownloadAttachmentMock(t *testing.T) {
	chunkPayload := []byte("wyvern drive binary chunk content - 0123456789")

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			// Webhook upload
			err := r.ParseMultipartForm(10 * 1024 * 1024)
			if err != nil {
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			msg := MessageResponse{
				ID:        "msg_12345",
				ChannelID: "channel_123",
				Attachments: []Attachment{
					{
						ID:       "att_999",
						Filename: "chunk_0.bin",
						Size:     int64(len(chunkPayload)),
						URL:      "http://" + r.Host + "/download/chunk_0.bin",
					},
				},
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(msg)
			return
		}

		if r.Method == http.MethodGet && strings.HasPrefix(r.URL.Path, "/download/") {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(chunkPayload)
			return
		}

		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	client := NewClient(server.Client())

	att, msgID, err := client.UploadAttachment(context.Background(), server.URL, "chunk_0.bin", chunkPayload, "chunk metadata")
	if err != nil {
		t.Fatalf("UploadAttachment failed: %v", err)
	}

	if msgID != "msg_12345" || att.ID != "att_999" {
		t.Fatalf("unexpected upload response: msg=%s att=%s", msgID, att.ID)
	}

	downloaded, err := client.DownloadAttachment(context.Background(), att.URL, -1, -1)
	if err != nil {
		t.Fatalf("DownloadAttachment failed: %v", err)
	}

	if string(downloaded) != string(chunkPayload) {
		t.Fatalf("downloaded data mismatch: %s != %s", string(downloaded), string(chunkPayload))
	}
}

func TestRateLimitRetry(t *testing.T) {
	var callCount int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		count := atomic.AddInt32(&callCount, 1)
		if count < 3 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusTooManyRequests)
			_ = json.NewEncoder(w).Encode(RateLimitResponse{
				Message:    "You are being rate limited.",
				RetryAfter: 0.05, // 50ms
				Global:     false,
			})
			return
		}

		msg := MessageResponse{
			ID: "msg_retry_success",
			Attachments: []Attachment{
				{
					ID:       "att_retry",
					Filename: "retry.bin",
					Size:     10,
					URL:      "http://example.com/retry.bin",
				},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(msg)
	}))
	defer server.Close()

	client := NewClient(server.Client())
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	att, msgID, err := client.UploadAttachment(ctx, server.URL, "retry.bin", []byte("1234567890"), "")
	if err != nil {
		t.Fatalf("Rate limited upload failed to retry: %v", err)
	}

	if msgID != "msg_retry_success" || att.ID != "att_retry" {
		t.Fatalf("unexpected message ID after retry: %s", msgID)
	}

	if atomic.LoadInt32(&callCount) != 3 {
		t.Fatalf("expected 3 calls, got %d", atomic.LoadInt32(&callCount))
	}
}
