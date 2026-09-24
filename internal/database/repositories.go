// Package database owns durable local persistence: a single-connection
// SQLite store, explicit versioned migrations with VACUUM INTO backups,
// readiness reporting, and the transactional repository layer.
//
// All parameterized SQL lives in this package. Presentation layers never see
// a raw *sql.DB: reads exist on both Store and Tx, writes exist on Tx only,
// and every application mutation runs inside (*Store).WithTx so concurrent
// operations serialize on the single connection and failures roll back
// atomically. Row iterators are always fully consumed and closed before any
// further statement runs on that connection.
package database

import (
	"context"
	"database/sql"
	"errors"
	"time"

	sqlite "modernc.org/sqlite"

	"wyvern-drive/internal/domain"
)

// querier is the parameterized-SQL boundary every repository method goes
// through. Both *sql.DB and *sql.Tx satisfy it; no raw handle escapes to
// presentation. Helpers take a querier so Store reads and Tx reads/writes
// share one implementation.
type querier interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

// Tx is one serialized application transaction over the single-connection
// store. Reads mirror the Store surface so lookups preceding a mutation see
// the transaction's own writes; writes exist here only. Obtain one via
// (*Store).WithTx; never construct it directly.
type Tx struct {
	tx *sql.Tx
}

// Modernc numeric result codes, matched by number and never parsed from
// error text. The low byte is the primary code (19 = constraint); the full
// value names the failing constraint kind.
const (
	sqliteConstraintPrimary   = 19
	sqliteConstraintForeign   = 787
	sqliteConstraintPrimaryPK = 1555
	sqliteConstraintTrigger   = 1811
	sqliteConstraintUnique    = 2067
)

// sqliteCode extracts the numeric SQLite result code from err, unwrapping
// database/sql layers. It reports false for non-driver failures.
func sqliteCode(err error) (int, bool) {
	var serr *sqlite.Error
	if errors.As(err, &serr) {
		return serr.Code(), true
	}
	return 0, false
}

// mapConstraint maps a SQLite constraint failure to the caller's domain
// errors without parsing error text: unique and primary-key violations
// become (conflictCode, conflictMsg), foreign-key violations become
// (foreignCode, foreignMsg) unless foreignCode is empty. Anything else —
// including an unmapped foreign-key violation — becomes
// DATABASE_UNAVAILABLE without driver details.
func mapConstraint(err error, conflictCode domain.Code, conflictMsg string, foreignCode domain.Code, foreignMsg string) error {
	if code, ok := sqliteCode(err); ok && code&0xFF == sqliteConstraintPrimary {
		switch code {
		case sqliteConstraintUnique, sqliteConstraintPrimaryPK:
			return domain.New(conflictCode, conflictMsg)
		case sqliteConstraintForeign:
			if foreignCode != "" {
				return domain.New(foreignCode, foreignMsg)
			}
		}
	}
	return unavailable(err)
}

// unavailable wraps an internal database failure without driver details.
// The safe message never carries SQL, paths, or constraint text; the cause
// is retained for logs via Unwrap only.
func unavailable(err error) *domain.Error {
	return domain.Wrap(domain.CodeDatabaseUnavailable, "database operation failed", err)
}

// errUnavailable is the internal cause when the handle is already closed.
var errUnavailable = errors.New("database: unavailable")

// dbHandle returns the live handle or nil after Close.
func (s *Store) dbHandle() *sql.DB {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.db
}

// WithTx runs fn inside a single serialized transaction: fn's error rolls
// everything back, a panic rolls back and re-panics, a commit failure is
// surfaced as DATABASE_UNAVAILABLE, and nil fn success commits. The tx
// mutex serializes concurrent transactions on the single connection
// (ADR-0005); the loser of a genuine conflict fails honestly via the
// repository error codes instead of deadlocking.
func (s *Store) WithTx(ctx context.Context, fn func(*Tx) error) error {
	if fn == nil {
		return unavailable(errors.New("database: nil transaction function"))
	}
	s.txMu.Lock()
	defer s.txMu.Unlock()
	db := s.dbHandle()
	if db == nil {
		return unavailable(errUnavailable)
	}
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return unavailable(err)
	}
	defer func() {
		if p := recover(); p != nil {
			_ = tx.Rollback()
			panic(p)
		}
	}()
	if err := fn(&Tx{tx: tx}); err != nil {
		_ = tx.Rollback()
		return err
	}
	if err := tx.Commit(); err != nil {
		return unavailable(err)
	}
	return nil
}

// txQuerier returns the transaction handle or an unavailable error when Tx
// is unusable.
func (t *Tx) q() (*sql.Tx, error) {
	if t == nil || t.tx == nil {
		return nil, unavailable(errUnavailable)
	}
	return t.tx, nil
}

// toMillis stores a timestamp as UTC Unix milliseconds.
func toMillis(t time.Time) int64 { return t.UTC().UnixMilli() }

// fromMillis restores a stored UTC-millis timestamp at the API boundary.
func fromMillis(ms int64) time.Time { return time.UnixMilli(ms).UTC() }

// nullString maps an optional string to a storable argument.
func nullString(s *string) any {
	if s == nil {
		return nil
	}
	return *s
}

// nullTime maps an optional timestamp to storable UTC millis.
func nullTime(t *time.Time) any {
	if t == nil {
		return nil
	}
	return toMillis(*t)
}

// scanNullString restores an optional TEXT column.
func scanNullString(ns sql.NullString) *string {
	if !ns.Valid {
		return nil
	}
	s := ns.String
	return &s
}

// scanNullTime restores an optional millis column.
func scanNullTime(ni sql.NullInt64) *time.Time {
	if !ni.Valid {
		return nil
	}
	t := fromMillis(ni.Int64)
	return &t
}

// sameStringPtr reports whether two optional strings match, nil included.
func sameStringPtr(a, b *string) bool {
	if a == nil || b == nil {
		return a == b
	}
	return *a == *b
}

// validProgress rejects negative totals/progress and completed counts above
// their totals.
func validProgress(bytesTotal, bytesCompleted, itemsTotal, itemsCompleted int64) bool {
	if bytesTotal < 0 || bytesCompleted < 0 || itemsTotal < 0 || itemsCompleted < 0 {
		return false
	}
	if bytesCompleted > bytesTotal || itemsCompleted > itemsTotal {
		return false
	}
	return true
}

const selectVaultCols = `id, name, backend_type, state, chunk_size, encrypted_vault_key, recovery_anchor_message_id, created_at, updated_at`

// scanVault maps the current row of a vaults SELECT into a Vault.
func scanVault(rows *sql.Rows) (domain.Vault, error) {
	var v domain.Vault
	var state string
	var chunkSize, created, updated int64
	var anchor sql.NullString
	if err := rows.Scan(&v.ID, &v.Name, &v.BackendType, &state, &chunkSize, &v.EncryptedVaultKey, &anchor, &created, &updated); err != nil {
		return domain.Vault{}, err
	}
	v.State = domain.VaultState(state)
	v.ChunkSize = chunkSize
	v.RecoveryAnchorMessageID = scanNullString(anchor)
	v.CreatedAt = fromMillis(created)
	v.UpdatedAt = fromMillis(updated)
	return v, nil
}

// scanVaultRow maps a single-row vaults lookup into a Vault.
func scanVaultRow(row *sql.Row) (domain.Vault, error) {
	var v domain.Vault
	var state string
	var chunkSize, created, updated int64
	var anchor sql.NullString
	if err := row.Scan(&v.ID, &v.Name, &v.BackendType, &state, &chunkSize, &v.EncryptedVaultKey, &anchor, &created, &updated); err != nil {
		return domain.Vault{}, err
	}
	v.State = domain.VaultState(state)
	v.ChunkSize = chunkSize
	v.RecoveryAnchorMessageID = scanNullString(anchor)
	v.CreatedAt = fromMillis(created)
	v.UpdatedAt = fromMillis(updated)
	return v, nil
}

// queryVault reads one Vault by ID through q.
func queryVault(ctx context.Context, q querier, id string) (domain.Vault, error) {
	v, err := scanVaultRow(q.QueryRowContext(ctx, `SELECT `+selectVaultCols+` FROM vaults WHERE id = ?;`, id))
	if err == sql.ErrNoRows {
		return domain.Vault{}, domain.New(domain.CodeNotFound, "vault not found")
	}
	if err != nil {
		return domain.Vault{}, unavailable(err)
	}
	return v, nil
}

// queryVaults lists every Vault through q in stable ID order.
func queryVaults(ctx context.Context, q querier) ([]domain.Vault, error) {
	rows, err := q.QueryContext(ctx, `SELECT `+selectVaultCols+` FROM vaults ORDER BY id ASC;`)
	if err != nil {
		return nil, unavailable(err)
	}
	defer func() { _ = rows.Close() }()
	out := []domain.Vault{}
	for rows.Next() {
		v, err := scanVault(rows)
		if err != nil {
			return nil, unavailable(err)
		}
		out = append(out, v)
	}
	if err := rows.Err(); err != nil {
		return nil, unavailable(err)
	}
	return out, nil
}

// GetVault returns the Vault with id or NOT_FOUND.
func (s *Store) GetVault(ctx context.Context, id string) (domain.Vault, error) {
	db := s.dbHandle()
	if db == nil {
		return domain.Vault{}, unavailable(errUnavailable)
	}
	return queryVault(ctx, db, id)
}

// GetVault reads one Vault inside the transaction.
func (t *Tx) GetVault(ctx context.Context, id string) (domain.Vault, error) {
	tx, err := t.q()
	if err != nil {
		return domain.Vault{}, err
	}
	return queryVault(ctx, tx, id)
}

// ListVaults returns every Vault in stable ID order, never nil.
func (s *Store) ListVaults(ctx context.Context) ([]domain.Vault, error) {
	db := s.dbHandle()
	if db == nil {
		return nil, unavailable(errUnavailable)
	}
	return queryVaults(ctx, db)
}

// ListVaults lists every Vault inside the transaction.
func (t *Tx) ListVaults(ctx context.Context) ([]domain.Vault, error) {
	tx, err := t.q()
	if err != nil {
		return nil, err
	}
	return queryVaults(ctx, tx)
}

// InsertVault stores a new Vault. A duplicate ID is FILE_CONFLICT.
func (t *Tx) InsertVault(ctx context.Context, v domain.Vault) error {
	tx, err := t.q()
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO vaults(id, name, backend_type, state, chunk_size, encrypted_vault_key, recovery_anchor_message_id, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?);`,
		v.ID, v.Name, v.BackendType, string(v.State), v.ChunkSize, v.EncryptedVaultKey, nullString(v.RecoveryAnchorMessageID), toMillis(v.CreatedAt), toMillis(v.UpdatedAt))
	if err != nil {
		return mapConstraint(err, domain.CodeFileConflict, "vault already exists", "", "")
	}
	return nil
}

const selectEntryCols = `id, vault_id, parent_id, kind, name, name_key, status, size, mime_type, created_at, updated_at, deleted_at`

// scanEntryRow maps a single-row entries lookup into an Entry.
func scanEntryRow(row *sql.Row) (domain.Entry, error) {
	var e domain.Entry
	var parent, mime sql.NullString
	var kind, status string
	var size, created, updated int64
	var deleted sql.NullInt64
	if err := row.Scan(&e.ID, &e.VaultID, &parent, &kind, &e.Name, &e.NameKey, &status, &size, &mime, &created, &updated, &deleted); err != nil {
		return domain.Entry{}, err
	}
	e.ParentID = scanNullString(parent)
	e.Kind = domain.EntryKind(kind)
	e.Status = domain.EntryStatus(status)
	e.Size = size
	e.MimeType = scanNullString(mime)
	e.CreatedAt = fromMillis(created)
	e.UpdatedAt = fromMillis(updated)
	e.DeletedAt = scanNullTime(deleted)
	return e, nil
}

// scanEntry maps the current row of an entries SELECT into an Entry.
func scanEntry(rows *sql.Rows) (domain.Entry, error) {
	var e domain.Entry
	var parent, mime sql.NullString
	var kind, status string
	var size, created, updated int64
	var deleted sql.NullInt64
	if err := rows.Scan(&e.ID, &e.VaultID, &parent, &kind, &e.Name, &e.NameKey, &status, &size, &mime, &created, &updated, &deleted); err != nil {
		return domain.Entry{}, err
	}
	e.ParentID = scanNullString(parent)
	e.Kind = domain.EntryKind(kind)
	e.Status = domain.EntryStatus(status)
	e.Size = size
	e.MimeType = scanNullString(mime)
	e.CreatedAt = fromMillis(created)
	e.UpdatedAt = fromMillis(updated)
	e.DeletedAt = scanNullTime(deleted)
	return e, nil
}

// queryEntry reads one Entry by ID through q.
func queryEntry(ctx context.Context, q querier, id string) (domain.Entry, error) {
	e, err := scanEntryRow(q.QueryRowContext(ctx, `SELECT `+selectEntryCols+` FROM entries WHERE id = ?;`, id))
	if err == sql.ErrNoRows {
		return domain.Entry{}, domain.New(domain.CodeNotFound, "entry not found")
	}
	if err != nil {
		return domain.Entry{}, unavailable(err)
	}
	return e, nil
}

// queryEntries lists the non-deleted children of one parent (roots when
// parentID is nil) through q in stable name order.
func queryEntries(ctx context.Context, q querier, vaultID string, parentID *string) ([]domain.Entry, error) {
	var rows *sql.Rows
	var err error
	if parentID == nil {
		rows, err = q.QueryContext(ctx, `SELECT `+selectEntryCols+` FROM entries WHERE vault_id = ? AND parent_id IS NULL AND deleted_at IS NULL ORDER BY name_key ASC, id ASC;`, vaultID)
	} else {
		rows, err = q.QueryContext(ctx, `SELECT `+selectEntryCols+` FROM entries WHERE vault_id = ? AND parent_id = ? AND deleted_at IS NULL ORDER BY name_key ASC, id ASC;`, vaultID, *parentID)
	}
	if err != nil {
		return nil, unavailable(err)
	}
	defer func() { _ = rows.Close() }()
	out := []domain.Entry{}
	for rows.Next() {
		e, err := scanEntry(rows)
		if err != nil {
			return nil, unavailable(err)
		}
		out = append(out, e)
	}
	if err := rows.Err(); err != nil {
		return nil, unavailable(err)
	}
	return out, nil
}

// GetEntry returns the Entry with id or NOT_FOUND.
func (s *Store) GetEntry(ctx context.Context, id string) (domain.Entry, error) {
	db := s.dbHandle()
	if db == nil {
		return domain.Entry{}, unavailable(errUnavailable)
	}
	return queryEntry(ctx, db, id)
}

// GetEntry reads one Entry inside the transaction.
func (t *Tx) GetEntry(ctx context.Context, id string) (domain.Entry, error) {
	tx, err := t.q()
	if err != nil {
		return domain.Entry{}, err
	}
	return queryEntry(ctx, tx, id)
}

// ListEntries returns the non-deleted children of one parent in a Vault,
// roots when parentID is nil, in stable name order and never nil.
func (s *Store) ListEntries(ctx context.Context, vaultID string, parentID *string) ([]domain.Entry, error) {
	db := s.dbHandle()
	if db == nil {
		return nil, unavailable(errUnavailable)
	}
	return queryEntries(ctx, db, vaultID, parentID)
}

// ListEntries lists children inside the transaction.
func (t *Tx) ListEntries(ctx context.Context, vaultID string, parentID *string) ([]domain.Entry, error) {
	tx, err := t.q()
	if err != nil {
		return nil, err
	}
	return queryEntries(ctx, tx, vaultID, parentID)
}

// checkEntryParent validates a non-nil parent in-transaction: it must exist
// in the same Vault and be a folder. Every rejection is INVALID_PARENT.
func checkEntryParent(ctx context.Context, tx *sql.Tx, vaultID string, parentID *string) error {
	var pvault, pkind string
	err := tx.QueryRowContext(ctx, `SELECT vault_id, kind FROM entries WHERE id = ?;`, *parentID).Scan(&pvault, &pkind)
	if err == sql.ErrNoRows {
		return domain.New(domain.CodeInvalidParent, "parent entry not found")
	}
	if err != nil {
		return unavailable(err)
	}
	if pvault != vaultID {
		return domain.New(domain.CodeInvalidParent, "parent entry belongs to another vault")
	}
	if pkind != string(domain.EntryKindFolder) {
		return domain.New(domain.CodeInvalidParent, "parent entry is not a folder")
	}
	return nil
}

// InsertEntry stores a new Entry after validating vault membership and the
// parent in-transaction. A missing Vault is NOT_FOUND; a missing,
// cross-vault, or non-folder parent is INVALID_PARENT; a duplicate ID or a
// sibling name collision is FILE_CONFLICT.
func (t *Tx) InsertEntry(ctx context.Context, e domain.Entry) error {
	tx, err := t.q()
	if err != nil {
		return err
	}
	var one int
	err = tx.QueryRowContext(ctx, `SELECT 1 FROM vaults WHERE id = ?;`, e.VaultID).Scan(&one)
	if err == sql.ErrNoRows {
		return domain.New(domain.CodeNotFound, "vault not found")
	}
	if err != nil {
		return unavailable(err)
	}
	if e.ParentID != nil {
		if err := checkEntryParent(ctx, tx, e.VaultID, e.ParentID); err != nil {
			return err
		}
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO entries(id, vault_id, parent_id, kind, name, name_key, status, size, mime_type, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
		e.ID, e.VaultID, nullString(e.ParentID), string(e.Kind), e.Name, e.NameKey, string(e.Status), e.Size, nullString(e.MimeType), toMillis(e.CreatedAt), toMillis(e.UpdatedAt))
	if err != nil {
		return mapConstraint(err, domain.CodeFileConflict, "entry name already exists", domain.CodeInvalidParent, "invalid parent entry")
	}
	return nil
}

// RenameEntry changes an entry's display name, lookup key, and timestamp,
// preserving its ID, parent, and children. A name collision fails with
// FILE_CONFLICT and leaves the old name in place; a missing entry is
// NOT_FOUND.
func (t *Tx) RenameEntry(ctx context.Context, id, name, nameKey string, updatedAt time.Time) error {
	tx, err := t.q()
	if err != nil {
		return err
	}
	var one int
	err = tx.QueryRowContext(ctx, `SELECT 1 FROM entries WHERE id = ?;`, id).Scan(&one)
	if err == sql.ErrNoRows {
		return domain.New(domain.CodeNotFound, "entry not found")
	}
	if err != nil {
		return unavailable(err)
	}
	res, err := tx.ExecContext(ctx, `UPDATE entries SET name = ?, name_key = ?, updated_at = ? WHERE id = ?;`, name, nameKey, toMillis(updatedAt), id)
	if err != nil {
		return mapConstraint(err, domain.CodeFileConflict, "entry name already exists", "", "")
	}
	n, err := res.RowsAffected()
	if err != nil {
		return unavailable(err)
	}
	if n == 0 {
		return domain.New(domain.CodeNotFound, "entry not found")
	}
	return nil
}

// MoveEntry re-parents an entry, or returns it to the Vault root when
// parentID is nil, stamping updatedAt. The destination must exist in the
// same Vault and be a folder; self-moves, missing or cross-vault or
// non-folder destinations are INVALID_PARENT. A sibling name collision in
// the destination is FILE_CONFLICT and the hierarchy is unchanged.
func (t *Tx) MoveEntry(ctx context.Context, id string, parentID *string, updatedAt time.Time) error {
	tx, err := t.q()
	if err != nil {
		return err
	}
	var vaultID string
	err = tx.QueryRowContext(ctx, `SELECT vault_id FROM entries WHERE id = ?;`, id).Scan(&vaultID)
	if err == sql.ErrNoRows {
		return domain.New(domain.CodeNotFound, "entry not found")
	}
	if err != nil {
		return unavailable(err)
	}
	if parentID != nil {
		if *parentID == id {
			return domain.New(domain.CodeInvalidParent, "cannot move an entry beneath itself")
		}
		if err := checkEntryParent(ctx, tx, vaultID, parentID); err != nil {
			return err
		}
	}
	_, err = tx.ExecContext(ctx, `UPDATE entries SET parent_id = ?, updated_at = ? WHERE id = ?;`, nullString(parentID), toMillis(updatedAt), id)
	if err != nil {
		return mapConstraint(err, domain.CodeFileConflict, "entry name already exists", domain.CodeInvalidParent, "invalid parent entry")
	}
	return nil
}

// DeleteEntry removes one entry row. Dependents (child entries, file
// records, or job references) block the delete with OPERATION_UNAVAILABLE
// via RESTRICT; a missing entry is NOT_FOUND. Subtree policy lives above
// this layer.
func (t *Tx) DeleteEntry(ctx context.Context, id string) error {
	tx, err := t.q()
	if err != nil {
		return err
	}
	var one int
	err = tx.QueryRowContext(ctx, `SELECT 1 FROM entries WHERE id = ?;`, id).Scan(&one)
	if err == sql.ErrNoRows {
		return domain.New(domain.CodeNotFound, "entry not found")
	}
	if err != nil {
		return unavailable(err)
	}
	_, err = tx.ExecContext(ctx, `DELETE FROM entries WHERE id = ?;`, id)
	if err != nil {
		// Deferred RESTRICT enforcement surfaces as the plain foreign-key
		// code (787); immediate RESTRICT surfaces as the trigger code
		// (1811). Both mean a dependent row blocks the delete.
		if code, ok := sqliteCode(err); ok && code&0xFF == sqliteConstraintPrimary && (code == sqliteConstraintForeign || code == sqliteConstraintTrigger) {
			return domain.New(domain.CodeOperationUnavailable, "entry has dependencies and cannot be deleted")
		}
		return unavailable(err)
	}
	return nil
}

const selectFileCols = `entry_id, wrapped_file_key, chunk_size, chunk_count, sha256, created_at`

// scanFileRow maps a single-row files lookup into a File.
func scanFileRow(row *sql.Row) (domain.File, error) {
	var f domain.File
	var chunkSize, chunkCount, created int64
	if err := row.Scan(&f.EntryID, &f.WrappedFileKey, &chunkSize, &chunkCount, &f.SHA256, &created); err != nil {
		return domain.File{}, err
	}
	f.ChunkSize = chunkSize
	f.ChunkCount = chunkCount
	f.CreatedAt = fromMillis(created)
	return f, nil
}

// queryFile reads one File record by entry ID through q.
func queryFile(ctx context.Context, q querier, entryID string) (domain.File, error) {
	f, err := scanFileRow(q.QueryRowContext(ctx, `SELECT `+selectFileCols+` FROM files WHERE entry_id = ?;`, entryID))
	if err == sql.ErrNoRows {
		return domain.File{}, domain.New(domain.CodeNotFound, "file record not found")
	}
	if err != nil {
		return domain.File{}, unavailable(err)
	}
	return f, nil
}

// GetFile returns the file record for an entry or NOT_FOUND.
func (s *Store) GetFile(ctx context.Context, entryID string) (domain.File, error) {
	db := s.dbHandle()
	if db == nil {
		return domain.File{}, unavailable(errUnavailable)
	}
	return queryFile(ctx, db, entryID)
}

// GetFile reads one file record inside the transaction.
func (t *Tx) GetFile(ctx context.Context, entryID string) (domain.File, error) {
	tx, err := t.q()
	if err != nil {
		return domain.File{}, err
	}
	return queryFile(ctx, tx, entryID)
}

// InsertFile stores the file record for a file-kind entry, validated
// in-transaction. A missing entry is NOT_FOUND; a folder-kind entry is
// INVALID_PARENT; a duplicate record is FILE_CONFLICT.
func (t *Tx) InsertFile(ctx context.Context, f domain.File) error {
	tx, err := t.q()
	if err != nil {
		return err
	}
	var kind string
	err = tx.QueryRowContext(ctx, `SELECT kind FROM entries WHERE id = ?;`, f.EntryID).Scan(&kind)
	if err == sql.ErrNoRows {
		return domain.New(domain.CodeNotFound, "entry not found")
	}
	if err != nil {
		return unavailable(err)
	}
	if kind != string(domain.EntryKindFile) {
		return domain.New(domain.CodeInvalidParent, "entry is not a file")
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO files(entry_id, wrapped_file_key, chunk_size, chunk_count, sha256, created_at) VALUES(?, ?, ?, ?, ?, ?);`,
		f.EntryID, f.WrappedFileKey, f.ChunkSize, f.ChunkCount, f.SHA256, toMillis(f.CreatedAt))
	if err != nil {
		return mapConstraint(err, domain.CodeFileConflict, "file record already exists", domain.CodeNotFound, "entry not found")
	}
	return nil
}

const selectChunkCols = `id, file_entry_id, chunk_index, backend_type, message_id, attachment_id, remote_name, nonce, plaintext_size, ciphertext_size, plaintext_sha256, created_at`

// scanChunk maps the current row of a chunks SELECT into a Chunk.
func scanChunk(rows *sql.Rows) (domain.Chunk, error) {
	var c domain.Chunk
	var index, plain, cipher, created int64
	if err := rows.Scan(&c.ID, &c.FileEntryID, &index, &c.BackendType, &c.MessageID, &c.AttachmentID, &c.RemoteName, &c.Nonce, &plain, &cipher, &c.PlaintextSHA256, &created); err != nil {
		return domain.Chunk{}, err
	}
	c.ChunkIndex = index
	c.PlaintextSize = plain
	c.CiphertextSize = cipher
	c.CreatedAt = fromMillis(created)
	return c, nil
}

// queryChunks lists a file's chunks through q ordered by chunk index.
func queryChunks(ctx context.Context, q querier, entryID string) ([]domain.Chunk, error) {
	rows, err := q.QueryContext(ctx, `SELECT `+selectChunkCols+` FROM chunks WHERE file_entry_id = ? ORDER BY chunk_index ASC;`, entryID)
	if err != nil {
		return nil, unavailable(err)
	}
	defer func() { _ = rows.Close() }()
	out := []domain.Chunk{}
	for rows.Next() {
		c, err := scanChunk(rows)
		if err != nil {
			return nil, unavailable(err)
		}
		out = append(out, c)
	}
	if err := rows.Err(); err != nil {
		return nil, unavailable(err)
	}
	return out, nil
}

// ListChunks returns a file's chunk metadata ordered by chunk index,
// never nil.
func (s *Store) ListChunks(ctx context.Context, entryID string) ([]domain.Chunk, error) {
	db := s.dbHandle()
	if db == nil {
		return nil, unavailable(errUnavailable)
	}
	return queryChunks(ctx, db, entryID)
}

// ListChunks lists chunk metadata inside the transaction.
func (t *Tx) ListChunks(ctx context.Context, entryID string) ([]domain.Chunk, error) {
	tx, err := t.q()
	if err != nil {
		return nil, err
	}
	return queryChunks(ctx, tx, entryID)
}

// InsertChunk stores one chunk metadata row for a known file record. A
// missing file record is NOT_FOUND; a duplicate chunk index or ID is
// FILE_CONFLICT.
func (t *Tx) InsertChunk(ctx context.Context, c domain.Chunk) error {
	tx, err := t.q()
	if err != nil {
		return err
	}
	var one int
	err = tx.QueryRowContext(ctx, `SELECT 1 FROM files WHERE entry_id = ?;`, c.FileEntryID).Scan(&one)
	if err == sql.ErrNoRows {
		return domain.New(domain.CodeNotFound, "file record not found")
	}
	if err != nil {
		return unavailable(err)
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO chunks(id, file_entry_id, chunk_index, backend_type, message_id, attachment_id, remote_name, nonce, plaintext_size, ciphertext_size, plaintext_sha256, created_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
		c.ID, c.FileEntryID, c.ChunkIndex, c.BackendType, c.MessageID, c.AttachmentID, c.RemoteName, c.Nonce, c.PlaintextSize, c.CiphertextSize, c.PlaintextSHA256, toMillis(c.CreatedAt))
	if err != nil {
		return mapConstraint(err, domain.CodeFileConflict, "chunk already exists", domain.CodeNotFound, "file record not found")
	}
	return nil
}

const selectJobCols = `id, type, vault_id, entry_id, state, source_path, destination_path, bytes_total, bytes_completed, items_total, items_completed, error_code, error_message, created_at, updated_at, started_at, completed_at`

// scanJobRow maps a single-row jobs lookup into a Job.
func scanJobRow(row *sql.Row) (domain.Job, error) {
	var j domain.Job
	var typ, state string
	var entry, source, dest, errCode, errMsg sql.NullString
	var created, updated int64
	var started, completed sql.NullInt64
	if err := row.Scan(&j.ID, &typ, &j.VaultID, &entry, &state, &source, &dest, &j.BytesTotal, &j.BytesCompleted, &j.ItemsTotal, &j.ItemsCompleted, &errCode, &errMsg, &created, &updated, &started, &completed); err != nil {
		return domain.Job{}, err
	}
	j.Type = domain.JobType(typ)
	j.EntryID = scanNullString(entry)
	j.State = domain.JobState(state)
	j.SourcePath = scanNullString(source)
	j.DestinationPath = scanNullString(dest)
	j.ErrorCode = scanNullString(errCode)
	j.ErrorMessage = scanNullString(errMsg)
	j.CreatedAt = fromMillis(created)
	j.UpdatedAt = fromMillis(updated)
	j.StartedAt = scanNullTime(started)
	j.CompletedAt = scanNullTime(completed)
	return j, nil
}

// scanJob maps the current row of a jobs SELECT into a Job.
func scanJob(rows *sql.Rows) (domain.Job, error) {
	var j domain.Job
	var typ, state string
	var entry, source, dest, errCode, errMsg sql.NullString
	var created, updated int64
	var started, completed sql.NullInt64
	if err := rows.Scan(&j.ID, &typ, &j.VaultID, &entry, &state, &source, &dest, &j.BytesTotal, &j.BytesCompleted, &j.ItemsTotal, &j.ItemsCompleted, &errCode, &errMsg, &created, &updated, &started, &completed); err != nil {
		return domain.Job{}, err
	}
	j.Type = domain.JobType(typ)
	j.EntryID = scanNullString(entry)
	j.State = domain.JobState(state)
	j.SourcePath = scanNullString(source)
	j.DestinationPath = scanNullString(dest)
	j.ErrorCode = scanNullString(errCode)
	j.ErrorMessage = scanNullString(errMsg)
	j.CreatedAt = fromMillis(created)
	j.UpdatedAt = fromMillis(updated)
	j.StartedAt = scanNullTime(started)
	j.CompletedAt = scanNullTime(completed)
	return j, nil
}

// queryJob reads one Job by ID through q.
func queryJob(ctx context.Context, q querier, id string) (domain.Job, error) {
	j, err := scanJobRow(q.QueryRowContext(ctx, `SELECT `+selectJobCols+` FROM jobs WHERE id = ?;`, id))
	if err == sql.ErrNoRows {
		return domain.Job{}, domain.New(domain.CodeNotFound, "job not found")
	}
	if err != nil {
		return domain.Job{}, unavailable(err)
	}
	return j, nil
}

// queryJobs lists every Job through q in stable creation order.
func queryJobs(ctx context.Context, q querier) ([]domain.Job, error) {
	rows, err := q.QueryContext(ctx, `SELECT `+selectJobCols+` FROM jobs ORDER BY created_at ASC, id ASC;`)
	if err != nil {
		return nil, unavailable(err)
	}
	defer func() { _ = rows.Close() }()
	out := []domain.Job{}
	for rows.Next() {
		j, err := scanJob(rows)
		if err != nil {
			return nil, unavailable(err)
		}
		out = append(out, j)
	}
	if err := rows.Err(); err != nil {
		return nil, unavailable(err)
	}
	return out, nil
}

// GetJob returns the Job with id or NOT_FOUND.
func (s *Store) GetJob(ctx context.Context, id string) (domain.Job, error) {
	db := s.dbHandle()
	if db == nil {
		return domain.Job{}, unavailable(errUnavailable)
	}
	return queryJob(ctx, db, id)
}

// GetJob reads one Job inside the transaction.
func (t *Tx) GetJob(ctx context.Context, id string) (domain.Job, error) {
	tx, err := t.q()
	if err != nil {
		return domain.Job{}, err
	}
	return queryJob(ctx, tx, id)
}

// ListJobs returns every Job in stable creation order, never nil.
func (s *Store) ListJobs(ctx context.Context) ([]domain.Job, error) {
	db := s.dbHandle()
	if db == nil {
		return nil, unavailable(errUnavailable)
	}
	return queryJobs(ctx, db)
}

// ListJobs lists every Job inside the transaction.
func (t *Tx) ListJobs(ctx context.Context) ([]domain.Job, error) {
	tx, err := t.q()
	if err != nil {
		return nil, err
	}
	return queryJobs(ctx, tx)
}

// InsertJob stores a new Job after validating vault membership
// in-transaction: the Vault must exist and an Entry reference must exist in
// the same Vault. A missing Vault or Entry is NOT_FOUND; a cross-vault
// Entry is INVALID_PARENT; invalid progress is INVALID_STATE; a duplicate
// ID is FILE_CONFLICT.
func (t *Tx) InsertJob(ctx context.Context, j domain.Job) error {
	tx, err := t.q()
	if err != nil {
		return err
	}
	var one int
	err = tx.QueryRowContext(ctx, `SELECT 1 FROM vaults WHERE id = ?;`, j.VaultID).Scan(&one)
	if err == sql.ErrNoRows {
		return domain.New(domain.CodeNotFound, "vault not found")
	}
	if err != nil {
		return unavailable(err)
	}
	if j.EntryID != nil {
		var entryVault string
		err = tx.QueryRowContext(ctx, `SELECT vault_id FROM entries WHERE id = ?;`, *j.EntryID).Scan(&entryVault)
		if err == sql.ErrNoRows {
			return domain.New(domain.CodeNotFound, "entry not found")
		}
		if err != nil {
			return unavailable(err)
		}
		if entryVault != j.VaultID {
			return domain.New(domain.CodeInvalidParent, "entry belongs to another vault")
		}
	}
	if !validProgress(j.BytesTotal, j.BytesCompleted, j.ItemsTotal, j.ItemsCompleted) {
		return domain.New(domain.CodeInvalidState, "invalid job progress")
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO jobs(id, type, vault_id, entry_id, state, source_path, destination_path, bytes_total, bytes_completed, items_total, items_completed, error_code, error_message, created_at, updated_at, started_at, completed_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
		j.ID, string(j.Type), j.VaultID, nullString(j.EntryID), string(j.State), nullString(j.SourcePath), nullString(j.DestinationPath),
		j.BytesTotal, j.BytesCompleted, j.ItemsTotal, j.ItemsCompleted, nullString(j.ErrorCode), nullString(j.ErrorMessage),
		toMillis(j.CreatedAt), toMillis(j.UpdatedAt), nullTime(j.StartedAt), nullTime(j.CompletedAt))
	if err != nil {
		return mapConstraint(err, domain.CodeFileConflict, "job already exists", domain.CodeNotFound, "job vault or entry not found")
	}
	return nil
}

// UpdateJob is a compare-and-swap milestone update: it rewrites progress,
// error, and timestamp columns only, and only when the stored state still
// equals expectedState. Identity, type, vault, and entry are immutable;
// completed and cancelled jobs are terminal and accept no writes; a state
// change, invalid progress, or a stale expectation is INVALID_STATE; a
// missing job is NOT_FOUND. There is no worker engine behind this call.
func (t *Tx) UpdateJob(ctx context.Context, job domain.Job, expectedState domain.JobState) error {
	tx, err := t.q()
	if err != nil {
		return err
	}
	cur, err := queryJob(ctx, tx, job.ID)
	if err != nil {
		return err
	}
	if cur.State == domain.JobStateCompleted || cur.State == domain.JobStateCancelled {
		return domain.New(domain.CodeInvalidState, "job is terminal")
	}
	if cur.State != expectedState {
		return domain.New(domain.CodeInvalidState, "job state changed")
	}
	if job.ID != cur.ID || job.Type != cur.Type || job.VaultID != cur.VaultID || !sameStringPtr(job.EntryID, cur.EntryID) {
		return domain.New(domain.CodeInvalidState, "job identity is immutable")
	}
	if !validProgress(job.BytesTotal, job.BytesCompleted, job.ItemsTotal, job.ItemsCompleted) {
		return domain.New(domain.CodeInvalidState, "invalid job progress")
	}
	if job.State != cur.State {
		return domain.New(domain.CodeInvalidState, "job state transition is not supported")
	}
	_, err = tx.ExecContext(ctx, `UPDATE jobs SET bytes_total = ?, bytes_completed = ?, items_total = ?, items_completed = ?, error_code = ?, error_message = ?, updated_at = ?, started_at = ?, completed_at = ? WHERE id = ?;`,
		job.BytesTotal, job.BytesCompleted, job.ItemsTotal, job.ItemsCompleted, nullString(job.ErrorCode), nullString(job.ErrorMessage), toMillis(job.UpdatedAt), nullTime(job.StartedAt), nullTime(job.CompletedAt), job.ID)
	if err != nil {
		return unavailable(err)
	}
	return nil
}
