package s3

import (
	"context"
	"encoding/xml"
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
)

// Server coordinates the local S3-compatible REST gateway.
type Server struct {
	store    *storage.Store
	engine   *engine.Engine
	port     int
	listener net.Listener
	server   *http.Server
	mu       sync.Mutex
	running  bool
}

// NewServer initializes an S3 gateway server.
func NewServer(store *storage.Store, eng *engine.Engine, port int) *Server {
	if port <= 0 {
		port = 49154
	}
	return &Server{
		store:  store,
		engine: eng,
		port:   port,
	}
}

// Start launches the S3 gateway HTTP server.
func (s *Server) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.running {
		return nil
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/", s.handleS3Request)

	listener, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", s.port))
	if err != nil {
		return fmt.Errorf("failed to bind S3 listener on port %d: %w", s.port, err)
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

// Stop terminates the S3 gateway.
func (s *Server) Stop(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.running || s.server == nil {
		return nil
	}

	s.running = false
	return s.server.Shutdown(ctx)
}

// IsRunning returns whether the S3 gateway is active.
func (s *Server) IsRunning() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.running
}

// Port returns active listening port.
func (s *Server) Port() int {
	return s.port
}

func (s *Server) handleS3Request(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Server", "WyvernDrive-S3-Gateway/1.0")
	w.Header().Set("x-amz-request-id", fmt.Sprintf("%d", time.Now().UnixNano()))

	trimmedPath := strings.Trim(r.URL.Path, "/")

	// 1. ListBuckets: GET /
	if trimmedPath == "" {
		if r.Method == http.MethodGet {
			s.handleListBuckets(w, r)
			return
		}
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	parts := strings.SplitN(trimmedPath, "/", 2)
	bucketName := parts[0]
	objectKey := ""
	if len(parts) > 1 {
		objectKey = parts[1]
	}

	// 2. ListObjects: GET /{bucket}
	if objectKey == "" && r.Method == http.MethodGet {
		s.handleListObjects(w, r, bucketName)
		return
	}

	// Object operations
	switch r.Method {
	case http.MethodGet:
		s.handleGetObject(w, r, bucketName, objectKey)
	case http.MethodHead:
		s.handleHeadObject(w, r, bucketName, objectKey)
	case http.MethodPut:
		s.handlePutObject(w, r, bucketName, objectKey)
	case http.MethodDelete:
		s.handleDeleteObject(w, r, bucketName, objectKey)
	default:
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
	}
}

// ----------------------------------------------------
// S3 XML Schema Definitions
// ----------------------------------------------------

type ListAllMyBucketsResult struct {
	XMLName xml.Name `xml:"ListAllMyBucketsResult"`
	Xmlns   string   `xml:"xmlns,attr"`
	Buckets struct {
		Bucket []struct {
			Name         string    `xml:"Name"`
			CreationDate time.Time `xml:"CreationDate"`
		} `xml:"Bucket"`
	} `xml:"Buckets"`
}

type ListBucketResult struct {
	XMLName        xml.Name `xml:"ListBucketResult"`
	Xmlns          string   `xml:"xmlns,attr"`
	Name           string   `xml:"Name"`
	Prefix         string   `xml:"Prefix"`
	KeyCount       int      `xml:"KeyCount"`
	MaxKeys        int      `xml:"MaxKeys"`
	IsTruncated    bool     `xml:"IsTruncated"`
	Contents       []S3Object `xml:"Contents"`
	CommonPrefixes []struct {
		Prefix string `xml:"Prefix"`
	} `xml:"CommonPrefixes,omitempty"`
}

type S3Object struct {
	Key          string    `xml:"Key"`
	LastModified time.Time `xml:"LastModified"`
	ETag         string    `xml:"ETag"`
	Size         int64     `xml:"Size"`
	StorageClass string    `xml:"StorageClass"`
}

// ----------------------------------------------------
// S3 Handlers
// ----------------------------------------------------

func (s *Server) handleListBuckets(w http.ResponseWriter, r *http.Request) {
	folders, _ := s.store.ListFolders(nil)

	res := ListAllMyBucketsResult{
		Xmlns: "http://s3.amazonaws.com/doc/2006-03-01/",
	}

	// Always provide default bucket
	res.Buckets.Bucket = append(res.Buckets.Bucket, struct {
		Name         string    `xml:"Name"`
		CreationDate time.Time `xml:"CreationDate"`
	}{
		Name:         "wyvern-vault",
		CreationDate: time.Now(),
	})

	for _, f := range folders {
		res.Buckets.Bucket = append(res.Buckets.Bucket, struct {
			Name         string    `xml:"Name"`
			CreationDate time.Time `xml:"CreationDate"`
		}{
			Name:         f.Name,
			CreationDate: f.CreatedAt,
		})
	}

	w.Header().Set("Content-Type", "application/xml")
	_ = xml.NewEncoder(w).Encode(res)
}

func (s *Server) handleListObjects(w http.ResponseWriter, r *http.Request, bucket string) {
	var folderID *string
	if bucket != "wyvern-vault" {
		folders, _ := s.store.ListFolders(nil)
		for _, f := range folders {
			if f.Name == bucket {
				folderID = &f.ID
				break
			}
		}
	}

	files, _, _ := s.store.ListFiles(folderID, "all", "name", "ASC", 1000, 0)

	res := ListBucketResult{
		Xmlns:       "http://s3.amazonaws.com/doc/2006-03-01/",
		Name:        bucket,
		KeyCount:    len(files),
		MaxKeys:     1000,
		IsTruncated: false,
	}

	for _, f := range files {
		res.Contents = append(res.Contents, S3Object{
			Key:          f.Name,
			LastModified: f.UpdatedAt,
			ETag:         fmt.Sprintf(`"%s"`, f.SHA256),
			Size:         f.Size,
			StorageClass: "STANDARD",
		})
	}

	w.Header().Set("Content-Type", "application/xml")
	_ = xml.NewEncoder(w).Encode(res)
}

func (s *Server) handleGetObject(w http.ResponseWriter, r *http.Request, bucket, key string) {
	file := s.findFile(bucket, key)
	if file == nil {
		http.Error(w, "NoSuchKey", http.StatusNotFound)
		return
	}

	data, err := s.engine.ReadRange(r.Context(), file.ID, 0, file.Size-1)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", file.MimeType)
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(data)))
	w.Header().Set("ETag", fmt.Sprintf(`"%s"`, file.SHA256))
	w.Header().Set("Last-Modified", file.UpdatedAt.Format(http.TimeFormat))
	_, _ = w.Write(data)
}

func (s *Server) handleHeadObject(w http.ResponseWriter, r *http.Request, bucket, key string) {
	file := s.findFile(bucket, key)
	if file == nil {
		http.Error(w, "NoSuchKey", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", file.MimeType)
	w.Header().Set("Content-Length", fmt.Sprintf("%d", file.Size))
	w.Header().Set("ETag", fmt.Sprintf(`"%s"`, file.SHA256))
	w.Header().Set("Last-Modified", file.UpdatedAt.Format(http.TimeFormat))
	w.WriteHeader(http.StatusOK)
}

func (s *Server) handlePutObject(w http.ResponseWriter, r *http.Request, bucket, key string) {
	tmpFile, err := os.CreateTemp("", "wyvern_s3_upload_*")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer os.Remove(tmpFile.Name())

	_, err = io.Copy(tmpFile, r.Body)
	_ = tmpFile.Close()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var folderID *string
	if bucket != "wyvern-vault" {
		folders, _ := s.store.ListFolders(nil)
		for _, f := range folders {
			if f.Name == bucket {
				folderID = &f.ID
				break
			}
		}
	}

	uploaded, err := s.engine.UploadFile(r.Context(), tmpFile.Name(), engine.UploadOptions{
		FolderID:   folderID,
		CustomName: path.Base(key),
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("ETag", fmt.Sprintf(`"%s"`, uploaded.SHA256))
	w.WriteHeader(http.StatusOK)
}

func (s *Server) handleDeleteObject(w http.ResponseWriter, r *http.Request, bucket, key string) {
	file := s.findFile(bucket, key)
	if file != nil {
		_ = s.store.DeleteFile(file.ID, true)
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) findFile(bucket, key string) *storage.File {
	var folderID *string
	if bucket != "wyvern-vault" {
		folders, _ := s.store.ListFolders(nil)
		for _, f := range folders {
			if f.Name == bucket {
				folderID = &f.ID
				break
			}
		}
	}

	files, _, err := s.store.ListFiles(folderID, "all", "name", "ASC", 1000, 0)
	if err != nil {
		return nil
	}

	for _, f := range files {
		if f.Name == key || path.Base(key) == f.Name {
			return &f
		}
	}

	return nil
}
