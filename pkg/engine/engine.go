package engine

import (
	"context"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"mime"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"wyvern-drive/pkg/crypto"
	"wyvern-drive/pkg/discord"
	"wyvern-drive/pkg/storage"

	"github.com/google/uuid"
)

// ProgressCallback is invoked during transfers to notify subscribers of real-time progress.
type ProgressCallback func(transfer storage.Transfer)

// Engine coordinates Discord-backed storage operations.
type Engine struct {
	store         *storage.Store
	discordClient *discord.Client
	pool          *discord.WebhookPool
	cache         *TieredChunkCache
	callbacksMu   sync.RWMutex
	callbacks     map[string]ProgressCallback
	cancelsMu     sync.Mutex
	cancels       map[string]context.CancelFunc
}

// NewEngine creates an operational storage engine with caching and webhook pooling.
func NewEngine(store *storage.Store, discordClient *discord.Client) *Engine {
	if discordClient == nil {
		discordClient = discord.NewClient(nil)
	}

	settings, _ := store.GetAppSettings()
	fallbackURL := ""
	var memMax, diskMax int64
	var cacheDir string

	if settings != nil {
		fallbackURL = settings.WebhookURL
		memMax = 256 * 1024 * 1024
		diskMax = settings.MaxCacheSizeBytes
		cacheDir = settings.CacheDirectory
	}

	cache := NewTieredChunkCache(cacheDir, memMax, diskMax)
	pool := discord.NewWebhookPool(fallbackURL, nil)

	eng := &Engine{
		store:         store,
		discordClient: discordClient,
		pool:          pool,
		cache:         cache,
		callbacks:     make(map[string]ProgressCallback),
		cancels:       make(map[string]context.CancelFunc),
	}

	eng.syncWebhookPool()
	return eng
}

func (e *Engine) syncWebhookPool() {
	settings, err := e.store.GetAppSettings()
	if err == nil && settings != nil {
		e.pool.SetFallbackURL(settings.WebhookURL)
	}

	shards, err := e.store.GetActiveWebhookShards()
	if err == nil {
		for _, s := range shards {
			e.pool.AddShard(s.ID, s.Name, s.URL, s.ChannelID)
		}
	}
}

// ReloadPool refreshes the active webhook pool from storage.
func (e *Engine) ReloadPool() {
	e.syncWebhookPool()
}

// RegisterCallback registers a progress callback for a transfer ID.
func (e *Engine) RegisterCallback(transferID string, cb ProgressCallback) {
	e.callbacksMu.Lock()
	defer e.callbacksMu.Unlock()
	e.callbacks[transferID] = cb
}

// UnregisterCallback removes a progress callback.
func (e *Engine) UnregisterCallback(transferID string) {
	e.callbacksMu.Lock()
	defer e.callbacksMu.Unlock()
	delete(e.callbacks, transferID)
}

func (e *Engine) notifyProgress(t storage.Transfer) {
	_ = e.store.UpdateTransfer(&t)

	e.callbacksMu.RLock()
	cb, exists := e.callbacks[t.ID]
	e.callbacksMu.RUnlock()

	if exists && cb != nil {
		cb(t)
	}
}

// CancelTransfer cancels an active upload or download job.
func (e *Engine) CancelTransfer(transferID string) bool {
	e.cancelsMu.Lock()
	cancel, exists := e.cancels[transferID]
	if exists {
		delete(e.cancels, transferID)
	}
	e.cancelsMu.Unlock()

	if exists && cancel != nil {
		cancel()
		t, err := e.store.GetTransfer(transferID)
		if err == nil && t != nil {
			t.Status = storage.TransferStatusCancelled
			_ = e.store.UpdateTransfer(t)
		}
		return true
	}
	return false
}

// UploadOptions customizes an upload operation.
type UploadOptions struct {
	FolderID       *string
	CustomName     string
	ChunkSizeBytes int64
	Encrypt        *bool
}

// UploadFile splits a local file into Discord-sized chunks, encrypts each, and uploads across the webhook pool.
// Supports Content-Addressable Storage (CAS) deduplication to skip already uploaded chunks.
func (e *Engine) UploadFile(ctx context.Context, localFilePath string, opts UploadOptions) (*storage.File, error) {
	srcFile, err := os.Open(localFilePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open source file: %w", err)
	}
	defer srcFile.Close()

	fileInfo, err := srcFile.Stat()
	if err != nil {
		return nil, fmt.Errorf("failed to read file metadata: %w", err)
	}

	settings, err := e.store.GetAppSettings()
	if err != nil {
		return nil, fmt.Errorf("failed to load settings: %w", err)
	}

	e.syncWebhookPool()

	if settings.WebhookURL == "" && e.pool.ShardCount() == 0 {
		return nil, errors.New("Discord webhook is not configured. Please complete setup in Settings.")
	}

	chunkSize := settings.ChunkSizeBytes
	if opts.ChunkSizeBytes > 0 {
		chunkSize = opts.ChunkSizeBytes
	}
	if chunkSize <= 0 {
		chunkSize = 18 * 1024 * 1024
	}

	isEncrypted := settings.EncryptionEnabled
	if opts.Encrypt != nil {
		isEncrypted = *opts.Encrypt
	}

	var key []byte
	if isEncrypted {
		key = crypto.DeriveKey(settings.MasterKey, nil)
	}

	fileName := filepath.Base(localFilePath)
	if opts.CustomName != "" {
		fileName = opts.CustomName
	}

	mimeType := mime.TypeByExtension(filepath.Ext(fileName))
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	totalSize := fileInfo.Size()
	chunkCount := int((totalSize + chunkSize - 1) / chunkSize)
	if chunkCount == 0 {
		chunkCount = 1
	}

	// Calculate whole-file SHA-256
	fileSHA256, err := crypto.CalculateStreamSHA256(srcFile)
	if err != nil {
		return nil, fmt.Errorf("failed to compute file checksum: %w", err)
	}
	// Rewind file pointer after hashing
	if _, err := srcFile.Seek(0, io.SeekStart); err != nil {
		return nil, fmt.Errorf("failed to rewind file: %w", err)
	}

	fileID := uuid.New().String()
	fileRecord := &storage.File{
		ID:          fileID,
		FolderID:    opts.FolderID,
		Name:        fileName,
		Size:        totalSize,
		MimeType:    mimeType,
		SHA256:      fileSHA256,
		IsEncrypted: isEncrypted,
		ChunkCount:  chunkCount,
		ChunkSize:   chunkSize,
		Status:      storage.StatusUploading,
	}

	if err := e.store.CreateFile(fileRecord); err != nil {
		return nil, fmt.Errorf("failed to create database file entry: %w", err)
	}

	transferID := uuid.New().String()
	transfer := storage.Transfer{
		ID:               transferID,
		FileID:           fileID,
		Filename:         fileName,
		Type:             storage.TransferUpload,
		Status:           storage.TransferStatusRunning,
		TotalBytes:       totalSize,
		TransferredBytes: 0,
		ChunksTotal:      chunkCount,
		ChunksDone:       0,
		LocalPath:        localFilePath,
	}
	_ = e.store.CreateTransfer(&transfer)

	ctx, cancel := context.WithCancel(ctx)
	e.cancelsMu.Lock()
	e.cancels[transferID] = cancel
	e.cancelsMu.Unlock()
	defer func() {
		e.cancelsMu.Lock()
		delete(e.cancels, transferID)
		e.cancelsMu.Unlock()
	}()

	startTime := time.Now()
	var chunks []storage.Chunk
	buffer := make([]byte, chunkSize)

	for index := range chunkCount {
		select {
		case <-ctx.Done():
			transfer.Status = storage.TransferStatusCancelled
			transfer.ErrorMessage = "Upload cancelled by user"
			e.notifyProgress(transfer)
			_ = e.store.SetFileStatus(fileID, storage.StatusFailed)
			return nil, ctx.Err()
		default:
		}

		n, readErr := io.ReadFull(srcFile, buffer)
		if readErr != nil && readErr != io.EOF && readErr != io.ErrUnexpectedEOF {
			transfer.Status = storage.TransferStatusFailed
			transfer.ErrorMessage = readErr.Error()
			e.notifyProgress(transfer)
			_ = e.store.SetFileStatus(fileID, storage.StatusFailed)
			return nil, fmt.Errorf("failed reading chunk %d: %w", index, readErr)
		}

		rawChunk := buffer[:n]
		chunkHash := crypto.CalculateSHA256(rawChunk)

		// ------------------------------------------------
		// 1. Content-Addressable Storage (CAS) Deduplication
		// ------------------------------------------------
		if settings.DeduplicationEnabled {
			if existing, err := e.store.FindChunkByHash(chunkHash); err == nil && existing != nil {
				// Re-use existing chunk metadata
				chunkRecord := storage.Chunk{
					ID:            uuid.New().String(),
					FileID:        fileID,
					ChunkIndex:    index,
					MessageID:     existing.MessageID,
					AttachmentID:  existing.AttachmentID,
					AttachmentURL: existing.AttachmentURL,
					ProxyURL:      existing.ProxyURL,
					Size:          int64(n),
					ChunkHash:     chunkHash,
					Nonce:         existing.Nonce,
					CreatedAt:     time.Now(),
				}

				if err := e.store.CreateChunk(&chunkRecord); err != nil {
					return nil, fmt.Errorf("failed to record deduplicated chunk in database: %w", err)
				}

				_ = e.store.RecordDeduplication(int64(n))
				if e.cache != nil {
					e.cache.Put(chunkRecord.ID, rawChunk)
				}

				chunks = append(chunks, chunkRecord)
				transfer.TransferredBytes += int64(n)
				transfer.ChunksDone = index + 1
				transfer.ProgressPercent = (float64(transfer.TransferredBytes) / float64(transfer.TotalBytes)) * 100.0
				e.notifyProgress(transfer)
				continue
			}
		}

		// ------------------------------------------------
		// 2. Encryption
		// ------------------------------------------------
		chunkToUpload := rawChunk
		var nonceHex string

		if isEncrypted {
			encryptedBytes, nonce, encErr := crypto.EncryptChunk(rawChunk, key)
			if encErr != nil {
				transfer.Status = storage.TransferStatusFailed
				transfer.ErrorMessage = encErr.Error()
				e.notifyProgress(transfer)
				_ = e.store.SetFileStatus(fileID, storage.StatusFailed)
				return nil, fmt.Errorf("encryption error on chunk %d: %w", index, encErr)
			}
			chunkToUpload = encryptedBytes
			nonceHex = hex.EncodeToString(nonce)
		}

		// ------------------------------------------------
		// 3. Multi-Webhook Pool Dispatch & Rate-Limit Backoff
		// ------------------------------------------------
		chunkFilename := fmt.Sprintf("chunk_%05d.wyv", index)
		desc := fmt.Sprintf("Wyvern Chunk %d/%d (File: %s)", index+1, chunkCount, fileID)

		var att *discord.Attachment
		var msgID string
		var upErr error

		for attempt := 0; attempt < 3; attempt++ {
			targetWebhookURL, _, shardID := e.pool.NextAvailableShard()
			if targetWebhookURL == "" {
				targetWebhookURL = settings.WebhookURL
			}

			att, msgID, upErr = e.discordClient.UploadAttachment(ctx, targetWebhookURL, chunkFilename, chunkToUpload, desc)
			if upErr != nil {
				if strings.Contains(upErr.Error(), "429") || strings.Contains(upErr.Error(), "rate limit") {
					e.pool.MarkRateLimited(shardID, 5*time.Second)
					continue
				}
				e.pool.MarkError(shardID)
				time.Sleep(time.Duration(1<<attempt) * 500 * time.Millisecond)
				continue
			}

			e.pool.MarkSuccess(shardID)
			break
		}

		if upErr != nil {
			transfer.Status = storage.TransferStatusFailed
			transfer.ErrorMessage = upErr.Error()
			e.notifyProgress(transfer)
			_ = e.store.SetFileStatus(fileID, storage.StatusFailed)
			return nil, fmt.Errorf("failed uploading chunk %d to Discord: %w", index, upErr)
		}

		chunkRecord := storage.Chunk{
			ID:            uuid.New().String(),
			FileID:        fileID,
			ChunkIndex:    index,
			MessageID:     msgID,
			AttachmentID:  att.ID,
			AttachmentURL: att.URL,
			ProxyURL:      att.ProxyURL,
			Size:          int64(n),
			ChunkHash:     chunkHash,
			Nonce:         nonceHex,
			CreatedAt:     time.Now(),
		}

		if err := e.store.CreateChunk(&chunkRecord); err != nil {
			return nil, fmt.Errorf("failed to record chunk in database: %w", err)
		}

		if e.cache != nil {
			e.cache.Put(chunkRecord.ID, rawChunk)
		}

		chunks = append(chunks, chunkRecord)

		transfer.TransferredBytes += int64(n)
		transfer.ChunksDone = index + 1
		elapsedSec := time.Since(startTime).Seconds()
		if elapsedSec > 0 {
			transfer.SpeedBps = int64(float64(transfer.TransferredBytes) / elapsedSec)
			if transfer.SpeedBps > 0 {
				remBytes := transfer.TotalBytes - transfer.TransferredBytes
				transfer.ETASeconds = remBytes / transfer.SpeedBps
			}
		}
		transfer.ProgressPercent = (float64(transfer.TransferredBytes) / float64(transfer.TotalBytes)) * 100.0
		e.notifyProgress(transfer)
	}

	// Finalize file
	_ = e.store.SetFileStatus(fileID, storage.StatusCompleted)
	transfer.Status = storage.TransferStatusCompleted
	transfer.ProgressPercent = 100.0
	e.notifyProgress(transfer)

	fileRecord.Status = storage.StatusCompleted
	fileRecord.Chunks = chunks
	return fileRecord, nil
}

// DownloadFile downloads, decrypts, and reassembles a file from Discord attachments with automatic URL expiration refresh.
func (e *Engine) DownloadFile(ctx context.Context, fileID string, destinationPath string) error {
	file, err := e.store.GetFileWithChunks(fileID)
	if err != nil {
		return fmt.Errorf("failed to fetch file record: %w", err)
	}

	if len(file.Chunks) == 0 {
		return errors.New("file has no recorded chunks")
	}

	settings, err := e.store.GetAppSettings()
	if err != nil {
		return fmt.Errorf("failed to load settings: %w", err)
	}

	var key []byte
	if file.IsEncrypted {
		key = crypto.DeriveKey(settings.MasterKey, nil)
	}

	destDir := filepath.Dir(destinationPath)
	if err := os.MkdirAll(destDir, 0755); err != nil {
		return fmt.Errorf("failed to create destination directory: %w", err)
	}

	outFile, err := os.Create(destinationPath)
	if err != nil {
		return fmt.Errorf("failed to create destination file: %w", err)
	}
	defer outFile.Close()

	transferID := uuid.New().String()
	transfer := storage.Transfer{
		ID:               transferID,
		FileID:           fileID,
		Filename:         file.Name,
		Type:             storage.TransferDownload,
		Status:           storage.TransferStatusRunning,
		TotalBytes:       file.Size,
		TransferredBytes: 0,
		ChunksTotal:      len(file.Chunks),
		ChunksDone:       0,
		LocalPath:        destinationPath,
	}
	_ = e.store.CreateTransfer(&transfer)

	ctx, cancel := context.WithCancel(ctx)
	e.cancelsMu.Lock()
	e.cancels[transferID] = cancel
	e.cancelsMu.Unlock()
	defer func() {
		e.cancelsMu.Lock()
		delete(e.cancels, transferID)
		e.cancelsMu.Unlock()
	}()

	startTime := time.Now()

	for i, chunk := range file.Chunks {
		select {
		case <-ctx.Done():
			transfer.Status = storage.TransferStatusCancelled
			transfer.ErrorMessage = "Download cancelled"
			e.notifyProgress(transfer)
			return ctx.Err()
		default:
		}

		var plainBytes []byte
		var cached bool

		// Check local cache
		if e.cache != nil {
			if data, ok := e.cache.Get(chunk.ID); ok {
				plainBytes = data
				cached = true
			}
		}

		if !cached {
			dlBytes, dlErr := e.discordClient.DownloadAttachment(ctx, chunk.AttachmentURL, -1, -1)
			if dlErr != nil {
				// Attempt URL auto-refresh on 403 / 404 / signature expiration
				if strings.Contains(dlErr.Error(), "403") || strings.Contains(dlErr.Error(), "404") || strings.Contains(dlErr.Error(), "expired") {
					freshURL, refErr := e.discordClient.RefreshChunkURL(ctx, settings.WebhookURL, settings.BotToken, settings.ChannelID, chunk.MessageID)
					if refErr == nil && freshURL != "" {
						chunk.AttachmentURL = freshURL
						_ = e.store.UpdateChunkURL(chunk.ID, freshURL)
						dlBytes, dlErr = e.discordClient.DownloadAttachment(ctx, freshURL, -1, -1)
					}
				}

				if dlErr != nil {
					transfer.Status = storage.TransferStatusFailed
					transfer.ErrorMessage = dlErr.Error()
					e.notifyProgress(transfer)
					return fmt.Errorf("failed downloading chunk %d: %w", chunk.ChunkIndex, dlErr)
				}
			}

			plainBytes = dlBytes
			if file.IsEncrypted {
				nonce, hexErr := hex.DecodeString(chunk.Nonce)
				if hexErr != nil {
					return fmt.Errorf("corrupt nonce on chunk %d: %w", chunk.ChunkIndex, hexErr)
				}
				decrypted, decErr := crypto.DecryptChunk(dlBytes, key, nonce)
				if decErr != nil {
					transfer.Status = storage.TransferStatusFailed
					transfer.ErrorMessage = decErr.Error()
					e.notifyProgress(transfer)
					return fmt.Errorf("failed decrypting chunk %d: %w", chunk.ChunkIndex, decErr)
				}
				plainBytes = decrypted
			}

			if e.cache != nil {
				e.cache.Put(chunk.ID, plainBytes)
			}
		}

		// Verify chunk SHA256 integrity
		if chunk.ChunkHash != "" {
			h := crypto.CalculateSHA256(plainBytes)
			if h != chunk.ChunkHash {
				transfer.Status = storage.TransferStatusFailed
				transfer.ErrorMessage = "Chunk integrity checksum mismatch"
				e.notifyProgress(transfer)
				return fmt.Errorf("chunk %d checksum failed", chunk.ChunkIndex)
			}
		}

		if _, writeErr := outFile.Write(plainBytes); writeErr != nil {
			return fmt.Errorf("failed writing to output file: %w", writeErr)
		}

		transfer.TransferredBytes += int64(len(plainBytes))
		transfer.ChunksDone = i + 1
		elapsedSec := time.Since(startTime).Seconds()
		if elapsedSec > 0 {
			transfer.SpeedBps = int64(float64(transfer.TransferredBytes) / elapsedSec)
			if transfer.SpeedBps > 0 {
				remBytes := transfer.TotalBytes - transfer.TransferredBytes
				transfer.ETASeconds = remBytes / transfer.SpeedBps
			}
		}
		transfer.ProgressPercent = (float64(transfer.TransferredBytes) / float64(transfer.TotalBytes)) * 100.0
		e.notifyProgress(transfer)
	}

	// Verify full file SHA256
	if _, seekErr := outFile.Seek(0, io.SeekStart); seekErr == nil {
		actualHash, hashErr := crypto.CalculateStreamSHA256(outFile)
		if hashErr == nil && file.SHA256 != "" && actualHash != file.SHA256 {
			return fmt.Errorf("final file hash mismatch (expected %s, got %s)", file.SHA256, actualHash)
		}
	}

	transfer.Status = storage.TransferStatusCompleted
	transfer.ProgressPercent = 100.0
	e.notifyProgress(transfer)
	return nil
}

// ReadRange reads a specific byte slice range [start, end] with lookahead prefetching and 2024 URL expiration auto-refresh.
func (e *Engine) ReadRange(ctx context.Context, fileID string, startOffset, endOffset int64) ([]byte, error) {
	file, err := e.store.GetFileWithChunks(fileID)
	if err != nil {
		return nil, err
	}

	if startOffset < 0 || startOffset >= file.Size {
		return nil, errors.New("requested range start out of bounds")
	}
	if endOffset >= file.Size {
		endOffset = file.Size - 1
	}
	if endOffset < startOffset {
		return []byte{}, nil
	}

	settings, err := e.store.GetAppSettings()
	if err != nil {
		return nil, err
	}

	var key []byte
	if file.IsEncrypted {
		key = crypto.DeriveKey(settings.MasterKey, nil)
	}

	chunkSize := file.ChunkSize
	startChunkIdx := int(startOffset / chunkSize)
	endChunkIdx := int(endOffset / chunkSize)

	// Trigger asynchronous lookahead prefetch for subsequent chunks
	if settings.PrefetchEnabled && e.cache != nil && endChunkIdx+1 < len(file.Chunks) {
		go e.prefetchLookaheadChunks(context.Background(), file, key, endChunkIdx+1, endChunkIdx+2, settings)
	}

	result := make([]byte, 0, endOffset-startOffset+1)

	for idx := startChunkIdx; idx <= endChunkIdx && idx < len(file.Chunks); idx++ {
		chunk := file.Chunks[idx]
		var plainBytes []byte
		var cached bool

		if e.cache != nil {
			if data, ok := e.cache.Get(chunk.ID); ok {
				plainBytes = data
				cached = true
			}
		}

		if !cached {
			dlBytes, err := e.discordClient.DownloadAttachment(ctx, chunk.AttachmentURL, -1, -1)
			if err != nil {
				if strings.Contains(err.Error(), "403") || strings.Contains(err.Error(), "404") || strings.Contains(err.Error(), "expired") {
					freshURL, refErr := e.discordClient.RefreshChunkURL(ctx, settings.WebhookURL, settings.BotToken, settings.ChannelID, chunk.MessageID)
					if refErr == nil && freshURL != "" {
						chunk.AttachmentURL = freshURL
						_ = e.store.UpdateChunkURL(chunk.ID, freshURL)
						dlBytes, err = e.discordClient.DownloadAttachment(ctx, freshURL, -1, -1)
					}
				}
				if err != nil {
					return nil, fmt.Errorf("failed fetching chunk %d for range: %w", idx, err)
				}
			}

			plainBytes = dlBytes
			if file.IsEncrypted {
				nonce, hexErr := hex.DecodeString(chunk.Nonce)
				if hexErr != nil {
					return nil, hexErr
				}
				decrypted, decErr := crypto.DecryptChunk(dlBytes, key, nonce)
				if decErr != nil {
					return nil, decErr
				}
				plainBytes = decrypted
			}

			if e.cache != nil {
				e.cache.Put(chunk.ID, plainBytes)
			}
		}

		chunkStartByte := int64(idx) * chunkSize
		chunkEndByte := chunkStartByte + int64(len(plainBytes)) - 1

		subStart := int64(0)
		if startOffset > chunkStartByte {
			subStart = startOffset - chunkStartByte
		}

		subEnd := int64(len(plainBytes)) - 1
		if endOffset < chunkEndByte {
			subEnd = endOffset - chunkStartByte
		}

		if subStart <= subEnd && subStart < int64(len(plainBytes)) {
			result = append(result, plainBytes[subStart:subEnd+1]...)
		}
	}

	return result, nil
}

func (e *Engine) prefetchLookaheadChunks(ctx context.Context, file *storage.File, key []byte, startIdx, endIdx int, settings *storage.AppSettings) {
	for idx := startIdx; idx <= endIdx && idx < len(file.Chunks); idx++ {
		chunk := file.Chunks[idx]
		if _, ok := e.cache.Get(chunk.ID); ok {
			continue
		}

		dlBytes, err := e.discordClient.DownloadAttachment(ctx, chunk.AttachmentURL, -1, -1)
		if err != nil {
			if strings.Contains(err.Error(), "403") || strings.Contains(err.Error(), "404") {
				freshURL, refErr := e.discordClient.RefreshChunkURL(ctx, settings.WebhookURL, settings.BotToken, settings.ChannelID, chunk.MessageID)
				if refErr == nil && freshURL != "" {
					chunk.AttachmentURL = freshURL
					_ = e.store.UpdateChunkURL(chunk.ID, freshURL)
					dlBytes, err = e.discordClient.DownloadAttachment(ctx, freshURL, -1, -1)
				}
			}
		}

		if err == nil {
			plainBytes := dlBytes
			if file.IsEncrypted {
				if nonce, hexErr := hex.DecodeString(chunk.Nonce); hexErr == nil {
					if decrypted, decErr := crypto.DecryptChunk(dlBytes, key, nonce); decErr == nil {
						plainBytes = decrypted
					}
				}
			}
			e.cache.Put(chunk.ID, plainBytes)
		}
	}
}
