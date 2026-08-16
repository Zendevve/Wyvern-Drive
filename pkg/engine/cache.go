package engine

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// MemoryChunkCache provides an in-memory LRU cache for hot chunk bytes (e.g. video streams).
type MemoryChunkCache struct {
	mu       sync.Mutex
	maxBytes int64
	curBytes int64
	items    map[string][]byte
	order    []string
}

// NewMemoryChunkCache initializes an in-memory chunk cache with a byte ceiling.
func NewMemoryChunkCache(maxBytes int64) *MemoryChunkCache {
	if maxBytes <= 0 {
		maxBytes = 256 * 1024 * 1024 // 256MB default
	}
	return &MemoryChunkCache{
		maxBytes: maxBytes,
		items:    make(map[string][]byte),
		order:    make([]string, 0),
	}
}

// Get retrieves chunk bytes from memory if present.
func (m *MemoryChunkCache) Get(key string) ([]byte, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	data, exists := m.items[key]
	if !exists {
		return nil, false
	}

	// Move to end of LRU list
	for i, k := range m.order {
		if k == key {
			m.order = append(m.order[:i], m.order[i+1:]...)
			m.order = append(m.order, key)
			break
		}
	}

	cp := make([]byte, len(data))
	copy(cp, data)
	return cp, true
}

// Put adds or updates a chunk in memory, evicting oldest items if capacity exceeded.
func (m *MemoryChunkCache) Put(key string, data []byte) {
	m.mu.Lock()
	defer m.mu.Unlock()

	dataLen := int64(len(data))
	if dataLen > m.maxBytes {
		return // single chunk larger than cache capacity
	}

	if existing, exists := m.items[key]; exists {
		m.curBytes -= int64(len(existing))
	}

	for m.curBytes+dataLen > m.maxBytes && len(m.order) > 0 {
		oldest := m.order[0]
		m.order = m.order[1:]
		if oldData, ok := m.items[oldest]; ok {
			m.curBytes -= int64(len(oldData))
			delete(m.items, oldest)
		}
	}

	cp := make([]byte, len(data))
	copy(cp, data)
	m.items[key] = cp
	m.order = append(m.order, key)
	m.curBytes += dataLen
}

// Clear wipes memory cache.
func (m *MemoryChunkCache) Clear() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.items = make(map[string][]byte)
	m.order = make([]string, 0)
	m.curBytes = 0
}

// DiskChunkCache provides persistent disk caching of chunks.
type DiskChunkCache struct {
	mu       sync.Mutex
	cacheDir string
	maxBytes int64
}

// NewDiskChunkCache initializes a disk-backed cache directory.
func NewDiskChunkCache(cacheDir string, maxBytes int64) (*DiskChunkCache, error) {
	if cacheDir == "" {
		cacheDir = filepath.Join(os.TempDir(), "wyvern_chunk_cache")
	}
	if maxBytes <= 0 {
		maxBytes = 2 * 1024 * 1024 * 1024 // 2GB default
	}

	if err := os.MkdirAll(cacheDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create cache dir: %w", err)
	}

	return &DiskChunkCache{
		cacheDir: cacheDir,
		maxBytes: maxBytes,
	}, nil
}

func (d *DiskChunkCache) keyToPath(key string) string {
	h := sha256.Sum256([]byte(key))
	name := hex.EncodeToString(h[:])
	return filepath.Join(d.cacheDir, name+".chunk")
}

// Get reads a chunk from disk if available.
func (d *DiskChunkCache) Get(key string) ([]byte, bool) {
	d.mu.Lock()
	defer d.mu.Unlock()

	p := d.keyToPath(key)
	data, err := os.ReadFile(p)
	if err != nil {
		return nil, false
	}

	// Touch file to update mod time for LRU tracking
	now := time.Now()
	_ = os.Chtimes(p, now, now)
	return data, true
}

// Put writes a chunk to disk, pruning directory if size exceeds quota.
func (d *DiskChunkCache) Put(key string, data []byte) {
	d.mu.Lock()
	defer d.mu.Unlock()

	p := d.keyToPath(key)
	_ = os.WriteFile(p, data, 0644)
	d.pruneIfNeeded()
}

func (d *DiskChunkCache) pruneIfNeeded() {
	entries, err := os.ReadDir(d.cacheDir)
	if err != nil {
		return
	}

	var totalSize int64
	type fileItem struct {
		path    string
		size    int64
		modTime time.Time
	}
	var files []fileItem

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		totalSize += info.Size()
		files = append(files, fileItem{
			path:    filepath.Join(d.cacheDir, entry.Name()),
			size:    info.Size(),
			modTime: info.ModTime(),
		})
	}

	if totalSize <= d.maxBytes {
		return
	}

	// Sort oldest first
	for i := 0; i < len(files)-1; i++ {
		for j := i + 1; j < len(files); j++ {
			if files[j].modTime.Before(files[i].modTime) {
				files[i], files[j] = files[j], files[i]
			}
		}
	}

	for _, f := range files {
		if totalSize <= d.maxBytes {
			break
		}
		_ = os.Remove(f.path)
		totalSize -= f.size
	}
}

// TieredChunkCache coordinates L1 Memory and L2 Disk caches.
type TieredChunkCache struct {
	mem  *MemoryChunkCache
	disk *DiskChunkCache
}

// NewTieredChunkCache creates a unified caching manager.
func NewTieredChunkCache(cacheDir string, memMax, diskMax int64) *TieredChunkCache {
	var disk *DiskChunkCache
	if diskCache, err := NewDiskChunkCache(cacheDir, diskMax); err == nil {
		disk = diskCache
	}
	return &TieredChunkCache{
		mem:  NewMemoryChunkCache(memMax),
		disk: disk,
	}
}

// Get checks memory first, then disk.
func (t *TieredChunkCache) Get(key string) ([]byte, bool) {
	if t.mem != nil {
		if data, ok := t.mem.Get(key); ok {
			return data, true
		}
	}

	if t.disk != nil {
		if data, ok := t.disk.Get(key); ok {
			if t.mem != nil {
				t.mem.Put(key, data)
			}
			return data, true
		}
	}

	return nil, false
}

// Put stores in both memory and disk caches.
func (t *TieredChunkCache) Put(key string, data []byte) {
	if t.mem != nil {
		t.mem.Put(key, data)
	}
	if t.disk != nil {
		t.disk.Put(key, data)
	}
}
