package filesystem

import (
	"context"
	"errors"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"wyvern-drive/internal/database"
	"wyvern-drive/internal/domain"
	"wyvern-drive/migrations"
)

func openTestStore(t *testing.T, ctx context.Context) *database.Store {
	t.Helper()
	dir := t.TempDir()
	store, err := database.Open(ctx, filepath.Join(dir, "wyvern.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = store.Close() })
	if err := database.Migrate(ctx, store, migrations.FS, filepath.Join(dir, "backups")); err != nil {
		t.Fatal(err)
	}
	return store
}

func codeOf(t *testing.T, err error) domain.Code {
	t.Helper()
	if err == nil {
		t.Fatal("expected an error, got nil")
	}
	var derr *domain.Error
	if !errors.As(err, &derr) {
		t.Fatalf("error %v is not a domain error", err)
	}
	return derr.Code
}

func millisNow() time.Time { return time.Now().UTC().Truncate(time.Millisecond) }

func seedVault(t *testing.T, ctx context.Context, svc *Service, name string) domain.Vault {
	t.Helper()
	v, err := svc.CreateLocalVault(ctx, name)
	if err != nil {
		t.Fatalf("seed metadata-only vault %q: %v", name, err)
	}
	return v
}

func seedRawEntry(t *testing.T, ctx context.Context, store *database.Store, e domain.Entry) domain.Entry {
	t.Helper()
	if err := store.WithTx(ctx, func(tx *database.Tx) error { return tx.InsertEntry(ctx, e) }); err != nil {
		t.Fatalf("seed entry %q: %v", e.Name, err)
	}
	return e
}

func rawFolder(id, vaultID string, parentID *string, name, key string) domain.Entry {
	now := millisNow()
	return domain.Entry{
		ID: id, VaultID: vaultID, ParentID: parentID,
		Kind: domain.EntryKindFolder, Name: name, NameKey: key,
		Status: domain.EntryStatusAvailable, Size: 0,
		CreatedAt: now, UpdatedAt: now,
	}
}

// A created metadata-only vault carries the backend-less dev markers and no
// key material; invalid names reject before any write; duplicate display
// names are legal.
func TestCreateLocalVault(t *testing.T) {
	ctx := context.Background()
	svc := New(openTestStore(t, ctx))

	v, err := svc.CreateLocalVault(ctx, "Personal")
	if err != nil {
		t.Fatal(err)
	}
	if v.ID == "" || v.Name != "Personal" {
		t.Fatalf("vault identity = %+v", v)
	}
	if v.BackendType != "local-test" || v.State != domain.VaultStateMetadataOnly {
		t.Fatalf("vault markers = %q %q", v.BackendType, v.State)
	}
	if v.ChunkSize != 16777216 || v.EncryptedVaultKey != nil || v.RecoveryAnchorMessageID != nil {
		t.Fatalf("vault chunk/key/anchor = %d %v %v", v.ChunkSize, v.EncryptedVaultKey, v.RecoveryAnchorMessageID)
	}

	dup, err := svc.CreateLocalVault(ctx, "Personal")
	if err != nil {
		t.Fatalf("duplicate vault name must be legal: %v", err)
	}
	if dup.ID == v.ID {
		t.Fatal("duplicate vault names must still be distinct vaults")
	}

	for _, bad := range []string{"", "  ", ".", "..", "a/b", " lead", "trail ", "a\x00b"} {
		if _, err := svc.CreateLocalVault(ctx, bad); codeOf(t, err) != domain.CodeInvalidName {
			t.Fatalf("name %q: code = %v, want INVALID_NAME", bad, err)
		}
	}
	listed, err := svc.ListVaults(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(listed) != 2 {
		t.Fatalf("invalid names must reject before any write: %d vaults", len(listed))
	}
}

// Vault listing is oldest-first by (created_at, id): creations a
// millisecond apart order deterministically.
func TestListVaultsOldestFirst(t *testing.T) {
	ctx := context.Background()
	svc := New(openTestStore(t, ctx))

	first := seedVault(t, ctx, svc, "First")
	second := seedVault(t, ctx, svc, "Second")

	listed, err := svc.ListVaults(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(listed) != 2 || listed[0].ID != first.ID || listed[1].ID != second.ID {
		t.Fatalf("ListVaults order = %v %v, want oldest first", listed[0].ID, listed[1].ID)
	}
	for i := 1; i < len(listed); i++ {
		a, b := listed[i-1], listed[i]
		if a.CreatedAt.After(b.CreatedAt) || (a.CreatedAt.Equal(b.CreatedAt) && a.ID > b.ID) {
			t.Fatalf("ListVaults not oldest-first at %d", i)
		}
	}
}

// GetVault returns the stored metadata-only vault, or NOT_FOUND.
func TestGetVault(t *testing.T) {
	ctx := context.Background()
	svc := New(openTestStore(t, ctx))

	want := seedVault(t, ctx, svc, "Personal")
	got, err := svc.GetVault(ctx, want.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.ID != want.ID || got.Name != want.Name || got.BackendType != want.BackendType || got.State != want.State {
		t.Fatalf("GetVault = %+v, want %+v", got, want)
	}
	if _, err := svc.GetVault(ctx, "missing"); codeOf(t, err) != domain.CodeNotFound {
		t.Fatalf("missing vault: %v", err)
	}
}

// ListEntries validates the vault and parent, returns a non-nil single
// level, and sorts folders-first by collision key then ID.
func TestListEntries(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t, ctx)
	svc := New(store)
	v := seedVault(t, ctx, svc, "Personal")

	if _, err := svc.ListEntries(ctx, "missing", nil); codeOf(t, err) != domain.CodeNotFound {
		t.Fatalf("missing vault: %v", err)
	}
	if _, err := svc.ListEntries(ctx, v.ID, new("missing")); codeOf(t, err) != domain.CodeInvalidParent {
		t.Fatalf("missing parent: %v", err)
	}
	other := seedVault(t, ctx, svc, "Other")
	foreign, err := svc.CreateFolder(ctx, other.ID, nil, "Foreign")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.ListEntries(ctx, v.ID, &foreign.ID); codeOf(t, err) != domain.CodeInvalidParent {
		t.Fatalf("cross-vault parent: %v", err)
	}
	file := domain.Entry{
		ID: "file-1", VaultID: v.ID, Kind: domain.EntryKindFile,
		Name: "note.txt", NameKey: "note.txt", Status: domain.EntryStatusAvailable,
		CreatedAt: millisNow(), UpdatedAt: millisNow(),
	}
	seedRawEntry(t, ctx, store, file)
	if _, err := svc.ListEntries(ctx, v.ID, &file.ID); codeOf(t, err) != domain.CodeInvalidParent {
		t.Fatalf("file parent: %v", err)
	}
	deleting := rawFolder("deleting-parent", v.ID, nil, "Deleting", "deleting")
	deleting.Status = domain.EntryStatusDeleting
	seedRawEntry(t, ctx, store, deleting)
	if _, err := svc.ListEntries(ctx, v.ID, &deleting.ID); codeOf(t, err) != domain.CodeInvalidParent {
		t.Fatalf("unavailable parent: %v", err)
	}

	empty, err := svc.ListEntries(ctx, v.ID, nil)
	if err != nil {
		t.Fatal(err)
	}
	if empty == nil || len(empty) != 2 { // the seeded file plus the deleting parent
		t.Fatalf("empty-ish listing must be non-nil single level, got %+v", empty)
	}

	b, err := svc.CreateFolder(ctx, v.ID, nil, "b")
	if err != nil {
		t.Fatal(err)
	}
	a, err := svc.CreateFolder(ctx, v.ID, nil, "a")
	if err != nil {
		t.Fatal(err)
	}
	grand, err := svc.CreateFolder(ctx, v.ID, &a.ID, "grandchild")
	if err != nil {
		t.Fatal(err)
	}
	_ = b
	_ = grand

	roots, err := svc.ListEntries(ctx, v.ID, nil)
	if err != nil {
		t.Fatal(err)
	}
	// Folders first by key (a, b, deleting), then the file by key: no
	// descendants.
	wantOrder := []string{"a", "b", "Deleting", "note.txt"}
	if len(roots) != len(wantOrder) {
		t.Fatalf("roots = %d entries, want %d", len(roots), len(wantOrder))
	}
	for i, name := range wantOrder {
		if roots[i].Name != name {
			t.Fatalf("roots[%d] = %q, want %q", i, roots[i].Name, name)
		}
	}
	underA, err := svc.ListEntries(ctx, v.ID, &a.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(underA) != 1 || underA[0].ID != grand.ID {
		t.Fatalf("children of a = %+v", underA)
	}
}

// Created folders are available with zero size and no MIME; sibling
// collisions (including case variants) fail via the constraint with the
// hierarchy unchanged.
func TestCreateFolder(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t, ctx)
	svc := New(store)
	v := seedVault(t, ctx, svc, "Personal")

	f, err := svc.CreateFolder(ctx, v.ID, nil, "Projects")
	if err != nil {
		t.Fatal(err)
	}
	if f.Kind != domain.EntryKindFolder || f.Status != domain.EntryStatusAvailable {
		t.Fatalf("folder kind/status = %q %q", f.Kind, f.Status)
	}
	if f.Size != 0 || f.MimeType != nil || f.VaultID != v.ID || f.ParentID != nil {
		t.Fatalf("folder shape = %+v", f)
	}
	if f.Name != "Projects" || f.NameKey == "" {
		t.Fatalf("folder names = %q %q", f.Name, f.NameKey)
	}

	if _, err := svc.CreateFolder(ctx, "missing", nil, "X"); codeOf(t, err) != domain.CodeNotFound {
		t.Fatalf("missing vault: %v", err)
	}
	if _, err := svc.CreateFolder(ctx, v.ID, new("missing"), "X"); codeOf(t, err) != domain.CodeInvalidParent {
		t.Fatalf("missing parent: %v", err)
	}
	uploading := rawFolder("uploading-parent", v.ID, nil, "Uploading", "uploading")
	uploading.Status = domain.EntryStatusUploading
	seedRawEntry(t, ctx, store, uploading)
	if _, err := svc.CreateFolder(ctx, v.ID, &uploading.ID, "Child"); codeOf(t, err) != domain.CodeInvalidParent {
		t.Fatalf("unavailable parent: %v", err)
	}
	kids, err := svc.ListEntries(ctx, v.ID, nil)
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range kids {
		if e.ParentID != nil && *e.ParentID == uploading.ID {
			t.Fatalf("refused create must not leave a child: %+v", kids)
		}
	}
	if _, err := svc.CreateFolder(ctx, v.ID, nil, ""); codeOf(t, err) != domain.CodeInvalidName {
		t.Fatalf("empty name: %v", err)
	}

	if _, err := svc.CreateFolder(ctx, v.ID, nil, "Projects"); codeOf(t, err) != domain.CodeFileConflict {
		t.Fatalf("duplicate sibling: %v", err)
	}
	if _, err := svc.CreateFolder(ctx, v.ID, nil, "PROJECTS"); codeOf(t, err) != domain.CodeFileConflict {
		t.Fatalf("case-variant sibling: %v", err)
	}
	roots, err := svc.ListEntries(ctx, v.ID, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(roots) != 2 {
		t.Fatalf("collision must leave hierarchy unchanged: %+v", roots)
	}
	for _, e := range roots {
		if e.ID != f.ID && e.ID != uploading.ID {
			t.Fatalf("unexpected root: %+v", roots)
		}
	}
}

// Rename preserves identity, parent, creation time, and children:
// byte-identical input is a no-op, case-only changes mutate the display
// name, collisions roll back, and only available entries rename.
func TestRenameEntry(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t, ctx)
	svc := New(store)
	v := seedVault(t, ctx, svc, "Personal")

	if _, err := svc.RenameEntry(ctx, "missing", "X"); codeOf(t, err) != domain.CodeNotFound {
		t.Fatalf("missing entry: %v", err)
	}
	if _, err := svc.RenameEntry(ctx, "missing", ""); codeOf(t, err) != domain.CodeInvalidName {
		t.Fatalf("invalid name must reject first: %v", err)
	}

	parent, err := svc.CreateFolder(ctx, v.ID, nil, "Projects")
	if err != nil {
		t.Fatal(err)
	}
	child, err := svc.CreateFolder(ctx, v.ID, &parent.ID, "Docs")
	if err != nil {
		t.Fatal(err)
	}

	noop, err := svc.RenameEntry(ctx, child.ID, "Docs")
	if err != nil {
		t.Fatal(err)
	}
	if noop.UpdatedAt.UnixMilli() != child.UpdatedAt.UnixMilli() || noop.Name != "Docs" {
		t.Fatalf("byte-identical rename must no-op: %+v vs %+v", noop, child)
	}

	cased, err := svc.RenameEntry(ctx, child.ID, "DOCS")
	if err != nil {
		t.Fatal(err)
	}
	if cased.Name != "DOCS" || cased.NameKey != child.NameKey {
		t.Fatalf("case-only rename must mutate display, keep key: %+v", cased)
	}
	if cased.ID != child.ID || cased.CreatedAt.UnixMilli() != child.CreatedAt.UnixMilli() {
		t.Fatalf("rename must preserve identity: %+v", cased)
	}
	if cased.ParentID == nil || *cased.ParentID != parent.ID {
		t.Fatalf("rename must preserve parent: %+v", cased)
	}

	renamed, err := svc.RenameEntry(ctx, child.ID, "Notes")
	if err != nil {
		t.Fatal(err)
	}
	if renamed.Name != "Notes" || renamed.NameKey == child.NameKey {
		t.Fatalf("rename must change name and key: %+v", renamed)
	}
	kids, err := svc.ListEntries(ctx, v.ID, &parent.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(kids) != 1 || kids[0].ID != child.ID {
		t.Fatalf("rename must preserve children: %+v", kids)
	}

	sibling, err := svc.CreateFolder(ctx, v.ID, &parent.ID, "Other")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.RenameEntry(ctx, sibling.ID, "notes"); codeOf(t, err) != domain.CodeFileConflict {
		t.Fatalf("rename collision: %v", err)
	}
	still, err := svc.ListEntries(ctx, v.ID, &parent.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(still) != 2 {
		t.Fatalf("collision must leave hierarchy unchanged: %+v", still)
	}

	stuck := rawFolder("stuck", v.ID, nil, "Stuck", "stuck")
	stuck.Status = domain.EntryStatusUploading
	seedRawEntry(t, ctx, store, stuck)
	if _, err := svc.RenameEntry(ctx, stuck.ID, "Free"); codeOf(t, err) != domain.CodeInvalidState {
		t.Fatalf("unavailable rename: %v", err)
	}
}

// Move stays in-vault with nil meaning root: bad destinations, self-moves,
// and ancestor-walk cycles reject; same-parent is a no-op; collisions
// leave the hierarchy unchanged.
func TestMoveEntry(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t, ctx)
	svc := New(store)
	v := seedVault(t, ctx, svc, "Personal")

	if _, err := svc.MoveEntry(ctx, "missing", nil); codeOf(t, err) != domain.CodeNotFound {
		t.Fatalf("missing source: %v", err)
	}

	a, err := svc.CreateFolder(ctx, v.ID, nil, "A")
	if err != nil {
		t.Fatal(err)
	}
	b, err := svc.CreateFolder(ctx, v.ID, &a.ID, "B")
	if err != nil {
		t.Fatal(err)
	}
	c, err := svc.CreateFolder(ctx, v.ID, &b.ID, "C")
	if err != nil {
		t.Fatal(err)
	}

	if _, err := svc.MoveEntry(ctx, a.ID, &a.ID); codeOf(t, err) != domain.CodeInvalidParent {
		t.Fatalf("self-move: %v", err)
	}
	if _, err := svc.MoveEntry(ctx, a.ID, &c.ID); codeOf(t, err) != domain.CodeInvalidHierarchy {
		t.Fatalf("cycle move: %v", err)
	}
	// Hierarchy unchanged after the rejected cycle.
	roots, err := svc.ListEntries(ctx, v.ID, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(roots) != 1 || roots[0].ID != a.ID {
		t.Fatalf("rejected cycle must not mutate: %+v", roots)
	}

	noop, err := svc.MoveEntry(ctx, b.ID, &a.ID)
	if err != nil {
		t.Fatal(err)
	}
	if noop.ID != b.ID || noop.ParentID == nil || *noop.ParentID != a.ID {
		t.Fatalf("same-parent move must no-op: %+v", noop)
	}

	if _, err := svc.MoveEntry(ctx, b.ID, new("missing")); codeOf(t, err) != domain.CodeInvalidParent {
		t.Fatalf("missing dest: %v", err)
	}
	file := domain.Entry{
		ID: "file-1", VaultID: v.ID, Kind: domain.EntryKindFile,
		Name: "note.txt", NameKey: "note.txt", Status: domain.EntryStatusAvailable,
		CreatedAt: millisNow(), UpdatedAt: millisNow(),
	}
	seedRawEntry(t, ctx, store, file)
	if _, err := svc.MoveEntry(ctx, b.ID, &file.ID); codeOf(t, err) != domain.CodeInvalidParent {
		t.Fatalf("file dest: %v", err)
	}
	other := seedVault(t, ctx, svc, "Other")
	foreign, err := svc.CreateFolder(ctx, other.ID, nil, "Foreign")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.MoveEntry(ctx, b.ID, &foreign.ID); codeOf(t, err) != domain.CodeInvalidParent {
		t.Fatalf("cross-vault dest: %v", err)
	}
	busy := rawFolder("busy", v.ID, nil, "Busy", "busy")
	busy.Status = domain.EntryStatusDeleting
	seedRawEntry(t, ctx, store, busy)
	if _, err := svc.MoveEntry(ctx, b.ID, &busy.ID); codeOf(t, err) != domain.CodeInvalidParent {
		t.Fatalf("unavailable dest: %v", err)
	}
	stuck := rawFolder("stuck", v.ID, nil, "Stuck", "stuck")
	stuck.Status = domain.EntryStatusUploading
	seedRawEntry(t, ctx, store, stuck)
	if _, err := svc.MoveEntry(ctx, stuck.ID, &a.ID); codeOf(t, err) != domain.CodeInvalidState {
		t.Fatalf("unavailable source: %v", err)
	}

	// Collision in the destination rolls back.
	top, err := svc.CreateFolder(ctx, v.ID, nil, "C")
	if err != nil {
		t.Fatal(err)
	}
	_ = top
	if _, err := svc.MoveEntry(ctx, c.ID, nil); codeOf(t, err) != domain.CodeFileConflict {
		t.Fatalf("destination collision: %v", err)
	}
	underB, err := svc.ListEntries(ctx, v.ID, &b.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(underB) != 1 || underB[0].ID != c.ID {
		t.Fatalf("collision must leave hierarchy unchanged: %+v", underB)
	}

	moved, err := svc.MoveEntry(ctx, c.ID, &a.ID)
	if err != nil {
		t.Fatal(err)
	}
	if moved.ParentID == nil || *moved.ParentID != a.ID || moved.VaultID != v.ID {
		t.Fatalf("move must re-parent in-vault: %+v", moved)
	}
	toRoot, err := svc.MoveEntry(ctx, b.ID, nil)
	if err != nil {
		t.Fatal(err)
	}
	if toRoot.ParentID != nil {
		t.Fatalf("nil dest must mean root: %+v", toRoot)
	}
}

// Non-recursive delete removes empty folders, rejects nonempty ones with
// FOLDER_NOT_EMPTY, and rejects file entries with INVALID_STATE: a
// folder-only operation on a file is a kind mismatch, documented here and
// on the recursive path alike.
func TestDeleteFolder(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t, ctx)
	svc := New(store)
	v := seedVault(t, ctx, svc, "Personal")

	if err := svc.DeleteFolder(ctx, "missing", false); codeOf(t, err) != domain.CodeNotFound {
		t.Fatalf("missing entry: %v", err)
	}
	file := domain.Entry{
		ID: "file-1", VaultID: v.ID, Kind: domain.EntryKindFile,
		Name: "note.txt", NameKey: "note.txt", Status: domain.EntryStatusAvailable,
		CreatedAt: millisNow(), UpdatedAt: millisNow(),
	}
	seedRawEntry(t, ctx, store, file)
	if err := svc.DeleteFolder(ctx, file.ID, false); codeOf(t, err) != domain.CodeInvalidState {
		t.Fatalf("file delete: %v", err)
	}
	if err := svc.DeleteFolder(ctx, file.ID, true); codeOf(t, err) != domain.CodeInvalidState {
		t.Fatalf("recursive file delete: %v", err)
	}

	parent, err := svc.CreateFolder(ctx, v.ID, nil, "Projects")
	if err != nil {
		t.Fatal(err)
	}
	child, err := svc.CreateFolder(ctx, v.ID, &parent.ID, "Docs")
	if err != nil {
		t.Fatal(err)
	}
	if err := svc.DeleteFolder(ctx, parent.ID, false); codeOf(t, err) != domain.CodeFolderNotEmpty {
		t.Fatalf("nonempty delete: %v", err)
	}
	kids, err := svc.ListEntries(ctx, v.ID, &parent.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(kids) != 1 || kids[0].ID != child.ID {
		t.Fatalf("refused delete must not mutate: %+v", kids)
	}
	if err := svc.DeleteFolder(ctx, child.ID, false); err != nil {
		t.Fatal(err)
	}
	if err := svc.DeleteFolder(ctx, parent.ID, false); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.GetVault(ctx, v.ID); err != nil {
		t.Fatalf("vault must survive entry deletes: %v", err)
	}
	roots, err := svc.ListEntries(ctx, v.ID, nil)
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range roots {
		if e.ID == parent.ID || e.ID == child.ID {
			t.Fatalf("deleted entry still listed: %+v", roots)
		}
	}
}

// Recursive delete removes a nested folder subtree postorder in one
// transaction, and refuses atomically when any file, chunk, or job record
// depends on the subtree.
func TestDeleteFolderRecursive(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t, ctx)
	svc := New(store)
	v := seedVault(t, ctx, svc, "Personal")

	a, err := svc.CreateFolder(ctx, v.ID, nil, "A")
	if err != nil {
		t.Fatal(err)
	}
	b, err := svc.CreateFolder(ctx, v.ID, &a.ID, "B")
	if err != nil {
		t.Fatal(err)
	}
	c, err := svc.CreateFolder(ctx, v.ID, &b.ID, "C")
	if err != nil {
		t.Fatal(err)
	}
	keep, err := svc.CreateFolder(ctx, v.ID, nil, "Keep")
	if err != nil {
		t.Fatal(err)
	}
	if err := svc.DeleteFolder(ctx, a.ID, true); err != nil {
		t.Fatal(err)
	}
	for _, id := range []string{a.ID, b.ID, c.ID} {
		if err := store.WithTx(ctx, func(tx *database.Tx) error {
			_, err := tx.GetEntry(ctx, id)
			return err
		}); codeOf(t, err) != domain.CodeNotFound {
			t.Fatalf("entry %s must be gone: %v", id, err)
		}
	}
	roots, err := svc.ListEntries(ctx, v.ID, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(roots) != 1 || roots[0].ID != keep.ID {
		t.Fatalf("outside subtree must survive: %+v", roots)
	}

	// A file inside the subtree blocks with zero mutation.
	withFile, err := svc.CreateFolder(ctx, v.ID, nil, "WithFile")
	if err != nil {
		t.Fatal(err)
	}
	fentry := domain.Entry{
		ID: "file-1", VaultID: v.ID, ParentID: &withFile.ID, Kind: domain.EntryKindFile,
		Name: "note.txt", NameKey: "note.txt", Status: domain.EntryStatusAvailable,
		CreatedAt: millisNow(), UpdatedAt: millisNow(),
	}
	seedRawEntry(t, ctx, store, fentry)
	if err := svc.DeleteFolder(ctx, withFile.ID, true); codeOf(t, err) != domain.CodeOperationUnavailable {
		t.Fatalf("file dependency: %v", err)
	}
	kids, err := svc.ListEntries(ctx, v.ID, &withFile.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(kids) != 1 {
		t.Fatalf("blocked delete must not mutate: %+v", kids)
	}

	// A job referencing the subtree blocks with the job identity named.
	withJob, err := svc.CreateFolder(ctx, v.ID, nil, "WithJob")
	if err != nil {
		t.Fatal(err)
	}
	now := millisNow()
	job := domain.Job{
		ID: "job-1", Type: domain.JobTypeVerify, VaultID: v.ID, EntryID: &withJob.ID,
		State:     domain.JobStateQueued,
		CreatedAt: now, UpdatedAt: now,
	}
	if err := store.WithTx(ctx, func(tx *database.Tx) error { return tx.InsertJob(ctx, job) }); err != nil {
		t.Fatal(err)
	}
	err = svc.DeleteFolder(ctx, withJob.ID, true)
	if codeOf(t, err) != domain.CodeOperationUnavailable {
		t.Fatalf("job dependency: %v", err)
	}
	var derr *domain.Error
	if errors.As(err, &derr) && (derr.Message == "" || !strings.Contains(derr.Message, "job-1")) {
		t.Fatalf("job blocker must name the job identity: %q", derr.Message)
	}
	if _, err := svc.GetVault(ctx, v.ID); err != nil {
		t.Fatalf("vault must survive blocked delete: %v", err)
	}
}

// A corrupted store cycle reports INVALID_HIERARCHY instead of recursing
// forever. The repository layer performs no cycle check, so the cycle is
// crafted there; the service must still refuse safely.
func TestDeleteFolderRecursiveCorruptedCycle(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t, ctx)
	svc := New(store)
	v := seedVault(t, ctx, svc, "Personal")

	a, err := svc.CreateFolder(ctx, v.ID, nil, "A")
	if err != nil {
		t.Fatal(err)
	}
	b, err := svc.CreateFolder(ctx, v.ID, &a.ID, "B")
	if err != nil {
		t.Fatal(err)
	}
	now := millisNow()
	if err := store.WithTx(ctx, func(tx *database.Tx) error {
		if err := tx.MoveEntry(ctx, a.ID, &b.ID, now); err != nil {
			return err
		}
		return tx.MoveEntry(ctx, b.ID, &a.ID, now)
	}); err != nil {
		t.Fatal(err)
	}
	if err := svc.DeleteFolder(ctx, a.ID, true); codeOf(t, err) != domain.CodeInvalidHierarchy {
		t.Fatalf("corrupted cycle: %v", err)
	}
}
