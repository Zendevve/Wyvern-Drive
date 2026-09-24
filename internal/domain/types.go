// Package domain holds the shared language every layer builds on:
// domain record shapes, stable error codes, and ID generation.
//
// A Vault is the named namespace owning one entry tree. A metadata-only
// vault is a backend-less dev namespace used for Phase 1 development
// (backend_type='local-test', state='metadata_only').
package domain

import "time"

// Vault states.
type VaultState string

const (
	// VaultStateMetadataOnly marks a backend-less dev namespace.
	VaultStateMetadataOnly VaultState = "metadata_only"
	// VaultStateReady marks a vault whose backend is available.
	VaultStateReady VaultState = "ready"
)

// Vault is the named namespace owning one entry tree.
type Vault struct {
	ID                      string
	Name                    string
	BackendType             string
	State                   VaultState
	ChunkSize               int64
	EncryptedVaultKey       []byte
	RecoveryAnchorMessageID *string
	CreatedAt               time.Time
	UpdatedAt               time.Time
}

// Entry kinds.
type EntryKind string

const (
	EntryKindFile   EntryKind = "file"
	EntryKindFolder EntryKind = "folder"
)

// Entry statuses.
type EntryStatus string

const (
	EntryStatusAvailable    EntryStatus = "available"
	EntryStatusUploading    EntryStatus = "uploading"
	EntryStatusUploadFailed EntryStatus = "upload_failed"
	EntryStatusDeleting     EntryStatus = "deleting"
	EntryStatusDeleteFailed EntryStatus = "delete_failed"
	EntryStatusCorrupt      EntryStatus = "corrupt"
)

// Entry is one node (file or folder) in a Vault entry tree.
type Entry struct {
	ID        string
	VaultID   string
	ParentID  *string
	Kind      EntryKind
	Name      string
	NameKey   string
	Status    EntryStatus
	Size      int64
	MimeType  *string
	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt *time.Time
}

// File holds the encryption/chunking metadata for a file Entry.
// EntryID is the primary key referencing the owning Entry.
type File struct {
	EntryID        string
	WrappedFileKey []byte
	ChunkSize      int64
	ChunkCount     int64
	SHA256         []byte
	CreatedAt      time.Time
}

// Chunk is one encrypted content chunk of a File, carrying only metadata:
// backend references and integrity fields, never payload bytes or URLs.
type Chunk struct {
	ID              string
	FileEntryID     string
	ChunkIndex      int64
	BackendType     string
	MessageID       string
	AttachmentID    string
	RemoteName      string
	Nonce           []byte
	PlaintextSize   int64
	CiphertextSize  int64
	PlaintextSHA256 []byte
	CreatedAt       time.Time
}

// Job types.
type JobType string

const (
	JobTypeUpload           JobType = "upload"
	JobTypeDownload         JobType = "download"
	JobTypeDelete           JobType = "delete"
	JobTypeRecoverySnapshot JobType = "recovery_snapshot"
	JobTypeRestore          JobType = "restore"
	JobTypeVerify           JobType = "verify"
	JobTypeCleanup          JobType = "cleanup"
)

// Job states.
type JobState string

const (
	JobStateQueued             JobState = "queued"
	JobStateRunning            JobState = "running"
	JobStatePaused             JobState = "paused"
	JobStateInterrupted        JobState = "interrupted"
	JobStateCompleted          JobState = "completed"
	JobStateFailed             JobState = "failed"
	JobStateCancelled          JobState = "cancelled"
	JobStateSourceChanged      JobState = "source_changed"
	JobStateRemoteStateUnknown JobState = "remote_state_unknown"
)

// Job tracks a background operation against a Vault, optionally scoped to
// one Entry. Totals and completed counts use int64; optional values are
// nullable pointers.
type Job struct {
	ID              string
	Type            JobType
	VaultID         string
	EntryID         *string
	State           JobState
	SourcePath      *string
	DestinationPath *string
	BytesTotal      int64
	BytesCompleted  int64
	ItemsTotal      int64
	ItemsCompleted  int64
	ErrorCode       *string
	ErrorMessage    *string
	CreatedAt       time.Time
	UpdatedAt       time.Time
	StartedAt       *time.Time
	CompletedAt     *time.Time
}
