package api

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"wyvern-drive/internal/database"
	"wyvern-drive/migrations"
)

// openTestStore opens a temp-file database migrated to the production
// foundation version: the healthy store against which handler shapes assert.
func openTestStore(t *testing.T, ctx context.Context) *database.Store {
	t.Helper()
	store, err := database.Open(ctx, filepath.Join(t.TempDir(), "wyvern.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = store.Close() })
	if err := database.Migrate(ctx, store, migrations.FS, filepath.Join(t.TempDir(), "backups")); err != nil {
		t.Fatal(err)
	}
	return store
}

func decodeBody(t *testing.T, body io.Reader) map[string]any {
	t.Helper()
	var decoded map[string]any
	if err := json.NewDecoder(body).Decode(&decoded); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	return decoded
}

// A healthy migrated store answers 200 with JSON status, database state,
// schema version, and no-store caching.
func TestHealthHealthy(t *testing.T) {
	store := openTestStore(t, context.Background())
	rec := httptest.NewRecorder()
	NewHandler(store).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/health", nil))
	res := rec.Result()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", res.StatusCode)
	}
	if ct := res.Header.Get("Content-Type"); ct != "application/json" {
		t.Fatalf("Content-Type = %q, want application/json", ct)
	}
	if cc := res.Header.Get("Cache-Control"); cc != "no-store" {
		t.Fatalf("Cache-Control = %q, want no-store", cc)
	}
	body := decodeBody(t, res.Body)
	if body["status"] != "healthy" || body["database"] != "ready" {
		t.Fatalf("body = %v, want healthy/ready", body)
	}
	version, ok := body["schema_version"].(float64)
	if !ok || version != 1 {
		t.Fatalf("schema_version = %v, want 1", body["schema_version"])
	}
}

// A closed database answers 503 with the safe envelope and no leaked SQL
// or paths.
func TestHealthUnavailable(t *testing.T) {
	ctx := context.Background()
	store, err := database.Open(ctx, filepath.Join(t.TempDir(), "wyvern.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	if err := database.Migrate(ctx, store, migrations.FS, filepath.Join(t.TempDir(), "backups")); err != nil {
		t.Fatal(err)
	}
	if err := store.Close(); err != nil {
		t.Fatal(err)
	}
	rec := httptest.NewRecorder()
	NewHandler(store).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/health", nil))
	res := rec.Result()
	if res.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", res.StatusCode)
	}
	raw, _ := io.ReadAll(res.Body)
	body := map[string]any{}
	if err := json.Unmarshal(raw, &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	errObj, ok := body["error"].(map[string]any)
	if !ok {
		t.Fatalf("body = %v, want error envelope", body)
	}
	if errObj["code"] != "DATABASE_UNAVAILABLE" {
		t.Fatalf("code = %v, want DATABASE_UNAVAILABLE", errObj["code"])
	}
	if errObj["message"] != "The local database is unavailable." {
		t.Fatalf("message = %v", errObj["message"])
	}
	details, ok := errObj["details"].(map[string]any)
	if !ok || len(details) != 0 {
		t.Fatalf("details = %v, want empty object", errObj["details"])
	}
	lowered := strings.ToLower(string(raw))
	for _, leak := range []string{"sql", ".sqlite", "select", "schema_migrations"} {
		if strings.Contains(lowered, leak) {
			t.Fatalf("body leaks %q: %s", leak, raw)
		}
	}
}

// Unknown routes are 404 and wrong methods on the health route are 405.
func TestHealthRoutes(t *testing.T) {
	store := openTestStore(t, context.Background())
	handler := NewHandler(store)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/nope", nil))
	if rec.Result().StatusCode != http.StatusNotFound {
		t.Fatalf("unknown route status = %d, want 404", rec.Result().StatusCode)
	}
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/v1/health", nil))
	if rec.Result().StatusCode != http.StatusMethodNotAllowed {
		t.Fatalf("wrong method status = %d, want 405", rec.Result().StatusCode)
	}
}
