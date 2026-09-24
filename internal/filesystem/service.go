// Package filesystem implements the transactional folder operations users
// touch over metadata-only vaults: create, list, rename, move, and delete.
//
// Every method validates hierarchy rules and mutates inside a single
// (*database.Store).WithTx transaction (ADR-0005), lookups included, so
// concurrent operations serialize on the single connection and failures
// roll back atomically. Name collisions are detected by attempting the
// write and mapping the unique-constraint failure, never by a pre-check
// that could race. This layer creates folder entries only: it never
// writes file bytes, chunk payloads, or backend keys (ADR-0004).
package filesystem

import (
	"context"
	"errors"
	"sort"
	"time"

	"wyvern-drive/internal/database"
	"wyvern-drive/internal/domain"
	"wyvern-drive/internal/validation"
)

const (
	// localTestBackendType is the backend marker every metadata-only vault
	// carries: a backend-less dev namespace, never a real backend.
	localTestBackendType = "local-test"
	// defaultChunkSize is the 16 MiB chunk size recorded on metadata-only
	// vaults; no chunking happens, the value is metadata only.
	defaultChunkSize = 16777216
)

// Service is the transactional folder API over one database store.
// Use New to construct it; the zero value is not usable.
type Service struct {
	store *database.Store
}

// New returns a Service over store.
func New(store *database.Store) *Service {
	return &Service{store: store}
}

// checkStore rejects a nil store without touching the database.
func (s *Service) checkStore() error {
	if s.store == nil {
		return domain.Wrap(domain.CodeDatabaseUnavailable, "database operation failed", errors.New("filesystem: nil store"))
	}
	return nil
}

// newID generates an entry identifier, mapping entropy failures to a safe
// database error.
func newID() (string, error) {
	id, err := domain.NewID()
	if err != nil {
		return "", domain.Wrap(domain.CodeDatabaseUnavailable, "cannot generate identifier", err)
	}
	return id, nil
}

// checkFolderParent validates a parent reference inside the transaction:
// the parent must exist in the same vault and be an available folder. Every
// rejection is INVALID_PARENT, including a missing parent: the caller named
// a parent, so a dangling reference is a bad parent, not a missing subject.
// An unavailable folder is likewise a bad destination for new children.
func checkFolderParent(ctx context.Context, tx *database.Tx, vaultID, parentID string) (domain.Entry, error) {
	parent, err := tx.GetEntry(ctx, parentID)
	if err != nil {
		var derr *domain.Error
		if errors.As(err, &derr) && derr.Code == domain.CodeNotFound {
			return domain.Entry{}, domain.New(domain.CodeInvalidParent, "parent entry not found")
		}
		return domain.Entry{}, err
	}
	if parent.VaultID != vaultID {
		return domain.Entry{}, domain.New(domain.CodeInvalidParent, "parent entry belongs to another vault")
	}
	if parent.Kind != domain.EntryKindFolder {
		return domain.Entry{}, domain.New(domain.CodeInvalidParent, "parent entry is not a folder")
	}
	if parent.Status != domain.EntryStatusAvailable {
		return domain.Entry{}, domain.New(domain.CodeInvalidParent, "parent entry is not available")
	}
	return parent, nil
}

// sameParent reports whether two optional parent references name the same
// destination, where nil means the vault root.
func sameParent(a, b *string) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return *a == *b
}

// rejectCycle walks the destination's ancestor chain inside the transaction
// and rejects INVALID_HIERARCHY when the move source appears on it. A
// visited set keeps a corrupted store cycle (or a dangling ancestor link)
// from recursing forever: both report INVALID_HIERARCHY, never a hang.
func rejectCycle(ctx context.Context, tx *database.Tx, sourceID, destID string) error {
	visited := make(map[string]bool)
	cur := destID
	for {
		if cur == sourceID {
			return domain.New(domain.CodeInvalidHierarchy, "move would create a cycle")
		}
		if visited[cur] {
			return domain.New(domain.CodeInvalidHierarchy, "entry hierarchy is corrupted")
		}
		visited[cur] = true
		curEntry, err := tx.GetEntry(ctx, cur)
		if err != nil {
			var derr *domain.Error
			if errors.As(err, &derr) && derr.Code == domain.CodeNotFound {
				return domain.New(domain.CodeInvalidHierarchy, "entry hierarchy is corrupted")
			}
			return err
		}
		if curEntry.ParentID == nil {
			return nil
		}
		cur = *curEntry.ParentID
	}
}

// CreateLocalVault creates a metadata-only vault: a backend-less dev
// namespace recorded as backend_type='local-test', state='metadata_only'
// with NULL key and anchor material. The name is validated but vault names
// need not be unique, so duplicates are legal. Invalid names reject before
// any write.
func (s *Service) CreateLocalVault(ctx context.Context, name string) (domain.Vault, error) {
	if err := s.checkStore(); err != nil {
		return domain.Vault{}, err
	}
	display, _, err := validation.NormalizeName(name)
	if err != nil {
		return domain.Vault{}, err
	}
	id, err := newID()
	if err != nil {
		return domain.Vault{}, err
	}
	now := time.Now().UTC()
	v := domain.Vault{
		ID: id, Name: display,
		BackendType: localTestBackendType, State: domain.VaultStateMetadataOnly,
		ChunkSize: defaultChunkSize,
		CreatedAt: now, UpdatedAt: now,
	}
	var out domain.Vault
	if err := s.store.WithTx(ctx, func(tx *database.Tx) error {
		if err := tx.InsertVault(ctx, v); err != nil {
			return err
		}
		stored, err := tx.GetVault(ctx, v.ID)
		if err != nil {
			return err
		}
		out = stored
		return nil
	}); err != nil {
		return domain.Vault{}, err
	}
	return out, nil
}

// ListVaults returns every metadata-only vault oldest-first (created_at,
// then ID) for deterministic restart selection. The repository returns ID
// order, so the service re-sorts here.
func (s *Service) ListVaults(ctx context.Context) ([]domain.Vault, error) {
	if err := s.checkStore(); err != nil {
		return nil, err
	}
	var out []domain.Vault
	if err := s.store.WithTx(ctx, func(tx *database.Tx) error {
		listed, err := tx.ListVaults(ctx)
		if err != nil {
			return err
		}
		out = listed
		return nil
	}); err != nil {
		return nil, err
	}
	sort.Slice(out, func(i, j int) bool {
		if !out[i].CreatedAt.Equal(out[j].CreatedAt) {
			return out[i].CreatedAt.Before(out[j].CreatedAt)
		}
		return out[i].ID < out[j].ID
	})
	if out == nil {
		out = []domain.Vault{}
	}
	return out, nil
}

// GetVault returns one metadata-only vault by ID, or NOT_FOUND.
func (s *Service) GetVault(ctx context.Context, id string) (domain.Vault, error) {
	if err := s.checkStore(); err != nil {
		return domain.Vault{}, err
	}
	var out domain.Vault
	if err := s.store.WithTx(ctx, func(tx *database.Tx) error {
		v, err := tx.GetVault(ctx, id)
		if err != nil {
			return err
		}
		out = v
		return nil
	}); err != nil {
		return domain.Vault{}, err
	}
	return out, nil
}

// ListEntries returns the single-level children of one parent (vault root
// when parentID is nil), ordered folders-first, then by collision key,
// then by ID. The vault must exist (NOT_FOUND) and a non-nil parent must
// exist in the same vault and be a folder (INVALID_PARENT). The result is
// never nil and no descendants are loaded.
func (s *Service) ListEntries(ctx context.Context, vaultID string, parentID *string) ([]domain.Entry, error) {
	if err := s.checkStore(); err != nil {
		return nil, err
	}
	var out []domain.Entry
	if err := s.store.WithTx(ctx, func(tx *database.Tx) error {
		if _, err := tx.GetVault(ctx, vaultID); err != nil {
			return err
		}
		if parentID != nil {
			if _, err := checkFolderParent(ctx, tx, vaultID, *parentID); err != nil {
				return err
			}
		}
		listed, err := tx.ListEntries(ctx, vaultID, parentID)
		if err != nil {
			return err
		}
		out = listed
		return nil
	}); err != nil {
		return nil, err
	}
	// The repository orders by name key only; folders-first is a
	// service-side sort so folder and file listings stay grouped.
	sort.Slice(out, func(i, j int) bool {
		fi, fj := out[i].Kind == domain.EntryKindFolder, out[j].Kind == domain.EntryKindFolder
		if fi != fj {
			return fi
		}
		if out[i].NameKey != out[j].NameKey {
			return out[i].NameKey < out[j].NameKey
		}
		return out[i].ID < out[j].ID
	})
	if out == nil {
		out = []domain.Entry{}
	}
	return out, nil
}

// CreateFolder creates one available folder entry with zero size and no
// MIME type, touching no file bytes or backend state. The vault and parent
// validate as in ListEntries; a sibling name collision fails with
// FILE_CONFLICT via the database constraint, with no pre-check to race.
func (s *Service) CreateFolder(ctx context.Context, vaultID string, parentID *string, name string) (domain.Entry, error) {
	if err := s.checkStore(); err != nil {
		return domain.Entry{}, err
	}
	display, key, err := validation.NormalizeName(name)
	if err != nil {
		return domain.Entry{}, err
	}
	id, err := newID()
	if err != nil {
		return domain.Entry{}, err
	}
	now := time.Now().UTC()
	e := domain.Entry{
		ID: id, VaultID: vaultID, ParentID: parentID,
		Kind: domain.EntryKindFolder, Name: display, NameKey: key,
		Status: domain.EntryStatusAvailable, Size: 0,
		CreatedAt: now, UpdatedAt: now,
	}
	var out domain.Entry
	if err := s.store.WithTx(ctx, func(tx *database.Tx) error {
		if _, err := tx.GetVault(ctx, vaultID); err != nil {
			return err
		}
		if parentID != nil {
			if _, err := checkFolderParent(ctx, tx, vaultID, *parentID); err != nil {
				return err
			}
		}
		if err := tx.InsertEntry(ctx, e); err != nil {
			return err
		}
		stored, err := tx.GetEntry(ctx, e.ID)
		if err != nil {
			return err
		}
		out = stored
		return nil
	}); err != nil {
		return domain.Entry{}, err
	}
	return out, nil
}

// RenameEntry renames one entry, preserving its ID, parent, creation time,
// and children. Only available entries may rename (INVALID_STATE). A
// byte-identical name and key is a no-op returning the current row; a
// case-only key-identical change is a real mutation of the display name. A
// sibling collision fails with FILE_CONFLICT and the hierarchy is
// unchanged.
func (s *Service) RenameEntry(ctx context.Context, entryID, name string) (domain.Entry, error) {
	if err := s.checkStore(); err != nil {
		return domain.Entry{}, err
	}
	display, key, err := validation.NormalizeName(name)
	if err != nil {
		return domain.Entry{}, err
	}
	var out domain.Entry
	if err := s.store.WithTx(ctx, func(tx *database.Tx) error {
		cur, err := tx.GetEntry(ctx, entryID)
		if err != nil {
			return err
		}
		if cur.Status != domain.EntryStatusAvailable {
			return domain.New(domain.CodeInvalidState, "entry is not available for rename")
		}
		if cur.Name == display && cur.NameKey == key {
			out = cur
			return nil
		}
		if err := tx.RenameEntry(ctx, entryID, display, key, time.Now().UTC()); err != nil {
			return err
		}
		stored, err := tx.GetEntry(ctx, entryID)
		if err != nil {
			return err
		}
		out = stored
		return nil
	}); err != nil {
		return domain.Entry{}, err
	}
	return out, nil
}

// MoveEntry re-parents one entry, staying in its vault; a nil parent means
// the vault root. Only available entries may move (INVALID_STATE). A
// non-nil destination must exist in the same vault and be an available
// folder (INVALID_PARENT), as are self-moves and any move that would place
// the entry under itself (INVALID_HIERARCHY via an ancestor walk).
// Moving onto the same parent is a no-op; a destination name collision
// fails with FILE_CONFLICT and the hierarchy is unchanged.
func (s *Service) MoveEntry(ctx context.Context, entryID string, parentID *string) (domain.Entry, error) {
	if err := s.checkStore(); err != nil {
		return domain.Entry{}, err
	}
	if parentID != nil && *parentID == entryID {
		return domain.Entry{}, domain.New(domain.CodeInvalidParent, "cannot move an entry beneath itself")
	}
	var out domain.Entry
	if err := s.store.WithTx(ctx, func(tx *database.Tx) error {
		src, err := tx.GetEntry(ctx, entryID)
		if err != nil {
			return err
		}
		if src.Status != domain.EntryStatusAvailable {
			return domain.New(domain.CodeInvalidState, "entry is not available for move")
		}
		if sameParent(src.ParentID, parentID) {
			out = src
			return nil
		}
		if parentID != nil {
			if _, err := checkFolderParent(ctx, tx, src.VaultID, *parentID); err != nil {
				return err
			}
			if err := rejectCycle(ctx, tx, entryID, *parentID); err != nil {
				return err
			}
		}
		if err := tx.MoveEntry(ctx, entryID, parentID, time.Now().UTC()); err != nil {
			return err
		}
		stored, err := tx.GetEntry(ctx, entryID)
		if err != nil {
			return err
		}
		out = stored
		return nil
	}); err != nil {
		return domain.Entry{}, err
	}
	return out, nil
}

// DeleteFolder removes one folder entry. A folder-only operation applied to
// a file entry is a kind/state mismatch, so it is rejected with
// INVALID_STATE here and on the recursive path alike.
//
// Non-recursive delete refuses a nonempty folder with FOLDER_NOT_EMPTY and
// mutates nothing. Recursive delete first enumerates the full subtree
// (visited set, INVALID_HIERARCHY on a corrupted cycle), validates every
// node is an available folder, and refuses atomically with
// OPERATION_UNAVAILABLE — naming the blocking entry or job identity — when
// any file, chunk, or job record depends on the subtree. The validated
// subtree is then deleted postorder (children before parents) in the same
// transaction, so any blocker means zero mutation. RESTRICT foreign keys
// are a backstop only, mapped to OPERATION_UNAVAILABLE rather than a raw
// database failure.
func (s *Service) DeleteFolder(ctx context.Context, entryID string, recursive bool) error {
	if err := s.checkStore(); err != nil {
		return err
	}
	return s.store.WithTx(ctx, func(tx *database.Tx) error {
		target, err := tx.GetEntry(ctx, entryID)
		if err != nil {
			return err
		}
		if target.Kind != domain.EntryKindFolder {
			return domain.New(domain.CodeInvalidState, "entry is not a folder")
		}
		if !recursive {
			children, err := tx.ListEntries(ctx, target.VaultID, &target.ID)
			if err != nil {
				return err
			}
			if len(children) > 0 {
				return domain.New(domain.CodeFolderNotEmpty, "folder is not empty")
			}
			return tx.DeleteEntry(ctx, target.ID)
		}
		return deleteSubtree(ctx, tx, target)
	})
}

// deleteSubtree validates the full subtree rooted at root and deletes it
// postorder in the same transaction. Validation precedes every delete, so
// any blocker leaves zero mutation.
func deleteSubtree(ctx context.Context, tx *database.Tx, root domain.Entry) error {
	visited := map[string]bool{root.ID: true}
	nodes := map[string]domain.Entry{root.ID: root}
	order := []string{root.ID}
	queue := []string{root.ID}
	for len(queue) > 0 {
		id := queue[0]
		queue = queue[1:]
		children, err := tx.ListEntries(ctx, root.VaultID, &id)
		if err != nil {
			return err
		}
		for _, ch := range children {
			if visited[ch.ID] {
				return domain.New(domain.CodeInvalidHierarchy, "entry hierarchy is corrupted")
			}
			visited[ch.ID] = true
			nodes[ch.ID] = ch
			order = append(order, ch.ID)
			queue = append(queue, ch.ID)
		}
	}
	for _, id := range order {
		n := nodes[id]
		if n.Kind != domain.EntryKindFolder {
			return domain.New(domain.CodeOperationUnavailable, "cannot delete: entry "+id+" is not a folder")
		}
		if n.Status != domain.EntryStatusAvailable {
			return domain.New(domain.CodeOperationUnavailable, "cannot delete: entry "+id+" is not available")
		}
		if _, err := tx.GetFile(ctx, id); err == nil {
			return domain.New(domain.CodeOperationUnavailable, "cannot delete: entry "+id+" has file data")
		} else {
			var derr *domain.Error
			if !errors.As(err, &derr) || derr.Code != domain.CodeNotFound {
				return err
			}
		}
		chunks, err := tx.ListChunks(ctx, id)
		if err != nil {
			return err
		}
		if len(chunks) > 0 {
			return domain.New(domain.CodeOperationUnavailable, "cannot delete: entry "+id+" has chunk data")
		}
	}
	jobs, err := tx.ListJobs(ctx)
	if err != nil {
		return err
	}
	for _, j := range jobs {
		if j.EntryID != nil && visited[*j.EntryID] {
			return domain.New(domain.CodeOperationUnavailable, "cannot delete: entry "+*j.EntryID+" is referenced by job "+j.ID)
		}
	}
	// Reverse breadth-first order deletes children before parents.
	for i := len(order) - 1; i >= 0; i-- {
		if err := tx.DeleteEntry(ctx, order[i]); err != nil {
			return err
		}
	}
	return nil
}
