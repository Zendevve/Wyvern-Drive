package storage

import (
	"time"
)

// FileStatus represents the lifecycle of a stored file.
type FileStatus string

const (
	StatusUploading FileStatus = "uploading"
	StatusCompleted FileStatus = "completed"
	StatusFailed    FileStatus = "failed"
	StatusTrash     FileStatus = "trash"
)

// Folder represents a virtual directory.
type Folder struct {
	ID        string    `json:"id"`
	ParentID  *string   `json:"parent_id"`
	Name      string    `json:"name"`
	Path      string    `json:"path"`
	Color     string    `json:"color,omitempty"`
	Icon      string    `json:"icon,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	FileCount int       `json:"file_count,omitempty"`
	TotalSize int64     `json:"total_size,omitempty"`
}

// File represents a file object stored in Discord.
type File struct {
	ID           string     `json:"id"`
	FolderID     *string    `json:"folder_id"`
	Name         string     `json:"name"`
	Size         int64      `json:"size"`
	FormattedSize string    `json:"formatted_size,omitempty"`
	MimeType     string     `json:"mime_type"`
	SHA256       string     `json:"sha256"`
	IsEncrypted  bool       `json:"is_encrypted"`
	ChunkCount   int        `json:"chunk_count"`
	ChunkSize    int64      `json:"chunk_size"`
	Favorite     bool       `json:"favorite"`
	Status       FileStatus `json:"status"`
	Tags         []string   `json:"tags,omitempty"`
	ThumbnailURL string     `json:"thumbnail_url,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	Chunks       []Chunk    `json:"chunks,omitempty"`
}

// Chunk represents one physical slice of a file stored as a Discord attachment.
type Chunk struct {
	ID            string    `json:"id"`
	FileID        string    `json:"file_id"`
	ChunkIndex    int       `json:"chunk_index"`
	MessageID     string    `json:"message_id"`
	AttachmentID  string    `json:"attachment_id"`
	AttachmentURL string    `json:"attachment_url"`
	ProxyURL      string    `json:"proxy_url,omitempty"`
	Size          int64     `json:"size"`
	ChunkHash     string    `json:"chunk_hash"`
	Nonce         string    `json:"nonce,omitempty"` // Hex encoded 12-byte nonce
	CreatedAt     time.Time `json:"created_at"`
}

// TransferType indicates transfer direction.
type TransferType string

const (
	TransferUpload   TransferType = "upload"
	TransferDownload TransferType = "download"
)

// TransferStatus indicates current job status.
type TransferStatus string

const (
	TransferStatusQueued    TransferStatus = "queued"
	TransferStatusRunning   TransferStatus = "running"
	TransferStatusPaused    TransferStatus = "paused"
	TransferStatusCompleted TransferStatus = "completed"
	TransferStatusFailed    TransferStatus = "failed"
	TransferStatusCancelled TransferStatus = "cancelled"
)

// Transfer represents a tracked file upload or download.
type Transfer struct {
	ID               string         `json:"id"`
	FileID           string         `json:"file_id"`
	Filename         string         `json:"filename"`
	Type             TransferType   `json:"type"`
	Status           TransferStatus `json:"status"`
	TotalBytes       int64          `json:"total_bytes"`
	TransferredBytes int64          `json:"transferred_bytes"`
	ProgressPercent  float64        `json:"progress_percent"`
	SpeedBps         int64          `json:"speed_bps"`
	SpeedFormatted   string         `json:"speed_formatted,omitempty"`
	ETASeconds       int64          `json:"eta_seconds,omitempty"`
	ChunksTotal      int            `json:"chunks_total"`
	ChunksDone       int            `json:"chunks_done"`
	ErrorMessage     string         `json:"error_message,omitempty"`
	LocalPath        string         `json:"local_path,omitempty"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
}

// AppSettings contains global user configurations.
type AppSettings struct {
	WebhookURL          string `json:"webhook_url"`
	WebhookName         string `json:"webhook_name,omitempty"`
	ChannelID           string `json:"channel_id,omitempty"`
	GuildID             string `json:"guild_id,omitempty"`
	MasterKey           string `json:"master_key"` // Derived key or custom passphrase
	EncryptionEnabled   bool   `json:"encryption_enabled"`
	ChunkSizeBytes      int64  `json:"chunk_size_bytes"`
	MaxConcurrency      int    `json:"max_concurrency"`
	AutoLaunchServer    bool   `json:"auto_launch_server"`
	ServerPort          int    `json:"server_port"`
	Theme               string `json:"theme"`
	DownloadDirectory   string `json:"download_directory"`
	SetupCompleted      bool   `json:"setup_completed"`
}

// StorageStats contains aggregated metrics for the dashboard.
type StorageStats struct {
	TotalFiles       int64            `json:"total_files"`
	TotalFolders     int64            `json:"total_folders"`
	TotalBytes       int64            `json:"total_bytes"`
	FormattedTotal   string           `json:"formatted_total"`
	TotalChunks      int64            `json:"total_chunks"`
	CategoryCounts   map[string]int64 `json:"category_counts"`
	CategoryBytes    map[string]int64 `json:"category_bytes"`
	EncryptedFiles   int64            `json:"encrypted_files"`
	ActiveTransfers  int              `json:"active_transfers"`
}

// ExportManifest is the backup schema.
type ExportManifest struct {
	Version   string    `json:"version"`
	ExportedAt time.Time `json:"exported_at"`
	Folders   []Folder  `json:"folders"`
	Files     []File    `json:"files"`
}
