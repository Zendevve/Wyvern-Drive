package webdav

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path"
	"strings"
	"sync"
	"time"

	"wyvern-drive/pkg/engine"
	"wyvern-drive/pkg/storage"

	xwebdav "golang.org/x/net/webdav"
)

// Server coordinates the local WebDAV service for OS drive mounting.
type Server struct {
	store    *storage.Store
	engine   *engine.Engine
	port     int
	listener net.Listener
	server   *http.Server
	mu       sync.Mutex
	running  bool
}

// NewServer creates a new WebDAV server instance.
func NewServer(store *storage.Store, eng *engine.Engine, port int) *Server {
	if port <= 0 {
		port = 49153
	}
	return &Server{
		store:  store,
		engine: eng,
		port:   port,
	}
}

// Start launches the WebDAV server on the configured port.
func (s *Server) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.running {
		return nil
	}

	fs := &wyvernFS{
		store:  s.store,
		engine: s.engine,
	}

	ls := xwebdav.NewMemLS()
	handler := &xwebdav.Handler{
		Prefix:     "/webdav",
		FileSystem: fs,
		LockSystem: ls,
		Logger: func(r *http.Request, err error) {
			// Quiet request logging
		},
	}

	mux := http.NewServeMux()
	mux.Handle("/webdav/", handler)
	mux.HandleFunc("/webdav", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/webdav/", http.StatusPermanentRedirect)
	})

	listener, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", s.port))
	if err != nil {
		return fmt.Errorf("failed to bind WebDAV listener on port %d: %w", s.port, err)
	}

	s.listener = listener
	s.server = &http.Server{
		Handler: mux,
	}
	s.running = true

	go func() {
		_ = s.server.Serve(listener)
	}()

	return nil
}

// Stop gracefully terminates the WebDAV server.
func (s *Server) Stop(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.running || s.server == nil {
		return nil
	}

	s.running = false
	return s.server.Shutdown(ctx)
}

// IsRunning returns whether the WebDAV service is active.
func (s *Server) IsRunning() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.running
}

// Port returns the active listening port.
func (s *Server) Port() int {
	return s.port
}

// ----------------------------------------------------
// Custom Virtual FileSystem Implementation
// ----------------------------------------------------

type wyvernFS struct {
	store  *storage.Store
	engine *engine.Engine
}

func (w *wyvernFS) Mkdir(ctx context.Context, name string, perm os.FileMode) error {
	cleanName := path.Clean("/" + strings.TrimPrefix(name, "/"))
	if cleanName == "/" || cleanName == "." {
		return nil
	}

	parentPath := path.Dir(cleanName)
	baseName := path.Base(cleanName)

	var parentID *string
	if parentPath != "/" && parentPath != "." {
		folder, err := w.findFolderByPath(parentPath)
		if err != nil {
			return os.ErrNotExist
		}
		parentID = &folder.ID
	}

	_, err := w.store.CreateFolder(parentID, baseName, "#3b82f6", "folder")
	return err
}

func (w *wyvernFS) OpenFile(ctx context.Context, name string, flag int, perm os.FileMode) (xwebdav.File, error) {
	cleanName := path.Clean("/" + strings.TrimPrefix(name, "/"))

	// Root directory
	if cleanName == "/" || cleanName == "." {
		return &wyvernDir{
			name:   "/",
			fs:     w,
			isRoot: true,
		}, nil
	}

	// Check if it's a folder
	if folder, err := w.findFolderByPath(cleanName); err == nil && folder != nil {
		return &wyvernDir{
			name:   folder.Name,
			folder: folder,
			fs:     w,
		}, nil
	}

	// Check if writing new file
	if flag&(os.O_CREATE|os.O_WRONLY|os.O_RDWR) != 0 {
		return &wyvernFileWriter{
			fs:        w,
			fullPath:  cleanName,
			tmpFile:   nil,
			closed:    false,
		}, nil
	}

	// Reading existing file
	file, err := w.findFileByPath(cleanName)
	if err != nil || file == nil {
		return nil, os.ErrNotExist
	}

	return &wyvernFileReader{
		fs:     w,
		file:   file,
		offset: 0,
	}, nil
}

func (w *wyvernFS) RemoveAll(ctx context.Context, name string) error {
	cleanName := path.Clean("/" + strings.TrimPrefix(name, "/"))
	if cleanName == "/" || cleanName == "." {
		return errors.New("cannot delete root folder")
	}

	if folder, err := w.findFolderByPath(cleanName); err == nil && folder != nil {
		return w.store.DeleteFolder(folder.ID, true)
	}

	if file, err := w.findFileByPath(cleanName); err == nil && file != nil {
		return w.store.DeleteFile(file.ID, true)
	}

	return os.ErrNotExist
}

func (w *wyvernFS) Rename(ctx context.Context, oldName, newName string) error {
	oldClean := path.Clean("/" + strings.TrimPrefix(oldName, "/"))
	newClean := path.Clean("/" + strings.TrimPrefix(newName, "/"))
	newBase := path.Base(newClean)

	if folder, err := w.findFolderByPath(oldClean); err == nil && folder != nil {
		return w.store.RenameFolder(folder.ID, newBase)
	}

	if file, err := w.findFileByPath(oldClean); err == nil && file != nil {
		return w.store.RenameFile(file.ID, newBase)
	}

	return os.ErrNotExist
}

func (w *wyvernFS) Stat(ctx context.Context, name string) (os.FileInfo, error) {
	cleanName := path.Clean("/" + strings.TrimPrefix(name, "/"))
	if cleanName == "/" || cleanName == "." {
		return &virtualFileInfo{
			name:    "/",
			size:    0,
			mode:    os.ModeDir | 0755,
			modTime: time.Now(),
			isDir:   true,
		}, nil
	}

	if folder, err := w.findFolderByPath(cleanName); err == nil && folder != nil {
		return &virtualFileInfo{
			name:    folder.Name,
			size:    0,
			mode:    os.ModeDir | 0755,
			modTime: folder.UpdatedAt,
			isDir:   true,
		}, nil
	}

	if file, err := w.findFileByPath(cleanName); err == nil && file != nil {
		return &virtualFileInfo{
			name:    file.Name,
			size:    file.Size,
			mode:    0644,
			modTime: file.UpdatedAt,
			isDir:   false,
		}, nil
	}

	return nil, os.ErrNotExist
}

func (w *wyvernFS) findFolderByPath(targetPath string) (*storage.Folder, error) {
	clean := path.Clean("/" + strings.TrimPrefix(targetPath, "/"))
	folders, err := w.store.ListFolders(nil)
	if err != nil {
		return nil, err
	}

	for _, f := range folders {
		if f.Path == clean || f.Name == strings.TrimPrefix(clean, "/") {
			return &f, nil
		}
	}
	return nil, os.ErrNotExist
}

func (w *wyvernFS) findFileByPath(targetPath string) (*storage.File, error) {
	clean := path.Clean("/" + strings.TrimPrefix(targetPath, "/"))
	dir := path.Dir(clean)
	base := path.Base(clean)

	var folderID *string
	if dir != "/" && dir != "." {
		folder, err := w.findFolderByPath(dir)
		if err != nil {
			return nil, err
		}
		folderID = &folder.ID
	}

	files, _, err := w.store.ListFiles(folderID, "all", "name", "ASC", 1000, 0)
	if err != nil {
		return nil, err
	}

	for _, f := range files {
		if f.Name == base {
			return &f, nil
		}
	}

	return nil, os.ErrNotExist
}

// ----------------------------------------------------
// WebDAV Directory File
// ----------------------------------------------------

type wyvernDir struct {
	name   string
	folder *storage.Folder
	fs     *wyvernFS
	isRoot bool
}

func (d *wyvernDir) Close() error { return nil }
func (d *wyvernDir) Read(p []byte) (n int, err error) { return 0, io.EOF }
func (d *wyvernDir) Seek(offset int64, whence int) (int64, error) { return 0, nil }
func (d *wyvernDir) Write(p []byte) (n int, err error) { return 0, errors.New("cannot write to directory") }

func (d *wyvernDir) Stat() (os.FileInfo, error) {
	mod := time.Now()
	if d.folder != nil {
		mod = d.folder.UpdatedAt
	}
	return &virtualFileInfo{
		name:    d.name,
		size:    0,
		mode:    os.ModeDir | 0755,
		modTime: mod,
		isDir:   true,
	}, nil
}

func (d *wyvernDir) Readdir(count int) ([]os.FileInfo, error) {
	var parentID *string
	if d.folder != nil {
		parentID = &d.folder.ID
	}

	folders, _ := d.fs.store.ListFolders(parentID)
	files, _, _ := d.fs.store.ListFiles(parentID, "all", "name", "ASC", 1000, 0)

	var infos []os.FileInfo
	for _, f := range folders {
		infos = append(infos, &virtualFileInfo{
			name:    f.Name,
			size:    0,
			mode:    os.ModeDir | 0755,
			modTime: f.UpdatedAt,
			isDir:   true,
		})
	}
	for _, f := range files {
		infos = append(infos, &virtualFileInfo{
			name:    f.Name,
			size:    f.Size,
			mode:    0644,
			modTime: f.UpdatedAt,
			isDir:   false,
		})
	}

	return infos, nil
}

// ----------------------------------------------------
// WebDAV File Reader
// ----------------------------------------------------

type wyvernFileReader struct {
	fs     *wyvernFS
	file   *storage.File
	offset int64
}

func (r *wyvernFileReader) Close() error { return nil }

func (r *wyvernFileReader) Read(p []byte) (n int, err error) {
	if r.offset >= r.file.Size {
		return 0, io.EOF
	}

	end := r.offset + int64(len(p)) - 1
	if end >= r.file.Size {
		end = r.file.Size - 1
	}

	data, err := r.fs.engine.ReadRange(context.Background(), r.file.ID, r.offset, end)
	if err != nil {
		return 0, err
	}

	copied := copy(p, data)
	r.offset += int64(copied)
	if r.offset >= r.file.Size {
		return copied, io.EOF
	}
	return copied, nil
}

func (r *wyvernFileReader) Seek(offset int64, whence int) (int64, error) {
	switch whence {
	case io.SeekStart:
		r.offset = offset
	case io.SeekCurrent:
		r.offset += offset
	case io.SeekEnd:
		r.offset = r.file.Size + offset
	}
	if r.offset < 0 {
		r.offset = 0
	}
	return r.offset, nil
}

func (r *wyvernFileReader) Write(p []byte) (n int, err error) {
	return 0, errors.New("read-only file")
}

func (r *wyvernFileReader) Stat() (os.FileInfo, error) {
	return &virtualFileInfo{
		name:    r.file.Name,
		size:    r.file.Size,
		mode:    0644,
		modTime: r.file.UpdatedAt,
		isDir:   false,
	}, nil
}

func (r *wyvernFileReader) Readdir(count int) ([]os.FileInfo, error) {
	return nil, errors.New("not a directory")
}

// ----------------------------------------------------
// WebDAV File Writer
// ----------------------------------------------------

type wyvernFileWriter struct {
	fs       *wyvernFS
	fullPath string
	tmpFile  *os.File
	closed   bool
}

func (w *wyvernFileWriter) Write(p []byte) (n int, err error) {
	if w.tmpFile == nil {
		tmp, err := os.CreateTemp("", "wyvern_webdav_upload_*")
		if err != nil {
			return 0, err
		}
		w.tmpFile = tmp
	}
	return w.tmpFile.Write(p)
}

func (w *wyvernFileWriter) Close() error {
	if w.closed {
		return nil
	}
	w.closed = true

	if w.tmpFile == nil {
		return nil
	}

	tmpPath := w.tmpFile.Name()
	_ = w.tmpFile.Close()
	defer os.Remove(tmpPath)

	dir := path.Dir(w.fullPath)
	baseName := path.Base(w.fullPath)

	var folderID *string
	if dir != "/" && dir != "." {
		folder, err := w.fs.findFolderByPath(dir)
		if err == nil && folder != nil {
			folderID = &folder.ID
		}
	}

	_, err := w.fs.engine.UploadFile(context.Background(), tmpPath, engine.UploadOptions{
		FolderID:   folderID,
		CustomName: baseName,
	})
	return err
}

func (w *wyvernFileWriter) Read(p []byte) (n int, err error) { return 0, io.EOF }
func (w *wyvernFileWriter) Seek(offset int64, whence int) (int64, error) { return 0, nil }
func (w *wyvernFileWriter) Readdir(count int) ([]os.FileInfo, error) { return nil, errors.New("not a directory") }
func (w *wyvernFileWriter) Stat() (os.FileInfo, error) {
	return &virtualFileInfo{
		name:    path.Base(w.fullPath),
		size:    0,
		mode:    0644,
		modTime: time.Now(),
		isDir:   false,
	}, nil
}

// ----------------------------------------------------
// Virtual FileInfo Helper
// ----------------------------------------------------

type virtualFileInfo struct {
	name    string
	size    int64
	mode    os.FileMode
	modTime time.Time
	isDir   bool
}

func (v *virtualFileInfo) Name() string       { return v.name }
func (v *virtualFileInfo) Size() int64        { return v.size }
func (v *virtualFileInfo) Mode() os.FileMode  { return v.mode }
func (v *virtualFileInfo) ModTime() time.Time { return v.modTime }
func (v *virtualFileInfo) IsDir() bool        { return v.isDir }
func (v *virtualFileInfo) Sys() interface{}   { return nil }
