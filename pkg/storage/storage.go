package storage

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	_ "modernc.org/sqlite"
)

// Store provides thread-safe access to the SQLite metadata database.
type Store struct {
	db *sql.DB
	mu sync.RWMutex
}

// NewStore opens or creates the SQLite database at dbPath and applies schema migrations.
func NewStore(dbPath string) (*Store, error) {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create database directory: %w", err)
	}

	db, err := sql.Open("sqlite", dbPath+"?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)")
	if err != nil {
		return nil, fmt.Errorf("failed to open sqlite database: %w", err)
	}

	// Optimize connection pool for embedded desktop application
	db.SetMaxOpenConns(1)

	store := &Store{db: db}
	if err := store.migrate(); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("database migration failed: %w", err)
	}

	return store, nil
}

// Close closes the underlying SQLite database connection.
func (s *Store) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.db.Close()
}

func (s *Store) migrate() error {
	schema := `
	CREATE TABLE IF NOT EXISTS folders (
		id TEXT PRIMARY KEY,
		parent_id TEXT,
		name TEXT NOT NULL,
		path TEXT NOT NULL,
		color TEXT,
		icon TEXT,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS files (
		id TEXT PRIMARY KEY,
		folder_id TEXT,
		name TEXT NOT NULL,
		size INTEGER NOT NULL,
		mime_type TEXT NOT NULL,
		sha256 TEXT NOT NULL,
		is_encrypted INTEGER NOT NULL DEFAULT 1,
		chunk_count INTEGER NOT NULL DEFAULT 1,
		chunk_size INTEGER NOT NULL,
		favorite INTEGER NOT NULL DEFAULT 0,
		status TEXT NOT NULL DEFAULT 'completed',
		tags TEXT,
		thumbnail_url TEXT,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
	);

	CREATE TABLE IF NOT EXISTS chunks (
		id TEXT PRIMARY KEY,
		file_id TEXT NOT NULL,
		chunk_index INTEGER NOT NULL,
		message_id TEXT NOT NULL,
		attachment_id TEXT NOT NULL,
		attachment_url TEXT NOT NULL,
		proxy_url TEXT,
		size INTEGER NOT NULL,
		chunk_hash TEXT NOT NULL,
		nonce TEXT,
		created_at DATETIME NOT NULL,
		FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS transfers (
		id TEXT PRIMARY KEY,
		file_id TEXT NOT NULL,
		filename TEXT NOT NULL,
		type TEXT NOT NULL,
		status TEXT NOT NULL,
		total_bytes INTEGER NOT NULL,
		transferred_bytes INTEGER NOT NULL,
		speed_bps INTEGER NOT NULL DEFAULT 0,
		chunks_total INTEGER NOT NULL,
		chunks_done INTEGER NOT NULL,
		error_message TEXT,
		local_path TEXT,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL
	);

	CREATE TABLE IF NOT EXISTS settings (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL,
		updated_at DATETIME NOT NULL
	);

	CREATE INDEX IF NOT EXISTS idx_files_folder_id ON files(folder_id);
	CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);
	CREATE INDEX IF NOT EXISTS idx_files_favorite ON files(favorite);
	CREATE INDEX IF NOT EXISTS idx_files_name ON files(name);
	CREATE INDEX IF NOT EXISTS idx_chunks_file_id ON chunks(file_id);
	CREATE INDEX IF NOT EXISTS idx_chunks_index ON chunks(file_id, chunk_index);
	CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);
	CREATE INDEX IF NOT EXISTS idx_transfers_status ON transfers(status);
	`
	_, err := s.db.Exec(schema)
	return err
}

// ----------------------------------------------------
// Folder Operations
// ----------------------------------------------------

// CreateFolder inserts a new virtual folder.
func (s *Store) CreateFolder(parentID *string, name string, color, icon string) (*Folder, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	name = strings.TrimSpace(name)
	if name == "" {
		return nil, errors.New("folder name cannot be empty")
	}

	path := "/" + name
	if parentID != nil && *parentID != "" {
		var parentPath string
		err := s.db.QueryRow("SELECT path FROM folders WHERE id = ?", *parentID).Scan(&parentPath)
		if err != nil {
			return nil, fmt.Errorf("parent folder not found: %w", err)
		}
		path = strings.TrimSuffix(parentPath, "/") + "/" + name
	}

	now := time.Now()
	id := uuid.New().String()

	query := `INSERT INTO folders (id, parent_id, name, path, color, icon, created_at, updated_at) 
	          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := s.db.Exec(query, id, parentID, name, path, color, icon, now, now)
	if err != nil {
		return nil, fmt.Errorf("failed to create folder: %w", err)
	}

	return &Folder{
		ID:        id,
		ParentID:  parentID,
		Name:      name,
		Path:      path,
		Color:     color,
		Icon:      icon,
		CreatedAt: now,
		UpdatedAt: now,
	}, nil
}

// GetFolder fetches a single folder by ID.
func (s *Store) GetFolder(id string) (*Folder, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var f Folder
	var parentID sql.NullString
	query := `SELECT id, parent_id, name, path, color, icon, created_at, updated_at FROM folders WHERE id = ?`
	err := s.db.QueryRow(query, id).Scan(&f.ID, &parentID, &f.Name, &f.Path, &f.Color, &f.Icon, &f.CreatedAt, &f.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("folder not found")
		}
		return nil, err
	}
	if parentID.Valid {
		f.ParentID = &parentID.String
	}
	return &f, nil
}

// ListFolders lists child folders for a given parent (or root if parentID is nil).
func (s *Store) ListFolders(parentID *string) ([]Folder, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var rows *sql.Rows
	var err error
	if parentID == nil || *parentID == "" {
		rows, err = s.db.Query(`
			SELECT f.id, f.parent_id, f.name, f.path, f.color, f.icon, f.created_at, f.updated_at,
			       COUNT(DISTINCT fi.id) as file_count, COALESCE(SUM(fi.size), 0) as total_size
			FROM folders f
			LEFT JOIN files fi ON fi.folder_id = f.id AND fi.status != 'trash'
			WHERE f.parent_id IS NULL OR f.parent_id = ''
			GROUP BY f.id
			ORDER BY f.name ASC
		`)
	} else {
		rows, err = s.db.Query(`
			SELECT f.id, f.parent_id, f.name, f.path, f.color, f.icon, f.created_at, f.updated_at,
			       COUNT(DISTINCT fi.id) as file_count, COALESCE(SUM(fi.size), 0) as total_size
			FROM folders f
			LEFT JOIN files fi ON fi.folder_id = f.id AND fi.status != 'trash'
			WHERE f.parent_id = ?
			GROUP BY f.id
			ORDER BY f.name ASC
		`, *parentID)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to query folders: %w", err)
	}
	defer rows.Close()

	var folders []Folder
	for rows.Next() {
		var f Folder
		var pid sql.NullString
		if err := rows.Scan(&f.ID, &pid, &f.Name, &f.Path, &f.Color, &f.Icon, &f.CreatedAt, &f.UpdatedAt, &f.FileCount, &f.TotalSize); err != nil {
			return nil, err
		}
		if pid.Valid {
			f.ParentID = &pid.String
		}
		folders = append(folders, f)
	}
	return folders, nil
}

// RenameFolder updates a folder's name and recalculates paths.
func (s *Store) RenameFolder(id string, newName string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	newName = strings.TrimSpace(newName)
	if newName == "" {
		return errors.New("folder name cannot be empty")
	}

	_, err := s.db.Exec("UPDATE folders SET name = ?, updated_at = ? WHERE id = ?", newName, time.Now(), id)
	return err
}

// DeleteFolder deletes a folder and optionally deletes or cascades contents.
func (s *Store) DeleteFolder(id string, recursive bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if recursive {
		_, _ = s.db.Exec("DELETE FROM files WHERE folder_id = ?", id)
		_, _ = s.db.Exec("DELETE FROM folders WHERE parent_id = ?", id)
	}
	_, err := s.db.Exec("DELETE FROM folders WHERE id = ?", id)
	return err
}

// ----------------------------------------------------
// File Operations
// ----------------------------------------------------

// CreateFile inserts a new file record.
func (s *Store) CreateFile(f *File) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if f.ID == "" {
		f.ID = uuid.New().String()
	}
	now := time.Now()
	if f.CreatedAt.IsZero() {
		f.CreatedAt = now
	}
	f.UpdatedAt = now

	tagsJSON, _ := json.Marshal(f.Tags)

	query := `INSERT INTO files (id, folder_id, name, size, mime_type, sha256, is_encrypted, 
	                             chunk_count, chunk_size, favorite, status, tags, thumbnail_url, created_at, updated_at)
	          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	encryptedInt := 0
	if f.IsEncrypted {
		encryptedInt = 1
	}
	favoriteInt := 0
	if f.Favorite {
		favoriteInt = 1
	}

	_, err := s.db.Exec(query, f.ID, f.FolderID, f.Name, f.Size, f.MimeType, f.SHA256, encryptedInt,
		f.ChunkCount, f.ChunkSize, favoriteInt, string(f.Status), string(tagsJSON), f.ThumbnailURL, f.CreatedAt, f.UpdatedAt)
	return err
}

// GetFile fetches a file without chunks.
func (s *Store) GetFile(id string) (*File, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var f File
	var folderID sql.NullString
	var encryptedInt, favInt int
	var statusStr, tagsStr, thumbStr sql.NullString

	query := `SELECT id, folder_id, name, size, mime_type, sha256, is_encrypted, chunk_count, chunk_size, 
	                 favorite, status, tags, thumbnail_url, created_at, updated_at 
	          FROM files WHERE id = ?`

	err := s.db.QueryRow(query, id).Scan(&f.ID, &folderID, &f.Name, &f.Size, &f.MimeType, &f.SHA256,
		&encryptedInt, &f.ChunkCount, &f.ChunkSize, &favInt, &statusStr, &tagsStr, &thumbStr, &f.CreatedAt, &f.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("file not found")
		}
		return nil, err
	}

	if folderID.Valid {
		f.FolderID = &folderID.String
	}
	f.IsEncrypted = encryptedInt == 1
	f.Favorite = favInt == 1
	f.Status = FileStatus(statusStr.String)
	if thumbStr.Valid {
		f.ThumbnailURL = thumbStr.String
	}
	if tagsStr.Valid && tagsStr.String != "" {
		_ = json.Unmarshal([]byte(tagsStr.String), &f.Tags)
	}

	return &f, nil
}

// GetFileWithChunks fetches file and all its chunk manifests ordered by chunk_index.
func (s *Store) GetFileWithChunks(id string) (*File, error) {
	f, err := s.GetFile(id)
	if err != nil {
		return nil, err
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	rows, err := s.db.Query(`
		SELECT id, file_id, chunk_index, message_id, attachment_id, attachment_url, proxy_url, size, chunk_hash, nonce, created_at
		FROM chunks
		WHERE file_id = ?
		ORDER BY chunk_index ASC
	`, id)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch chunks: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var c Chunk
		var proxy, nonce sql.NullString
		if err := rows.Scan(&c.ID, &c.FileID, &c.ChunkIndex, &c.MessageID, &c.AttachmentID, &c.AttachmentURL, &proxy, &c.Size, &c.ChunkHash, &nonce, &c.CreatedAt); err != nil {
			return nil, err
		}
		if proxy.Valid {
			c.ProxyURL = proxy.String
		}
		if nonce.Valid {
			c.Nonce = nonce.String
		}
		f.Chunks = append(f.Chunks, c)
	}

	return f, nil
}

// ListFiles lists files according to folder, filter (favorites, recent, media categories, trash), and sorting.
func (s *Store) ListFiles(folderID *string, filter string, sortBy string, sortOrder string, limit, offset int) ([]File, int64, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	whereClauses := []string{"1=1"}
	var args []interface{}

	switch filter {
	case "trash":
		whereClauses = append(whereClauses, "status = 'trash'")
	case "favorites":
		whereClauses = append(whereClauses, "favorite = 1", "status != 'trash'")
	case "recent":
		whereClauses = append(whereClauses, "status = 'completed'")
	case "media_image":
		whereClauses = append(whereClauses, "status != 'trash'", "(mime_type LIKE 'image/%' OR name LIKE '%.png' OR name LIKE '%.jpg' OR name LIKE '%.jpeg' OR name LIKE '%.gif' OR name LIKE '%.webp')")
	case "media_video":
		whereClauses = append(whereClauses, "status != 'trash'", "(mime_type LIKE 'video/%' OR name LIKE '%.mp4' OR name LIKE '%.mkv' OR name LIKE '%.webm' OR name LIKE '%.mov')")
	case "media_audio":
		whereClauses = append(whereClauses, "status != 'trash'", "(mime_type LIKE 'audio/%' OR name LIKE '%.mp3' OR name LIKE '%.wav' OR name LIKE '%.flac' OR name LIKE '%.ogg')")
	case "documents":
		whereClauses = append(whereClauses, "status != 'trash'", "(mime_type LIKE '%pdf%' OR mime_type LIKE '%document%' OR mime_type LIKE 'text/%' OR name LIKE '%.pdf' OR name LIKE '%.docx' OR name LIKE '%.txt' OR name LIKE '%.md')")
	default:
		whereClauses = append(whereClauses, "status != 'trash'")
		if folderID == nil || *folderID == "" {
			whereClauses = append(whereClauses, "(folder_id IS NULL OR folder_id = '')")
		} else {
			whereClauses = append(whereClauses, "folder_id = ?")
			args = append(args, *folderID)
		}
	}

	whereSQL := strings.Join(whereClauses, " AND ")

	// Count total matching
	var total int64
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM files WHERE %s", whereSQL)
	if err := s.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	// Sorting
	orderCol := "name"
	switch sortBy {
	case "size":
		orderCol = "size"
	case "date", "created_at":
		orderCol = "created_at"
	case "updated_at":
		orderCol = "updated_at"
	}

	orderDir := "ASC"
	if strings.ToUpper(sortOrder) == "DESC" || filter == "recent" {
		orderDir = "DESC"
	}
	if filter == "recent" && sortBy == "" {
		orderCol = "created_at"
	}

	if limit <= 0 {
		limit = 1000
	}

	query := fmt.Sprintf(`
		SELECT id, folder_id, name, size, mime_type, sha256, is_encrypted, chunk_count, chunk_size, 
		       favorite, status, tags, thumbnail_url, created_at, updated_at 
		FROM files 
		WHERE %s 
		ORDER BY %s %s 
		LIMIT %d OFFSET %d
	`, whereSQL, orderCol, orderDir, limit, offset)

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query files: %w", err)
	}
	defer rows.Close()

	var files []File
	for rows.Next() {
		var f File
		var fID sql.NullString
		var encryptedInt, favInt int
		var statusStr, tagsStr, thumbStr sql.NullString

		if err := rows.Scan(&f.ID, &fID, &f.Name, &f.Size, &f.MimeType, &f.SHA256,
			&encryptedInt, &f.ChunkCount, &f.ChunkSize, &favInt, &statusStr, &tagsStr, &thumbStr, &f.CreatedAt, &f.UpdatedAt); err != nil {
			return nil, 0, err
		}

		if fID.Valid {
			f.FolderID = &fID.String
		}
		f.IsEncrypted = encryptedInt == 1
		f.Favorite = favInt == 1
		f.Status = FileStatus(statusStr.String)
		if thumbStr.Valid {
			f.ThumbnailURL = thumbStr.String
		}
		if tagsStr.Valid && tagsStr.String != "" {
			_ = json.Unmarshal([]byte(tagsStr.String), &f.Tags)
		}
		files = append(files, f)
	}

	return files, total, nil
}

// SearchFiles searches files across all directories by substring query.
func (s *Store) SearchFiles(queryStr string) ([]File, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	queryStr = strings.TrimSpace(queryStr)
	if queryStr == "" {
		return []File{}, nil
	}

	likePattern := "%" + queryStr + "%"
	rows, err := s.db.Query(`
		SELECT id, folder_id, name, size, mime_type, sha256, is_encrypted, chunk_count, chunk_size, 
		       favorite, status, tags, thumbnail_url, created_at, updated_at 
		FROM files 
		WHERE status != 'trash' AND (name LIKE ? OR tags LIKE ?)
		ORDER BY created_at DESC
		LIMIT 100
	`, likePattern, likePattern)
	if err != nil {
		return nil, fmt.Errorf("search failed: %w", err)
	}
	defer rows.Close()

	var files []File
	for rows.Next() {
		var f File
		var fID sql.NullString
		var encryptedInt, favInt int
		var statusStr, tagsStr, thumbStr sql.NullString

		if err := rows.Scan(&f.ID, &fID, &f.Name, &f.Size, &f.MimeType, &f.SHA256,
			&encryptedInt, &f.ChunkCount, &f.ChunkSize, &favInt, &statusStr, &tagsStr, &thumbStr, &f.CreatedAt, &f.UpdatedAt); err != nil {
			return nil, err
		}

		if fID.Valid {
			f.FolderID = &fID.String
		}
		f.IsEncrypted = encryptedInt == 1
		f.Favorite = favInt == 1
		f.Status = FileStatus(statusStr.String)
		if thumbStr.Valid {
			f.ThumbnailURL = thumbStr.String
		}
		if tagsStr.Valid && tagsStr.String != "" {
			_ = json.Unmarshal([]byte(tagsStr.String), &f.Tags)
		}
		files = append(files, f)
	}

	return files, nil
}

// UpdateFile updates file metadata (name, folder, favorite, status).
func (s *Store) UpdateFile(f *File) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	f.UpdatedAt = time.Now()
	tagsJSON, _ := json.Marshal(f.Tags)

	encryptedInt := 0
	if f.IsEncrypted {
		encryptedInt = 1
	}
	favInt := 0
	if f.Favorite {
		favInt = 1
	}

	query := `UPDATE files SET folder_id = ?, name = ?, size = ?, mime_type = ?, sha256 = ?,
	                           is_encrypted = ?, chunk_count = ?, chunk_size = ?, favorite = ?,
	                           status = ?, tags = ?, thumbnail_url = ?, updated_at = ?
	          WHERE id = ?`

	_, err := s.db.Exec(query, f.FolderID, f.Name, f.Size, f.MimeType, f.SHA256,
		encryptedInt, f.ChunkCount, f.ChunkSize, favInt, string(f.Status), string(tagsJSON), f.ThumbnailURL, f.UpdatedAt, f.ID)
	return err
}

// RenameFile renames a single file.
func (s *Store) RenameFile(id string, newName string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	newName = strings.TrimSpace(newName)
	if newName == "" {
		return errors.New("file name cannot be empty")
	}

	_, err := s.db.Exec("UPDATE files SET name = ?, updated_at = ? WHERE id = ?", newName, time.Now(), id)
	return err
}

// MoveFile moves a file to a new folder (or root if targetFolderID is nil).
func (s *Store) MoveFile(id string, targetFolderID *string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	_, err := s.db.Exec("UPDATE files SET folder_id = ?, updated_at = ? WHERE id = ?", targetFolderID, time.Now(), id)
	return err
}

// ToggleFavorite flips the favorite status.
func (s *Store) ToggleFavorite(id string) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var favInt int
	err := s.db.QueryRow("SELECT favorite FROM files WHERE id = ?", id).Scan(&favInt)
	if err != nil {
		return false, err
	}

	newFav := 1
	if favInt == 1 {
		newFav = 0
	}

	_, err = s.db.Exec("UPDATE files SET favorite = ?, updated_at = ? WHERE id = ?", newFav, time.Now(), id)
	return newFav == 1, err
}

// DeleteFile marks file as trash or permanently deletes it.
func (s *Store) DeleteFile(id string, permanent bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if permanent {
		_, _ = s.db.Exec("DELETE FROM chunks WHERE file_id = ?", id)
		_, err := s.db.Exec("DELETE FROM files WHERE id = ?", id)
		return err
	}

	_, err := s.db.Exec("UPDATE files SET status = 'trash', updated_at = ? WHERE id = ?", time.Now(), id)
	return err
}

// RestoreFile restores a file from trash.
func (s *Store) RestoreFile(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	_, err := s.db.Exec("UPDATE files SET status = 'completed', updated_at = ? WHERE id = ?", time.Now(), id)
	return err
}
// SetFileStatus updates the status of a file record.
func (s *Store) SetFileStatus(id string, status FileStatus) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	_, err := s.db.Exec("UPDATE files SET status = ?, updated_at = ? WHERE id = ?", string(status), time.Now(), id)
	return err
}

// ----------------------------------------------------
// Chunk Operations
// ----------------------------------------------------

// CreateChunk inserts a single chunk manifest record.
func (s *Store) CreateChunk(c *Chunk) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if c.ID == "" {
		c.ID = uuid.New().String()
	}
	if c.CreatedAt.IsZero() {
		c.CreatedAt = time.Now()
	}

	query := `INSERT INTO chunks (id, file_id, chunk_index, message_id, attachment_id, attachment_url, proxy_url, size, chunk_hash, nonce, created_at)
	          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := s.db.Exec(query, c.ID, c.FileID, c.ChunkIndex, c.MessageID, c.AttachmentID, c.AttachmentURL, c.ProxyURL, c.Size, c.ChunkHash, c.Nonce, c.CreatedAt)
	return err
}

// CreateChunksBatch inserts a slice of chunk manifests in a single transaction.
func (s *Store) CreateChunksBatch(chunks []Chunk) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`INSERT INTO chunks (id, file_id, chunk_index, message_id, attachment_id, attachment_url, proxy_url, size, chunk_hash, nonce, created_at)
	                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	now := time.Now()
	for _, c := range chunks {
		if c.ID == "" {
			c.ID = uuid.New().String()
		}
		if c.CreatedAt.IsZero() {
			c.CreatedAt = now
		}
		if _, err := stmt.Exec(c.ID, c.FileID, c.ChunkIndex, c.MessageID, c.AttachmentID, c.AttachmentURL, c.ProxyURL, c.Size, c.ChunkHash, c.Nonce, c.CreatedAt); err != nil {
			return err
		}
	}

	return tx.Commit()
}

// ----------------------------------------------------
// Transfer Operations
// ----------------------------------------------------

// CreateTransfer inserts or replaces a transfer record.
func (s *Store) CreateTransfer(t *Transfer) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if t.ID == "" {
		t.ID = uuid.New().String()
	}
	now := time.Now()
	t.CreatedAt = now
	t.UpdatedAt = now

	query := `INSERT OR REPLACE INTO transfers 
	          (id, file_id, filename, type, status, total_bytes, transferred_bytes, speed_bps, chunks_total, chunks_done, error_message, local_path, created_at, updated_at)
	          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	_, err := s.db.Exec(query, t.ID, t.FileID, t.Filename, string(t.Type), string(t.Status),
		t.TotalBytes, t.TransferredBytes, t.SpeedBps, t.ChunksTotal, t.ChunksDone, t.ErrorMessage, t.LocalPath, t.CreatedAt, t.UpdatedAt)
	return err
}

// UpdateTransfer updates dynamic transfer metrics.
func (s *Store) UpdateTransfer(t *Transfer) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	t.UpdatedAt = time.Now()
	query := `UPDATE transfers SET status = ?, transferred_bytes = ?, speed_bps = ?, chunks_done = ?, error_message = ?, updated_at = ?
	          WHERE id = ?`
	_, err := s.db.Exec(query, string(t.Status), t.TransferredBytes, t.SpeedBps, t.ChunksDone, t.ErrorMessage, t.UpdatedAt, t.ID)
	return err
}
// GetTransfer retrieves a transfer by ID.
func (s *Store) GetTransfer(id string) (*Transfer, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var t Transfer
	var typeStr, statusStr, errMsg, localPath sql.NullString
	query := `SELECT id, file_id, filename, type, status, total_bytes, transferred_bytes, speed_bps, chunks_total, chunks_done, error_message, local_path, created_at, updated_at FROM transfers WHERE id = ?`
	err := s.db.QueryRow(query, id).Scan(&t.ID, &t.FileID, &t.Filename, &typeStr, &statusStr, &t.TotalBytes, &t.TransferredBytes, &t.SpeedBps, &t.ChunksTotal, &t.ChunksDone, &errMsg, &localPath, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("transfer not found")
		}
		return nil, err
	}

	t.Type = TransferType(typeStr.String)
	t.Status = TransferStatus(statusStr.String)
	if errMsg.Valid {
		t.ErrorMessage = errMsg.String
	}
	if localPath.Valid {
		t.LocalPath = localPath.String
	}
	if t.TotalBytes > 0 {
		t.ProgressPercent = (float64(t.TransferredBytes) / float64(t.TotalBytes)) * 100.0
	}
	return &t, nil
}

// ListTransfers fetches active or all transfers.
func (s *Store) ListTransfers(statusFilter string) ([]Transfer, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var rows *sql.Rows
	var err error
	if statusFilter != "" {
		rows, err = s.db.Query(`SELECT id, file_id, filename, type, status, total_bytes, transferred_bytes, speed_bps, chunks_total, chunks_done, error_message, local_path, created_at, updated_at FROM transfers WHERE status = ? ORDER BY created_at DESC`, statusFilter)
	} else {
		rows, err = s.db.Query(`SELECT id, file_id, filename, type, status, total_bytes, transferred_bytes, speed_bps, chunks_total, chunks_done, error_message, local_path, created_at, updated_at FROM transfers ORDER BY created_at DESC LIMIT 50`)
	}

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Transfer
	for rows.Next() {
		var t Transfer
		var typeStr, statusStr, errMsg, localPath sql.NullString
		if err := rows.Scan(&t.ID, &t.FileID, &t.Filename, &typeStr, &statusStr, &t.TotalBytes, &t.TransferredBytes, &t.SpeedBps, &t.ChunksTotal, &t.ChunksDone, &errMsg, &localPath, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		t.Type = TransferType(typeStr.String)
		t.Status = TransferStatus(statusStr.String)
		if errMsg.Valid {
			t.ErrorMessage = errMsg.String
		}
		if localPath.Valid {
			t.LocalPath = localPath.String
		}
		if t.TotalBytes > 0 {
			t.ProgressPercent = (float64(t.TransferredBytes) / float64(t.TotalBytes)) * 100.0
		}
		list = append(list, t)
	}

	return list, nil
}

// ClearCompletedTransfers removes finished or cancelled transfers from the list.
func (s *Store) ClearCompletedTransfers() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	_, err := s.db.Exec("DELETE FROM transfers WHERE status IN ('completed', 'cancelled', 'failed')")
	return err
}

// ----------------------------------------------------
// Settings & App State
// ----------------------------------------------------

// GetSetting returns single key or default.
func (s *Store) GetSetting(key string, defaultValue string) string {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var val string
	err := s.db.QueryRow("SELECT value FROM settings WHERE key = ?", key).Scan(&val)
	if err != nil {
		return defaultValue
	}
	return val
}

// SetSetting saves single key/value pair.
func (s *Store) SetSetting(key string, value string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	_, err := s.db.Exec("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)", key, value, now)
	return err
}

// GetAppSettings retrieves the full typed settings.
func (s *Store) GetAppSettings() (*AppSettings, error) {
	settings := &AppSettings{
		WebhookURL:        s.GetSetting("webhook_url", ""),
		WebhookName:       s.GetSetting("webhook_name", "Wyvern Drive Vault"),
		ChannelID:         s.GetSetting("channel_id", ""),
		GuildID:           s.GetSetting("guild_id", ""),
		MasterKey:         s.GetSetting("master_key", ""),
		EncryptionEnabled: s.GetSetting("encryption_enabled", "true") == "true",
		ChunkSizeBytes:    18 * 1024 * 1024, // 18MB default safe chunk size for Discord 20MB limit
		MaxConcurrency:    4,
		AutoLaunchServer:  true,
		ServerPort:        49152,
		Theme:             s.GetSetting("theme", "dark"),
		DownloadDirectory: s.GetSetting("download_directory", ""),
		SetupCompleted:    s.GetSetting("setup_completed", "false") == "true",
	}

	if val := s.GetSetting("chunk_size_bytes", ""); val != "" {
		var cs int64
		if _, err := fmt.Sscanf(val, "%d", &cs); err == nil && cs > 0 {
			settings.ChunkSizeBytes = cs
		}
	}

	if val := s.GetSetting("max_concurrency", ""); val != "" {
		var mc int
		if _, err := fmt.Sscanf(val, "%d", &mc); err == nil && mc > 0 {
			settings.MaxConcurrency = mc
		}
	}

	if val := s.GetSetting("server_port", ""); val != "" {
		var sp int
		if _, err := fmt.Sscanf(val, "%d", &sp); err == nil && sp > 0 {
			settings.ServerPort = sp
		}
	}

	return settings, nil
}

// SaveAppSettings persists typed settings to DB.
func (s *Store) SaveAppSettings(settings *AppSettings) error {
	if err := s.SetSetting("webhook_url", settings.WebhookURL); err != nil {
		return err
	}
	_ = s.SetSetting("webhook_name", settings.WebhookName)
	_ = s.SetSetting("channel_id", settings.ChannelID)
	_ = s.SetSetting("guild_id", settings.GuildID)
	_ = s.SetSetting("master_key", settings.MasterKey)
	_ = s.SetSetting("encryption_enabled", fmt.Sprintf("%t", settings.EncryptionEnabled))
	_ = s.SetSetting("chunk_size_bytes", fmt.Sprintf("%d", settings.ChunkSizeBytes))
	_ = s.SetSetting("max_concurrency", fmt.Sprintf("%d", settings.MaxConcurrency))
	_ = s.SetSetting("auto_launch_server", fmt.Sprintf("%t", settings.AutoLaunchServer))
	_ = s.SetSetting("server_port", fmt.Sprintf("%d", settings.ServerPort))
	_ = s.SetSetting("theme", settings.Theme)
	_ = s.SetSetting("download_directory", settings.DownloadDirectory)
	_ = s.SetSetting("setup_completed", fmt.Sprintf("%t", settings.SetupCompleted))
	return nil
}

// GetStats compiles storage metrics.
func (s *Store) GetStats() (*StorageStats, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	stats := &StorageStats{
		CategoryCounts: make(map[string]int64),
		CategoryBytes:  make(map[string]int64),
	}

	_ = s.db.QueryRow("SELECT COUNT(*) FROM files WHERE status != 'trash'").Scan(&stats.TotalFiles)
	_ = s.db.QueryRow("SELECT COUNT(*) FROM folders").Scan(&stats.TotalFolders)
	_ = s.db.QueryRow("SELECT COALESCE(SUM(size), 0) FROM files WHERE status != 'trash'").Scan(&stats.TotalBytes)
	_ = s.db.QueryRow("SELECT COUNT(*) FROM chunks").Scan(&stats.TotalChunks)
	_ = s.db.QueryRow("SELECT COUNT(*) FROM files WHERE is_encrypted = 1 AND status != 'trash'").Scan(&stats.EncryptedFiles)
	_ = s.db.QueryRow("SELECT COUNT(*) FROM transfers WHERE status = 'running'").Scan(&stats.ActiveTransfers)

	// Breakdown by media category
	categories := map[string]string{
		"images":    "(mime_type LIKE 'image/%' OR name LIKE '%.png' OR name LIKE '%.jpg' OR name LIKE '%.jpeg' OR name LIKE '%.gif' OR name LIKE '%.webp')",
		"videos":    "(mime_type LIKE 'video/%' OR name LIKE '%.mp4' OR name LIKE '%.mkv' OR name LIKE '%.webm' OR name LIKE '%.mov')",
		"audio":     "(mime_type LIKE 'audio/%' OR name LIKE '%.mp3' OR name LIKE '%.wav' OR name LIKE '%.flac' OR name LIKE '%.ogg')",
		"documents": "(mime_type LIKE '%pdf%' OR mime_type LIKE '%document%' OR mime_type LIKE 'text/%' OR name LIKE '%.pdf' OR name LIKE '%.docx' OR name LIKE '%.txt' OR name LIKE '%.md')",
		"archives":  "(name LIKE '%.zip' OR name LIKE '%.rar' OR name LIKE '%.7z' OR name LIKE '%.tar%' OR name LIKE '%.gz')",
	}

	for cat, expr := range categories {
		var count, bytes int64
		_ = s.db.QueryRow(fmt.Sprintf("SELECT COUNT(*), COALESCE(SUM(size), 0) FROM files WHERE status != 'trash' AND %s", expr)).Scan(&count, &bytes)
		stats.CategoryCounts[cat] = count
		stats.CategoryBytes[cat] = bytes
	}

	return stats, nil
}

// ExportManifest exports full database structure to JSON backup.
func (s *Store) ExportManifest() (*ExportManifest, error) {
	folders, err := s.ListFolders(nil)
	if err != nil {
		return nil, err
	}

	files, _, err := s.ListFiles(nil, "all", "created_at", "ASC", 100000, 0)
	if err != nil {
		return nil, err
	}

	for i := range files {
		fullFile, err := s.GetFileWithChunks(files[i].ID)
		if err == nil {
			files[i].Chunks = fullFile.Chunks
		}
	}

	return &ExportManifest{
		Version:    "1.0.0",
		ExportedAt: time.Now(),
		Folders:    folders,
		Files:      files,
	}, nil
}
