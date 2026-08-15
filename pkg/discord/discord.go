package discord

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
)

var webhookRegex = regexp.MustCompile(`^https?://(?:ptb\.|canary\.)?discord(?:app)?\.com/api/webhooks/(\d+)/([\w-]+)$`)

// WebhookInfo contains metadata returned by Discord when fetching a webhook.
type WebhookInfo struct {
	ID            string `json:"id"`
	Type          int    `json:"type"`
	GuildID       string `json:"guild_id,omitempty"`
	ChannelID     string `json:"channel_id,omitempty"`
	Name          string `json:"name"`
	Avatar        string `json:"avatar,omitempty"`
	Token         string `json:"token"`
	ApplicationID string `json:"application_id,omitempty"`
	LatencyMs     int64  `json:"latency_ms,omitempty"`
}

// Attachment represents a file uploaded to Discord.
type Attachment struct {
	ID          string `json:"id"`
	Filename    string `json:"filename"`
	Size        int64  `json:"size"`
	URL         string `json:"url"`
	ProxyURL    string `json:"proxy_url"`
	ContentType string `json:"content_type"`
}

// MessageResponse is the payload Discord returns when ?wait=true is passed.
type MessageResponse struct {
	ID          string       `json:"id"`
	ChannelID   string       `json:"channel_id"`
	Content     string       `json:"content"`
	Attachments []Attachment `json:"attachments"`
	Timestamp   string       `json:"timestamp"`
}

// RateLimitResponse parses Discord's 429 rate limit response.
type RateLimitResponse struct {
	Message    string  `json:"message"`
	RetryAfter float64 `json:"retry_after"`
	Global     bool    `json:"global"`
}

// Client defines the Discord Webhook client.
type Client struct {
	httpClient *http.Client
	maxRetries int
}

// NewClient creates a new Discord Webhook client.
func NewClient(httpClient *http.Client) *Client {
	if httpClient == nil {
		httpClient = &http.Client{
			Timeout: 120 * time.Second,
		}
	}
	return &Client{
		httpClient: httpClient,
		maxRetries: 5,
	}
}

// ParseWebhookURL verifies the URL structure and extracts ID and Token.
func ParseWebhookURL(rawURL string) (id, token string, err error) {
	rawURL = strings.TrimSpace(rawURL)
	matches := webhookRegex.FindStringSubmatch(rawURL)
	if len(matches) != 3 {
		return "", "", errors.New("invalid Discord webhook URL format (expected: https://discord.com/api/webhooks/<id>/<token>)")
	}
	return matches[1], matches[2], nil
}

// ValidateWebhook tests the webhook URL by executing a GET request and measuring latency.
func (c *Client) ValidateWebhook(ctx context.Context, webhookURL string) (*WebhookInfo, error) {
	_, _, err := ParseWebhookURL(webhookURL)
	if err != nil {
		return nil, err
	}

	start := time.Now()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, webhookURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create validation request: %w", err)
	}
	req.Header.Set("User-Agent", "WyvernDrive/1.0 (Discord Cloud Storage)")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("network error reaching Discord: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Discord rejected webhook (status %d): %s", resp.StatusCode, string(body))
	}

	var info WebhookInfo
	if err := json.Unmarshal(body, &info); err != nil {
		return nil, fmt.Errorf("failed to parse webhook metadata: %w", err)
	}

	info.LatencyMs = time.Since(start).Milliseconds()
	return &info, nil
}

// UploadAttachment uploads a binary chunk as a file attachment to the Discord webhook.
func (c *Client) UploadAttachment(ctx context.Context, webhookURL, filename string, data []byte, description string) (*Attachment, string, error) {
	if len(data) == 0 {
		return nil, "", errors.New("cannot upload empty chunk")
	}

	uploadURL := webhookURL
	if !strings.Contains(uploadURL, "wait=true") {
		if strings.Contains(uploadURL, "?") {
			uploadURL += "&wait=true"
		} else {
			uploadURL += "?wait=true"
		}
	}

	for attempt := 0; attempt <= c.maxRetries; attempt++ {
		var body bytes.Buffer
		writer := multipart.NewWriter(&body)

		// Add JSON payload if description provided
		if description != "" {
			payload := map[string]interface{}{
				"content": description,
			}
			payloadBytes, _ := json.Marshal(payload)
			_ = writer.WriteField("payload_json", string(payloadBytes))
		}

		part, err := writer.CreateFormFile("files[0]", filename)
		if err != nil {
			return nil, "", fmt.Errorf("failed to create form file: %w", err)
		}

		if _, err := part.Write(data); err != nil {
			return nil, "", fmt.Errorf("failed to write chunk payload: %w", err)
		}

		if err := writer.Close(); err != nil {
			return nil, "", fmt.Errorf("failed to close multipart writer: %w", err)
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodPost, uploadURL, &body)
		if err != nil {
			return nil, "", fmt.Errorf("failed to create upload request: %w", err)
		}

		req.Header.Set("Content-Type", writer.FormDataContentType())
		req.Header.Set("User-Agent", "WyvernDrive/1.0 (Discord Cloud Storage)")

		resp, err := c.httpClient.Do(req)
		if err != nil {
			if errors.Is(ctx.Err(), context.Canceled) {
				return nil, "", ctx.Err()
			}
			if attempt < c.maxRetries {
				time.Sleep(time.Duration(1<<attempt) * 500 * time.Millisecond)
				continue
			}
			return nil, "", fmt.Errorf("upload network error: %w", err)
		}

		respBody, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			return nil, "", fmt.Errorf("failed to read upload response: %w", err)
		}

		// Handle Rate Limiting (429)
		if resp.StatusCode == http.StatusTooManyRequests {
			var rl RateLimitResponse
			retryDelay := time.Duration(1<<attempt) * time.Second
			if jsonErr := json.Unmarshal(respBody, &rl); jsonErr == nil && rl.RetryAfter > 0 {
				retryDelay = time.Duration(rl.RetryAfter*1000) * time.Millisecond
			}

			select {
			case <-ctx.Done():
				return nil, "", ctx.Err()
			case <-time.After(retryDelay):
				continue
			}
		}

		if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
			return nil, "", fmt.Errorf("Discord upload error (status %d): %s", resp.StatusCode, string(respBody))
		}

		var msgResp MessageResponse
		if err := json.Unmarshal(respBody, &msgResp); err != nil {
			return nil, "", fmt.Errorf("failed to parse upload response: %w", err)
		}

		if len(msgResp.Attachments) == 0 {
			return nil, "", errors.New("Discord response did not contain any attachments")
		}

		return &msgResp.Attachments[0], msgResp.ID, nil
	}

	return nil, "", errors.New("exceeded maximum retries for chunk upload")
}

// DownloadAttachment fetches chunk bytes from the Discord CDN URL.
func (c *Client) DownloadAttachment(ctx context.Context, downloadURL string, startOffset, endOffset int64) ([]byte, error) {
	parsedURL, err := url.Parse(downloadURL)
	if err != nil {
		return nil, fmt.Errorf("invalid download URL: %w", err)
	}

	for attempt := 0; attempt <= c.maxRetries; attempt++ {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, parsedURL.String(), nil)
		if err != nil {
			return nil, fmt.Errorf("failed to create download request: %w", err)
		}

		req.Header.Set("User-Agent", "WyvernDrive/1.0 (Discord Cloud Storage)")
		if startOffset >= 0 && endOffset >= startOffset {
			req.Header.Set("Range", fmt.Sprintf("bytes=%d-%d", startOffset, endOffset))
		}

		resp, err := c.httpClient.Do(req)
		if err != nil {
			if errors.Is(ctx.Err(), context.Canceled) {
				return nil, ctx.Err()
			}
			if attempt < c.maxRetries {
				time.Sleep(time.Duration(1<<attempt) * 500 * time.Millisecond)
				continue
			}
			return nil, fmt.Errorf("download network error: %w", err)
		}

		if resp.StatusCode == http.StatusTooManyRequests {
			resp.Body.Close()
			time.Sleep(time.Duration(1<<attempt) * time.Second)
			continue
		}

		if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusPartialContent {
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			return nil, fmt.Errorf("Discord CDN download error (status %d): %s", resp.StatusCode, string(body))
		}

		data, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			return nil, fmt.Errorf("failed to read download stream: %w", err)
		}

		return data, nil
	}

	return nil, errors.New("exceeded maximum retries downloading attachment")
}

// DeleteMessage deletes a chunk message on Discord given the webhook and message ID.
func (c *Client) DeleteMessage(ctx context.Context, webhookURL, messageID string) error {
	id, token, err := ParseWebhookURL(webhookURL)
	if err != nil {
		return err
	}

	deleteURL := fmt.Sprintf("https://discord.com/api/webhooks/%s/%s/messages/%s", id, token, url.PathEscape(messageID))
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, deleteURL, nil)
	if err != nil {
		return fmt.Errorf("failed to create delete request: %w", err)
	}

	req.Header.Set("User-Agent", "WyvernDrive/1.0 (Discord Cloud Storage)")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("delete message network error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNoContent || resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusNotFound {
		return nil
	}

	body, _ := io.ReadAll(resp.Body)
	return fmt.Errorf("failed to delete message (status %d): %s", resp.StatusCode, string(body))
}

// RefreshAttachmentURL parses expired attachment URLs if query signatures expire, or returns current URL.
func RefreshAttachmentURL(rawURL string) string {
	return strings.TrimSpace(rawURL)
}

// FormatBytes formats byte count into human-readable representation.
func FormatBytes(b int64) string {
	const unit = 1024
	if b < unit {
		return fmt.Sprintf("%d B", b)
	}
	div, exp := int64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.2f %cB", float64(b)/float64(div), "KMGTPE"[exp])
}

// ParseBytes converts string like "20MB" to bytes
func ParseBytes(str string) (int64, error) {
	str = strings.TrimSpace(strings.ToUpper(str))
	if strings.HasSuffix(str, "MB") {
		val, err := strconv.ParseInt(strings.TrimSuffix(str, "MB"), 10, 64)
		if err != nil {
			return 0, err
		}
		return val * 1024 * 1024, nil
	}
	if strings.HasSuffix(str, "GB") {
		val, err := strconv.ParseInt(strings.TrimSuffix(str, "GB"), 10, 64)
		if err != nil {
			return 0, err
		}
		return val * 1024 * 1024 * 1024, nil
	}
	return strconv.ParseInt(str, 10, 64)
}
