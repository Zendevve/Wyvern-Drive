# Backend Architecture & Package Reference

This document provides a technical reference for the core Go packages powering the Wyvern Drive engine.

```
wyvern-drive/
├── main.go               # Desktop runtime entrypoint & Wails window config
├── app.go                # Wails inter-process bridge & frontend API bindings
└── pkg/
    ├── crypto/           # AES-256-GCM encryption & Argon2id key derivation
    ├── discord/          # Discord Webhook API client & rate-limiting logic
    ├── storage/          # SQLite WAL store & metadata persistence
    ├── engine/           # Chunking, concurrent transfer & Range pipelines
    └── server/           # Embedded local HTTP media streaming server
```

---

## 1. Package `pkg/crypto`

Provides client-side cryptographic primitives and hashing functions.

### Constants
```go
const (
    SaltSize  = 16 // Byte length for cryptographic salt
    NonceSize = 12 // Standard 12-byte GCM nonce length
    KeySize   = 32 // 32 bytes (256-bit) AES key length
)
```

### Functions
- `DeriveKey(passphrase string, salt []byte) []byte`: Uses Argon2id (Memory: 64MB, Iterations: 1, Threads: 4, Output: 32 bytes) with deterministic domain separation if salt is nil.
- `GenerateRandomKey() (string, error)`: Generates a cryptographically secure 32-byte hex-encoded string.
- `EncryptChunk(plaintext []byte, key []byte) (ciphertext []byte, nonce []byte, err error)`: Encrypts plaintext using AES-256-GCM. Returns sealed ciphertext with authentication tag and a fresh 12-byte nonce.
- `DecryptChunk(ciphertext []byte, key []byte, nonce []byte) ([]byte, error)`: Verifies authentication tag and decrypts ciphertext. Returns an error if ciphertext was tampered with.
- `CalculateSHA256(data []byte) string`: Computes hex-encoded SHA-256 hash of a byte slice.
- `CalculateStreamSHA256(r io.Reader) (string, error)`: Computes SHA-256 checksum from any `io.Reader` without loading the full file into memory.

---

## 2. Package `pkg/discord`

Implements the Discord Webhook client, multipart attachment uploader, and rate-limiting handler.

### Key Types
```go
type WebhookInfo struct {
    ID        string `json:"id"`
    Name      string `json:"name"`
    ChannelID string `json:"channel_id,omitempty"`
    GuildID   string `json:"guild_id,omitempty"`
    Token     string `json:"token"`
    LatencyMs int64  `json:"latency_ms,omitempty"`
}

type Attachment struct {
    ID          string `json:"id"`
    Filename    string `json:"filename"`
    Size        int64  `json:"size"`
    URL         string `json:"url"`
    ProxyURL    string `json:"proxy_url"`
    ContentType string `json:"content_type"`
}
```

### Methods on `Client`
- `NewClient(httpClient *http.Client) *Client`: Creates a configured Discord Webhook client.
- `ValidateWebhook(ctx context.Context, webhookURL string) (*WebhookInfo, error)`: Validates URL structure and performs a `GET` request to measure latency.
- `UploadAttachment(ctx context.Context, webhookURL, filename string, data []byte, desc string) (*Attachment, string, error)`: Sends a `multipart/form-data` request with `wait=true`. Automatically handles HTTP 429 rate limits via exponential backoff. Returns the attachment descriptor and Discord message ID.
- `DownloadAttachment(ctx context.Context, downloadURL string, startOffset, endOffset int64) ([]byte, error)`: Downloads chunk bytes from Discord CDN. Supports HTTP `Range` requests.
- `DeleteMessage(ctx context.Context, webhookURL, messageID string) error`: Deletes a chunk message from Discord.

---

## 3. Package `pkg/storage`

Manages local SQLite database persistence under WAL mode.

### Database Schema

#### `folders` Table
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | Unique UUID identifier |
| `parent_id` | TEXT | NULLABLE, FK | Parent folder ID |
| `name` | TEXT | NOT NULL | Display name |
| `path` | TEXT | NOT NULL | Hierarchical path string |
| `color` | TEXT | NULLABLE | Accent color hex code |
| `created_at` | DATETIME | NOT NULL | Creation timestamp |

#### `files` Table
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | Unique file UUID |
| `folder_id` | TEXT | NULLABLE, FK | Target virtual folder |
| `name` | TEXT | NOT NULL | Original filename |
| `size` | INTEGER | NOT NULL | Total byte size |
| `mime_type` | TEXT | NOT NULL | Detected MIME content type |
| `sha256` | TEXT | NOT NULL | SHA-256 file checksum |
| `is_encrypted` | INTEGER | DEFAULT 1 | Boolean (1=true, 0=false) |
| `chunk_count` | INTEGER | NOT NULL | Total number of chunk slices |
| `chunk_size` | INTEGER | NOT NULL | Slice byte size (e.g., 18874368) |
| `favorite` | INTEGER | DEFAULT 0 | Starred status |
| `status` | TEXT | NOT NULL | `uploading`, `completed`, `trash` |

#### `chunks` Table
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | Chunk manifest UUID |
| `file_id` | TEXT | NOT NULL, FK | Parent file UUID |
| `chunk_index` | INTEGER | NOT NULL | 0-based slice index |
| `message_id` | TEXT | NOT NULL | Discord message snowflake ID |
| `attachment_id`| TEXT | NOT NULL | Discord attachment ID |
| `attachment_url`| TEXT | NOT NULL | Discord CDN URL |
| `size` | INTEGER | NOT NULL | Byte size of chunk |
| `chunk_hash` | TEXT | NOT NULL | Chunk SHA-256 hash |
| `nonce` | TEXT | NULLABLE | 12-byte hex-encoded nonce |

---

## 4. Package `pkg/engine`

Coordinates high-throughput uploading, downloading, progress tracking, and range seeking.

### Core Methods on `Engine`
- `UploadFile(ctx context.Context, localFilePath string, opts UploadOptions) (*storage.File, error)`:
  1. Hashes source file and detects MIME type.
  2. Slices file into chunks up to configured byte limit (18MB default).
  3. Encrypts chunks with AES-256-GCM and unique nonces.
  4. Uploads to Discord webhook with rate-limit retry handling.
  5. Records manifests in SQLite and emits real-time progress callbacks.
- `DownloadFile(ctx context.Context, fileID string, destinationPath string) error`:
  1. Fetches chunk list ordered by index.
  2. Streams chunks from Discord CDN.
  3. Decrypts and authenticates ciphertext.
  4. Reassembles file and validates final SHA-256 checksum.
- `ReadRange(ctx context.Context, fileID string, startOffset, endOffset int64) ([]byte, error)`:
  Calculates chunk intersections and fetches only the required chunk byte slices on demand.

---

## 5. Package `pkg/server`

Embedded HTTP streaming server.

- **Port**: Default `49152` (auto-binds to random port if occupied).
- **Endpoints**:
  - `GET /api/stream/{file_id}`: Stream file content supporting `Accept-Ranges: bytes` and `Range: bytes=start-end`.
  - `GET /api/download/{file_id}`: Direct browser download with `Content-Disposition: attachment`.
  - `GET /api/health`: JSON health check and active port confirmation.
