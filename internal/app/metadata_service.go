// MetadataService is the presentation facade over the transactional
// filesystem service: the same eight folder operations, returning DTOs
// only (never key-bearing domain structs) with the safe error envelope
// from dto.go.
//
// The Wails binding runtime injects the context, so frontend callers pass
// no ctx argument; the facade methods still take ctx first like the
// service. This package imports no Wails code: the future cmd/desktop
// shell binds these methods.
package app

import (
	"context"

	"wyvern-drive/internal/filesystem"
)

// MetadataService fronts one filesystem.Service with DTO-only results.
type MetadataService struct {
	svc *filesystem.Service
}

// NewMetadataService returns a facade over svc.
func NewMetadataService(svc *filesystem.Service) *MetadataService {
	return &MetadataService{svc: svc}
}

// CreateLocalVault creates a metadata-only vault and returns its DTO.
func (m *MetadataService) CreateLocalVault(ctx context.Context, name string) (VaultDTO, error) {
	v, err := m.svc.CreateLocalVault(ctx, name)
	if err != nil {
		return VaultDTO{}, coerceError(err)
	}
	return toVaultDTO(v), nil
}

// ListVaults returns every metadata-only vault oldest-first, never nil.
func (m *MetadataService) ListVaults(ctx context.Context) ([]VaultDTO, error) {
	listed, err := m.svc.ListVaults(ctx)
	if err != nil {
		return nil, coerceError(err)
	}
	out := make([]VaultDTO, 0, len(listed))
	for _, v := range listed {
		out = append(out, toVaultDTO(v))
	}
	return out, nil
}

// GetVault returns one metadata-only vault DTO by ID.
func (m *MetadataService) GetVault(ctx context.Context, id string) (VaultDTO, error) {
	v, err := m.svc.GetVault(ctx, id)
	if err != nil {
		return VaultDTO{}, coerceError(err)
	}
	return toVaultDTO(v), nil
}

// ListEntries returns the single-level children DTOs of one parent (vault
// root when parentID is nil), never nil.
func (m *MetadataService) ListEntries(ctx context.Context, vaultID string, parentID *string) ([]EntryDTO, error) {
	listed, err := m.svc.ListEntries(ctx, vaultID, parentID)
	if err != nil {
		return nil, coerceError(err)
	}
	out := make([]EntryDTO, 0, len(listed))
	for _, e := range listed {
		out = append(out, toEntryDTO(e))
	}
	return out, nil
}

// CreateFolder creates one available folder and returns its DTO.
func (m *MetadataService) CreateFolder(ctx context.Context, vaultID string, parentID *string, name string) (EntryDTO, error) {
	e, err := m.svc.CreateFolder(ctx, vaultID, parentID, name)
	if err != nil {
		return EntryDTO{}, coerceError(err)
	}
	return toEntryDTO(e), nil
}

// RenameEntry renames one entry and returns its DTO.
func (m *MetadataService) RenameEntry(ctx context.Context, entryID, name string) (EntryDTO, error) {
	e, err := m.svc.RenameEntry(ctx, entryID, name)
	if err != nil {
		return EntryDTO{}, coerceError(err)
	}
	return toEntryDTO(e), nil
}

// MoveEntry re-parents one entry and returns its DTO.
func (m *MetadataService) MoveEntry(ctx context.Context, entryID string, parentID *string) (EntryDTO, error) {
	e, err := m.svc.MoveEntry(ctx, entryID, parentID)
	if err != nil {
		return EntryDTO{}, coerceError(err)
	}
	return toEntryDTO(e), nil
}

// DeleteFolder removes one folder, recursively with its subtree when
// recursive, and returns an error only.
func (m *MetadataService) DeleteFolder(ctx context.Context, entryID string, recursive bool) error {
	return coerceError(m.svc.DeleteFolder(ctx, entryID, recursive))
}
