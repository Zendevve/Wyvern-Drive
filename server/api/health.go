package api

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"wyvern-drive/internal/database"
)

// Handler serves the headless daemon's HTTP surface: GET /api/v1/health
// only. No metadata routes, no static admin, no CORS.
type Handler struct {
	mux   *http.ServeMux
	store *database.Store
}

// NewHandler wires the health route onto a Go http.ServeMux using method
// patterns. Unknown routes fall through to 404; wrong methods to 405.
func NewHandler(store *database.Store) http.Handler {
	h := &Handler{mux: http.NewServeMux(), store: store}
	h.mux.HandleFunc("GET /api/v1/health", h.health)
	return h
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	h.mux.ServeHTTP(w, r)
}

// health reports database state honestly: a 2s-deadline Readiness query
// decides between a 200 healthy body carrying the applied schema version
// and a 503 that never discloses SQL or paths.
func (h *Handler) health(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	version, err := h.store.Readiness(ctx)
	if err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{
			"error": map[string]any{
				"code":    "DATABASE_UNAVAILABLE",
				"message": "The local database is unavailable.",
				"details": map[string]any{},
			},
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":         "healthy",
		"database":       "ready",
		"schema_version": version,
	})
}

func writeJSON(w http.ResponseWriter, status int, body map[string]any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
