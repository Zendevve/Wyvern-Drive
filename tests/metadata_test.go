// Package tests proves the T5 folder operations end to end: metadata-only
// vaults and nested folders survive an application restart with identities
// intact, and concurrent operations serialize without corrupting the
// hierarchy. Barriers use channels only, never timing sleeps.
package tests

import (
	"context"
	"errors"
	"log/slog"
	"testing"

	"wyvern-drive/internal/app"
	"wyvern-drive/internal/config"
	"wyvern-drive/internal/database"
	"wyvern-drive/internal/domain"
	"wyvern-drive/internal/filesystem"
	"wyvern-drive/internal/logging"
)

func openApp(t *testing.T, ctx context.Context, dir string) *app.App {
	t.Helper()
	logger, closer, err := logging.New(dir, slog.LevelInfo)
	if err != nil {
		t.Fatal(err)
	}
	cfg := config.Config{DataDir: dir, ListenAddress: "127.0.0.1:0", LogLevel: "INFO"}
	a, err := app.Open(ctx, cfg, logger, closer)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = a.Close() })
	return a
}

func codeOf(err error) (domain.Code, bool) {
	var derr *domain.Error
	if !errors.As(err, &derr) {
		return "", false
	}
	return derr.Code, true
}

// Creating a metadata-only vault plus nested folders, renaming, moving to
// root, and storing synthetic file/chunk/job metadata survives close and
// reopen on the same data directory: IDs are stable, the final hierarchy
// holds, and large int64 sizes round-trip exactly. No bytes are uploaded:
// every record is metadata rows only.
func TestMetadataSurvivesRestart(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()

	first := openApp(t, ctx, dir)
	svc := filesystem.New(first.Store())

	vault, err := svc.CreateLocalVault(ctx, "Personal")
	if err != nil {
		t.Fatal(err)
	}
	projects, err := svc.CreateFolder(ctx, vault.ID, nil, "Projects")
	if err != nil {
		t.Fatal(err)
	}
	docs, err := svc.CreateFolder(ctx, vault.ID, &projects.ID, "Docs")
	if err != nil {
		t.Fatal(err)
	}
	notes, err := svc.RenameEntry(ctx, docs.ID, "Notes")
	if err != nil {
		t.Fatal(err)
	}
	notes, err = svc.MoveEntry(ctx, notes.ID, nil)
	if err != nil {
		t.Fatal(err)
	}

	// Synthetic file/chunk/job metadata rows, backend-shaped but carrying
	// no payload: identifiers use the synthetic-test/test-msg-N/test-att-N
	// family only.
	fileEntry := domain.Entry{
		ID: "synthetic-file-1", VaultID: vault.ID, ParentID: &projects.ID,
		Kind: domain.EntryKindFile, Name: "big.bin", NameKey: "big.bin",
		Status: domain.EntryStatusAvailable, Size: 4611686018427387904,
		CreatedAt: notes.CreatedAt, UpdatedAt: notes.UpdatedAt,
	}
	const (
		plainSize  = int64(4611686018427387904)
		cipherSize = int64(4611686018427388004)
		bytesDone  = int64(4611686018427387903)
		itemsTotal = int64(1099511627776)
	)
	file := domain.File{
		EntryID: fileEntry.ID, WrappedFileKey: []byte("synthetic-test-key-material"),
		ChunkSize: 16777216, ChunkCount: 3,
		SHA256:    bytesRepeat(0x5A, 32),
		CreatedAt: notes.CreatedAt,
	}
	chunk := domain.Chunk{
		ID: "synthetic-chunk-1", FileEntryID: fileEntry.ID, ChunkIndex: 0,
		BackendType: "synthetic-test", MessageID: "test-msg-1", AttachmentID: "test-att-1",
		RemoteName: "test-remote-1", Nonce: bytesRepeat(0xA5, 24),
		PlaintextSize: plainSize, CiphertextSize: cipherSize,
		PlaintextSHA256: bytesRepeat(0x5A, 32),
		CreatedAt:       notes.CreatedAt,
	}
	job := domain.Job{
		ID: "synthetic-job-1", Type: domain.JobTypeVerify, VaultID: vault.ID, EntryID: &fileEntry.ID,
		State:      domain.JobStateQueued,
		BytesTotal: plainSize, BytesCompleted: bytesDone,
		ItemsTotal: itemsTotal, ItemsCompleted: itemsTotal,
		CreatedAt: notes.CreatedAt, UpdatedAt: notes.UpdatedAt,
	}
	if err := first.Store().WithTx(ctx, func(tx *database.Tx) error {
		if err := tx.InsertEntry(ctx, fileEntry); err != nil {
			return err
		}
		if err := tx.InsertFile(ctx, file); err != nil {
			return err
		}
		if err := tx.InsertChunk(ctx, chunk); err != nil {
			return err
		}
		return tx.InsertJob(ctx, job)
	}); err != nil {
		t.Fatal(err)
	}

	if err := first.Close(); err != nil {
		t.Fatal(err)
	}

	second := openApp(t, ctx, dir)
	svc2 := filesystem.New(second.Store())

	again, err := svc2.GetVault(ctx, vault.ID)
	if err != nil {
		t.Fatal(err)
	}
	if again.Name != "Personal" || again.State != domain.VaultStateMetadataOnly {
		t.Fatalf("vault after restart = %+v", again)
	}
	roots, err := svc2.ListEntries(ctx, vault.ID, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(roots) != 2 {
		t.Fatalf("roots after restart = %+v, want Projects + Notes", roots)
	}
	byID := map[string]domain.Entry{}
	for _, e := range roots {
		byID[e.ID] = e
	}
	if byID[projects.ID].Name != "Projects" || byID[projects.ID].ParentID != nil {
		t.Fatalf("Projects after restart = %+v", byID[projects.ID])
	}
	if byID[notes.ID].Name != "Notes" || byID[notes.ID].ParentID != nil {
		t.Fatalf("Notes after restart = %+v", byID[notes.ID])
	}
	underProjects, err := svc2.ListEntries(ctx, vault.ID, &projects.ID)
	if err != nil {
		t.Fatal(err)
	}
	if underProjects == nil || len(underProjects) != 1 || underProjects[0].ID != fileEntry.ID {
		t.Fatalf("children of Projects after restart = %+v", underProjects)
	}

	gotFile, err := second.Store().GetFile(ctx, fileEntry.ID)
	if err != nil {
		t.Fatal(err)
	}
	if gotFile.ChunkSize != file.ChunkSize || gotFile.ChunkCount != file.ChunkCount {
		t.Fatalf("file after restart = %+v, want %+v", gotFile, file)
	}
	gotChunks, err := second.Store().ListChunks(ctx, fileEntry.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(gotChunks) != 1 || gotChunks[0].PlaintextSize != plainSize || gotChunks[0].CiphertextSize != cipherSize {
		t.Fatalf("chunks after restart = %+v", gotChunks)
	}
	if gotChunks[0].MessageID != "test-msg-1" || gotChunks[0].AttachmentID != "test-att-1" {
		t.Fatalf("chunk identities after restart = %+v", gotChunks[0])
	}
	gotJob, err := second.Store().GetJob(ctx, job.ID)
	if err != nil {
		t.Fatal(err)
	}
	if gotJob.BytesTotal != plainSize || gotJob.BytesCompleted != bytesDone || gotJob.ItemsTotal != itemsTotal || gotJob.ItemsCompleted != itemsTotal {
		t.Fatalf("job after restart = %+v", gotJob)
	}
}

func bytesRepeat(b byte, n int) []byte {
	out := make([]byte, n)
	for i := range out {
		out[i] = b
	}
	return out
}

// Racing case-equivalent sibling creations serializes to exactly one
// success and one FILE_CONFLICT. Both goroutines signal ready, then start
// together on the closed barrier: no sleeps.
func TestMetadataConcurrency(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()

	a := openApp(t, ctx, dir)
	svc := filesystem.New(a.Store())
	vault, err := svc.CreateLocalVault(ctx, "Personal")
	if err != nil {
		t.Fatal(err)
	}

	start := make(chan struct{})
	ready := make(chan struct{}, 2)
	errs := make(chan error, 2)
	for _, name := range []string{"Photos", "PHOTOS"} {
		go func(n string) {
			ready <- struct{}{}
			<-start
			_, err := svc.CreateFolder(ctx, vault.ID, nil, n)
			errs <- err
		}(name)
	}
	<-ready
	<-ready
	close(start)
	first, second := <-errs, <-errs

	succeeded := 0
	for _, err := range []error{first, second} {
		if err == nil {
			succeeded++
			continue
		}
		code, ok := codeOf(err)
		if !ok || code != domain.CodeFileConflict {
			t.Fatalf("racing create: loser = %v, want FILE_CONFLICT", err)
		}
	}
	if succeeded != 1 {
		t.Fatalf("racing create: %d successes, want exactly one", succeeded)
	}
	roots, err := svc.ListEntries(ctx, vault.ID, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(roots) != 1 {
		t.Fatalf("racing create left %d siblings, want one", len(roots))
	}
}

// Racing reciprocal moves across two store handles on the same data file
// serializes to exactly one success and one INVALID_HIERARCHY, with no
// cycle afterwards. The immediate-transaction locks make the second
// beginner wait for the first committer, so its ancestor walk sees the
// committed move.
func TestMetadataConcurrencyReciprocalMoves(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()

	first := openApp(t, ctx, dir)
	second := openApp(t, ctx, dir)
	svc1 := filesystem.New(first.Store())
	svc2 := filesystem.New(second.Store())

	vault, err := svc1.CreateLocalVault(ctx, "Personal")
	if err != nil {
		t.Fatal(err)
	}
	folderA, err := svc1.CreateFolder(ctx, vault.ID, nil, "A")
	if err != nil {
		t.Fatal(err)
	}
	folderB, err := svc1.CreateFolder(ctx, vault.ID, nil, "B")
	if err != nil {
		t.Fatal(err)
	}

	start := make(chan struct{})
	ready := make(chan struct{}, 2)
	errs := make(chan error, 2)
	go func() {
		ready <- struct{}{}
		<-start
		_, err := svc1.MoveEntry(ctx, folderA.ID, &folderB.ID)
		errs <- err
	}()
	go func() {
		ready <- struct{}{}
		<-start
		_, err := svc2.MoveEntry(ctx, folderB.ID, &folderA.ID)
		errs <- err
	}()
	<-ready
	<-ready
	close(start)
	moveA, moveB := <-errs, <-errs

	succeeded := 0
	for _, err := range []error{moveA, moveB} {
		if err == nil {
			succeeded++
			continue
		}
		code, ok := codeOf(err)
		if !ok || code != domain.CodeInvalidHierarchy {
			t.Fatalf("reciprocal moves: loser = %v, want INVALID_HIERARCHY", err)
		}
	}
	if succeeded != 1 {
		t.Fatalf("reciprocal moves: %d successes, want exactly one", succeeded)
	}

	// No cycle afterwards: every ancestor walk from either folder must
	// reach the vault root.
	for _, id := range []string{folderA.ID, folderB.ID} {
		visited := map[string]bool{}
		cur := id
		for {
			if visited[cur] {
				t.Fatalf("cycle detected after reciprocal moves at %q", cur)
			}
			visited[cur] = true
			node, err := first.Store().GetEntry(ctx, cur)
			if err != nil {
				t.Fatal(err)
			}
			if node.ParentID == nil {
				break
			}
			cur = *node.ParentID
		}
	}
}
