package app

import (
	"encoding/json"
	"errors"
	"strconv"
	"time"

	"wyvern-drive/internal/domain"
)

// VaultDTO is the presentation shape of a metadata-only vault: identity,
// naming, and timestamps only, never key-bearing material.
type VaultDTO struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	BackendType string `json:"backend_type"`
	State       string `json:"state"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
}

// EntryDTO is the presentation shape of one entry tree node. Size renders
// as a decimal string so large int64 values survive JSON numbers exactly;
// a nil parent (vault root) and a nil MIME type stay JSON null.
type EntryDTO struct {
	ID        string  `json:"id"`
	VaultID   string  `json:"vault_id"`
	ParentID  *string `json:"parent_id"`
	Kind      string  `json:"kind"`
	Name      string  `json:"name"`
	Status    string  `json:"status"`
	Size      string  `json:"size"`
	MimeType  *string `json:"mime_type"`
	CreatedAt string  `json:"created_at"`
	UpdatedAt string  `json:"updated_at"`
}

// ErrorEnvelope is the safe failure shape every facade operation marshals
// to: a stable code, a safe message, and an empty details object. Messages
// never carry SQL, paths, or secret contents.
type ErrorEnvelope struct {
	Code    string         `json:"code"`
	Message string         `json:"message"`
	Details map[string]any `json:"details"`
}

// fallbackEnvelope is the last-resort payload when even envelope encoding
// fails: a static string, so every path still returns valid JSON.
const fallbackEnvelope = `{"code":"DATABASE_UNAVAILABLE","message":"database operation failed","details":{}}`

// MarshalError renders err as an ErrorEnvelope JSON string. Typed domain
// errors keep their code and safe message; anything unexpected becomes a
// DATABASE_UNAVAILABLE with a static safe message, never the internal
// detail. The result is always valid JSON.
func MarshalError(err error) string {
	code := domain.CodeDatabaseUnavailable
	message := "database operation failed"
	var derr *domain.Error
	if errors.As(err, &derr) && derr.Code != "" {
		code, message = derr.Code, derr.Message
		if message == "" {
			message = string(code)
		}
	}
	out, merr := json.Marshal(ErrorEnvelope{Code: string(code), Message: message, Details: map[string]any{}})
	if merr != nil {
		return fallbackEnvelope
	}
	return string(out)
}

// coerceError keeps typed domain errors untouched and folds anything else
// into a safe DATABASE_UNAVAILABLE, so Error() strings leaving this layer
// never leak internals.
func coerceError(err error) error {
	if err == nil {
		return nil
	}
	var derr *domain.Error
	if errors.As(err, &derr) {
		return err
	}
	return domain.Wrap(domain.CodeDatabaseUnavailable, "database operation failed", err)
}

// formatTime renders a timestamp as UTC RFC3339Nano for DTO output.
func formatTime(t time.Time) string {
	return t.UTC().Format(time.RFC3339Nano)
}

// toVaultDTO maps a domain Vault to its DTO shape.
func toVaultDTO(v domain.Vault) VaultDTO {
	return VaultDTO{
		ID: v.ID, Name: v.Name,
		BackendType: v.BackendType, State: string(v.State),
		CreatedAt: formatTime(v.CreatedAt), UpdatedAt: formatTime(v.UpdatedAt),
	}
}

// toEntryDTO maps a domain Entry to its DTO shape, rendering size as a
// decimal string and leaving root parents and absent MIME types nil.
func toEntryDTO(e domain.Entry) EntryDTO {
	return EntryDTO{
		ID: e.ID, VaultID: e.VaultID, ParentID: e.ParentID,
		Kind: string(e.Kind), Name: e.Name, Status: string(e.Status),
		Size: strconv.FormatInt(e.Size, 10), MimeType: e.MimeType,
		CreatedAt: formatTime(e.CreatedAt), UpdatedAt: formatTime(e.UpdatedAt),
	}
}
