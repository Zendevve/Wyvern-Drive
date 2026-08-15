package server

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"wyvern-drive/pkg/engine"
	"wyvern-drive/pkg/storage"
)

// Server is the embedded local HTTP server for high performance streaming and media preview.
type Server struct {
	store    *storage.Store
	engine   *engine.Engine
	port     int
	server   *http.Server
	listener net.Listener
	mu       sync.Mutex
	running  bool
}

// NewServer initializes the streaming HTTP server.
func NewServer(store *storage.Store, eng *engine.Engine, port int) *Server {
	if port <= 0 {
		port = 49152
	}
	return &Server{
		store:  store,
		engine: eng,
		port:   port,
	}
}

// Start launches the local HTTP server.
func (s *Server) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.running {
		return nil
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/health", s.handleHealth)
	mux.HandleFunc("/api/stream/", s.handleStream)
	mux.HandleFunc("/api/download/", s.handleDirectDownload)

	// Wrap mux with CORS headers for local webview access
	corsHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Range, Content-Type, Accept")
		w.Header().Set("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		mux.ServeHTTP(w, r)
	})

	addr := fmt.Sprintf("127.0.0.1:%d", s.port)
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		// Fallback to random available port if default is occupied
		listener, err = net.Listen("tcp", "127.0.0.1:0")
		if err != nil {
			return fmt.Errorf("failed to bind local streaming server: %w", err)
		}
		s.port = listener.Addr().(*net.TCPAddr).Port
	}
	s.listener = listener

	s.server = &http.Server{
		Handler:      corsHandler,
		ReadTimeout:  60 * time.Second,
		WriteTimeout: 600 * time.Second,
	}

	s.running = true
	go func() {
		_ = s.server.Serve(listener)
	}()

	return nil
}

// Stop gracefully stops the server.
func (s *Server) Stop(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.running || s.server == nil {
		return nil
	}

	s.running = false
	return s.server.Shutdown(ctx)
}

// Port returns the active bound port.
func (s *Server) Port() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.port
}

// GetStreamURL returns the local playback URL for a file.
func (s *Server) GetStreamURL(fileID string) string {
	return fmt.Sprintf("http://127.0.0.1:%d/api/stream/%s", s.Port(), fileID)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "ok",
		"service": "Wyvern Drive Local Streaming Server",
		"port":    s.Port(),
	})
}

func (s *Server) handleStream(w http.ResponseWriter, r *http.Request) {
	fileID := strings.TrimPrefix(r.URL.Path, "/api/stream/")
	fileID = strings.TrimSpace(fileID)
	if fileID == "" {
		http.Error(w, "missing file ID", http.StatusBadRequest)
		return
	}

	file, err := s.store.GetFile(fileID)
	if err != nil {
		http.Error(w, "file not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Accept-Ranges", "bytes")
	if file.MimeType != "" {
		w.Header().Set("Content-Type", file.MimeType)
	} else {
		w.Header().Set("Content-Type", "application/octet-stream")
	}

	rangeHeader := r.Header.Get("Range")
	if rangeHeader == "" {
		// Full file stream or initial request
		if file.Size <= 0 {
			w.Header().Set("Content-Length", "0")
			w.WriteHeader(http.StatusOK)
			return
		}

		// Stream entire file
		w.Header().Set("Content-Length", strconv.FormatInt(file.Size, 10))
		w.WriteHeader(http.StatusOK)

		data, err := s.engine.ReadRange(r.Context(), fileID, 0, file.Size-1)
		if err != nil {
			return
		}
		_, _ = w.Write(data)
		return
	}

	// Parse Range: bytes=start-end
	start, end, err := parseRangeHeader(rangeHeader, file.Size)
	if err != nil {
		w.Header().Set("Content-Range", fmt.Sprintf("bytes */%d", file.Size))
		http.Error(w, "Requested range not satisfiable", http.StatusRequestedRangeNotSatisfiable)
		return
	}

	contentLength := end - start + 1
	w.Header().Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end, file.Size))
	w.Header().Set("Content-Length", strconv.FormatInt(contentLength, 10))
	w.WriteHeader(http.StatusPartialContent)

	data, err := s.engine.ReadRange(r.Context(), fileID, start, end)
	if err != nil {
		return
	}
	_, _ = w.Write(data)
}

func (s *Server) handleDirectDownload(w http.ResponseWriter, r *http.Request) {
	fileID := strings.TrimPrefix(r.URL.Path, "/api/download/")
	fileID = strings.TrimSpace(fileID)
	if fileID == "" {
		http.Error(w, "missing file ID", http.StatusBadRequest)
		return
	}

	file, err := s.store.GetFile(fileID)
	if err != nil {
		http.Error(w, "file not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, file.Name))
	w.Header().Set("Content-Type", file.MimeType)
	w.Header().Set("Content-Length", strconv.FormatInt(file.Size, 10))

	data, err := s.engine.ReadRange(r.Context(), fileID, 0, file.Size-1)
	if err != nil {
		http.Error(w, "download failed: "+err.Error(), http.StatusInternalServerError)
		return
	}
	_, _ = w.Write(data)
}

func parseRangeHeader(header string, totalSize int64) (start, end int64, err error) {
	if !strings.HasPrefix(header, "bytes=") {
		return 0, 0, errors.New("invalid range unit")
	}

	rangeSpec := strings.TrimPrefix(header, "bytes=")
	parts := strings.Split(rangeSpec, "-")
	if len(parts) != 2 {
		return 0, 0, errors.New("invalid range specification")
	}

	if parts[0] == "" {
		// Suffix range: -N means last N bytes
		suffixLen, parseErr := strconv.ParseInt(parts[1], 10, 64)
		if parseErr != nil {
			return 0, 0, parseErr
		}
		start = totalSize - suffixLen
		if start < 0 {
			start = 0
		}
		end = totalSize - 1
		return start, end, nil
	}

	start, err = strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		return 0, 0, err
	}

	if parts[1] == "" {
		end = totalSize - 1
	} else {
		end, err = strconv.ParseInt(parts[1], 10, 64)
		if err != nil {
			return 0, 0, err
		}
	}

	if start > end || start >= totalSize {
		return 0, 0, errors.New("range not satisfiable")
	}

	if end >= totalSize {
		end = totalSize - 1
	}

	return start, end, nil
}
