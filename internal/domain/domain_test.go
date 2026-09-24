package domain_test

import (
	"errors"
	"testing"

	"wyvern-drive/internal/domain"
)

// Vault is the named namespace owning one entry tree.
func TestVaultStates(t *testing.T) {
	if domain.VaultStateMetadataOnly != "metadata_only" {
		t.Errorf("VaultStateMetadataOnly = %q, want %q", domain.VaultStateMetadataOnly, "metadata_only")
	}
	if domain.VaultStateReady != "ready" {
		t.Errorf("VaultStateReady = %q, want %q", domain.VaultStateReady, "ready")
	}
}

// Metadata-only vault: backend-less dev namespace (local-test/metadata_only).
func TestVaultRecordShape(t *testing.T) {
	var v domain.Vault
	v.ID = "id"
	v.Name = "Personal"
	v.BackendType = "local-test"
	v.State = domain.VaultStateMetadataOnly
	var chunkSize int64 = 16777216
	v.ChunkSize = chunkSize
	if v.EncryptedVaultKey != nil {
		t.Error("EncryptedVaultKey should default to nil (nullable)")
	}
	if v.RecoveryAnchorMessageID != nil {
		t.Error("RecoveryAnchorMessageID should default to nil (nullable)")
	}
}

func TestEntryKindsAndStatuses(t *testing.T) {
	if domain.EntryKindFile != "file" || domain.EntryKindFolder != "folder" {
		t.Errorf("entry kinds = %q, %q", domain.EntryKindFile, domain.EntryKindFolder)
	}
	for _, s := range []domain.EntryStatus{
		domain.EntryStatusAvailable,
		domain.EntryStatusUploading,
		domain.EntryStatusUploadFailed,
		domain.EntryStatusDeleting,
		domain.EntryStatusDeleteFailed,
		domain.EntryStatusCorrupt,
	} {
		if s == "" {
			t.Error("entry status must not be empty")
		}
	}
	if domain.EntryStatusAvailable != "available" {
		t.Errorf("EntryStatusAvailable = %q", domain.EntryStatusAvailable)
	}
}

func TestEntryRecordShape(t *testing.T) {
	var e domain.Entry
	e.ID = "entry-id"
	e.VaultID = "vault-id"
	e.Kind = domain.EntryKindFolder
	e.Name = "Projects"
	e.NameKey = "projects"
	e.Status = domain.EntryStatusAvailable
	var size int64 = 0
	e.Size = size
	if e.ParentID != nil || e.MimeType != nil || e.DeletedAt != nil {
		t.Error("ParentID, MimeType, DeletedAt should default to nil (nullable)")
	}
}

func TestFileRecordShape(t *testing.T) {
	var f domain.File
	f.EntryID = "entry-id"
	f.WrappedFileKey = []byte{1, 2, 3}
	var chunkSize, chunkCount int64 = 16777216, 2
	f.ChunkSize = chunkSize
	f.ChunkCount = chunkCount
	if f.SHA256 != nil {
		t.Error("SHA256 should default to nil (nullable until completion)")
	}
}

func TestChunkRecordShape(t *testing.T) {
	var c domain.Chunk
	c.ID = "chunk-id"
	c.FileEntryID = "entry-id"
	var idx, plain, cipher int64 = 0, 100, 128
	c.ChunkIndex = idx
	c.PlaintextSize = plain
	c.CiphertextSize = cipher
	c.Nonce = make([]byte, 24)
	c.PlaintextSHA256 = make([]byte, 32)
	if len(c.Nonce) != 24 {
		t.Errorf("Nonce length = %d, want 24", len(c.Nonce))
	}
	if len(c.PlaintextSHA256) != 32 {
		t.Errorf("PlaintextSHA256 length = %d, want 32", len(c.PlaintextSHA256))
	}
}

func TestJobTypesAndStates(t *testing.T) {
	types := map[domain.JobType]string{
		domain.JobTypeUpload:           "upload",
		domain.JobTypeDownload:         "download",
		domain.JobTypeDelete:           "delete",
		domain.JobTypeRecoverySnapshot: "recovery_snapshot",
		domain.JobTypeRestore:          "restore",
		domain.JobTypeVerify:           "verify",
		domain.JobTypeCleanup:          "cleanup",
	}
	for got, want := range types {
		if string(got) != want {
			t.Errorf("job type = %q, want %q", got, want)
		}
	}
	states := map[domain.JobState]string{
		domain.JobStateQueued:             "queued",
		domain.JobStateRunning:            "running",
		domain.JobStatePaused:             "paused",
		domain.JobStateInterrupted:        "interrupted",
		domain.JobStateCompleted:          "completed",
		domain.JobStateFailed:             "failed",
		domain.JobStateCancelled:          "cancelled",
		domain.JobStateSourceChanged:      "source_changed",
		domain.JobStateRemoteStateUnknown: "remote_state_unknown",
	}
	for got, want := range states {
		if string(got) != want {
			t.Errorf("job state = %q, want %q", got, want)
		}
	}
}

func TestJobRecordShape(t *testing.T) {
	var j domain.Job
	j.ID = "job-id"
	j.Type = domain.JobTypeVerify
	j.VaultID = "vault-id"
	j.State = domain.JobStateQueued
	var bytesTotal, bytesCompleted, itemsTotal, itemsCompleted int64 = 100, 40, 3, 1
	j.BytesTotal = bytesTotal
	j.BytesCompleted = bytesCompleted
	j.ItemsTotal = itemsTotal
	j.ItemsCompleted = itemsCompleted
	if j.EntryID != nil || j.SourcePath != nil || j.DestinationPath != nil {
		t.Error("EntryID, SourcePath, DestinationPath should default to nil (nullable)")
	}
	if j.ErrorCode != nil || j.ErrorMessage != nil {
		t.Error("ErrorCode, ErrorMessage should default to nil (nullable)")
	}
	if j.StartedAt != nil || j.CompletedAt != nil {
		t.Error("StartedAt, CompletedAt should default to nil (nullable)")
	}
}

func TestErrorCodes(t *testing.T) {
	codes := map[domain.Code]string{
		domain.CodeInvalidName:          "INVALID_NAME",
		domain.CodeNotFound:             "NOT_FOUND",
		domain.CodeFileConflict:         "FILE_CONFLICT",
		domain.CodeInvalidParent:        "INVALID_PARENT",
		domain.CodeInvalidHierarchy:     "INVALID_HIERARCHY",
		domain.CodeFolderNotEmpty:       "FOLDER_NOT_EMPTY",
		domain.CodeInvalidState:         "INVALID_STATE",
		domain.CodeOperationUnavailable: "OPERATION_UNAVAILABLE",
		domain.CodeDatabaseUnavailable:  "DATABASE_UNAVAILABLE",
		domain.CodeInvalidConfig:        "INVALID_CONFIG",
	}
	for got, want := range codes {
		if string(got) != want {
			t.Errorf("error code = %q, want %q", got, want)
		}
	}
}

func TestErrorImplementsErrorAndUnwrap(t *testing.T) {
	cause := errors.New("disk exploded")
	err := domain.Wrap(domain.CodeDatabaseUnavailable, "The local database is unavailable.", cause)
	var derr *domain.Error
	if !errors.As(err, &derr) {
		t.Fatalf("Wrap should produce *domain.Error, got %T", err)
	}
	if derr.Code != domain.CodeDatabaseUnavailable {
		t.Errorf("Code = %q, want DATABASE_UNAVAILABLE", derr.Code)
	}
	if errors.Unwrap(err) != cause {
		t.Error("Unwrap should return the internal cause")
	}
	if got := err.Error(); got != "The local database is unavailable." {
		t.Errorf("Error() = %q, want safe message", got)
	}
	plain := domain.New(domain.CodeNotFound, "safe message")
	if errors.Unwrap(plain) != nil {
		t.Error("Unwrap without cause should be nil")
	}
}

func TestNewIDFormat(t *testing.T) {
	seen := map[string]bool{}
	for range 10 {
		id, err := domain.NewID()
		if err != nil {
			t.Fatalf("NewID: %v", err)
		}
		if len(id) != 32 {
			t.Errorf("ID length = %d, want 32", len(id))
		}
		for _, c := range id {
			if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f')) {
				t.Errorf("ID %q contains non-lowercase-hex char %q", id, c)
			}
		}
		if seen[id] {
			t.Errorf("duplicate ID %q", id)
		}
		seen[id] = true
	}
}
