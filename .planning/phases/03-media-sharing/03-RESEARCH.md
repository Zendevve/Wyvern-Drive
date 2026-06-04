# Research: Phase 3 — Media & Sharing

**Phase:** 3 — Media & Sharing
**Requirements:** MEDIA-01, MEDIA-02, SHAR-01, SHAR-02
**Date:** 2026-06-03

---

## 1. In-Browser Media Streaming (MEDIA-01)

### Architecture

Media preview requires decrypting chunks and streaming to native HTML5 elements. The existing `download.ts` pipeline decrypts all chunks into a single Blob — this works for small files but is inefficient for large media.

**Key challenge:** Large video/audio files cannot be fully decrypted before playback starts.

### Approach: Progressive Decryption with Blob URLs

1. **Small files (<10MB):** Decrypt all chunks → create Blob URL → set as `src` on `<img>`, `<video>`, or `<audio>`
2. **Large files (>10MB):** Decrypt chunks sequentially → append to growing Blob → update Blob URL as chunks arrive (requires revoking old URLs)

**Implementation pattern:**
```typescript
// For images — full decrypt then display
const blob = await downloadFile(fileId, key, webhookUrl);
const url = URL.createObjectURL(blob);
// Set as <img src={url} /> or <video src={url} />

// For audio/video — progressive streaming
const mediaBlob = await downloadFile(fileId, key, webhookUrl);
const mediaUrl = URL.createObjectURL(mediaBlob);
```

### Existing Code Reuse

- `download.ts:downloadFile()` — fetches + decrypts all chunks, returns Blob
- `discord.ts:refreshCdnUrl()` — refreshes expired CDN URLs
- `db.ts:getChunksByFileId()` — retrieves chunk metadata for ordering
- `crypto.ts:decryptFile()` — AES-256-GCM decryption via Web Worker
- `auth-store.ts:derivedKey` — decryption key from user password

### Media Type Detection

From `FileRecord.mimeType`:
- `image/*` → `<img>` element in modal overlay
- `video/*` → `<video>` with native controls
- `audio/*` → custom audio player (MEDIA-02)
- `application/pdf` → `<iframe>` with PDF viewer
- Other → download-only

### Component Structure

```
MediaPreviewModal (Radix Dialog)
├── MediaRenderer (switches on mimeType)
│   ├── ImageRenderer (<img>)
│   ├── VideoRenderer (<video>)
│   └── PdfRenderer (<iframe>)
├── DownloadButton
└── ShareButton
```

### Pitfalls

- **Memory pressure:** Large video files (500MB+) can OOM the browser. Must limit preview to reasonable sizes or show "too large to preview" for files >500MB.
- **CDN URL expiry during playback:** If playback lasts >24h, CDN URLs expire. Need to proactively refresh URLs for long audio tracks.
- **Blob URL cleanup:** Always call `URL.revokeObjectURL()` when modal closes to prevent memory leaks.
- **Codec support:** Browser video/audio codec support varies. Cannot transcode (out of scope per REQUIREMENTS.md). Must handle gracefully if codec unsupported.

---

## 2. Persistent Audio Player (MEDIA-2)

### Architecture

Audio player must survive page navigation (folder changes). Since this is a SPA with Zustand, the player state lives in a global store — navigation doesn't unmount the root component.

### State Design

```typescript
interface AudioPlayerState {
  // Current track
  currentTrack: FileRecord | null;
  playlist: FileRecord[];
  currentIndex: number;
  
  // Playback state
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  
  // UI state
  isVisible: boolean;
  isExpanded: boolean;
  
  // Actions
  play: (track: FileRecord, playlist?: FileRecord[]) => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
  previous: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  close: () => void;
}
```

### Implementation Strategy

1. **Audio element reference:** Store `HTMLAudioElement` in a module-level variable (outside React) or in Zustand as a non-serializable field
2. **Blob URL management:** When track changes, revoke old URL, decrypt new track, create new URL
3. **Playlist derivation:** Filter `useFileStore().files` by `mimeType.startsWith('audio/')` and `folderId === currentFolderId`
4. **Navigation persistence:** Player bar renders in `App.tsx` outside route content — always mounted

### Component Structure

```
AudioPlayer (fixed bottom bar)
├── AlbumArt (thumbnail from file icon)
├── TrackInfo (name, folder)
├── Controls
│   ├── PreviousButton
│   ├── PlayPauseButton
│   └── NextButton
├── ProgressBar (seekable)
├── VolumeControl
└── CloseButton
```

### Pitfalls

- **Decryption latency:** Audio must decrypt before playback starts. Show loading indicator. For large audio files (>50MB), consider streaming chunks progressively.
- **Browser autoplay policy:** Browsers block autoplay without user gesture. First play must be triggered by user click.
- **Background tab throttling:** Browsers throttle `setInterval` in background tabs. Use `requestAnimationFrame` only when tab is visible; fall back to time-based tracking when hidden.
- **Memory cleanup:** When player closes, must revoke Blob URL and clear audio element `src`.

---

## 3. Secure Sharing (SHAR-01)

### Architecture

Share links encode file reference + encrypted key material in the URL fragment. The fragment is never sent to servers. Password protection adds a second encryption layer.

### Share Link Format

```
https://app.example.com/share/{fileId}#{encodedPayload}
```

Where `encodedPayload` contains:
```typescript
interface SharePayload {
  fileKey: string;        // Base64-encoded encrypted file key
  salt: string;           // Base64-encoded salt for key derivation
  nonce: string;          // Base64-encoded nonce for decryption
  expiresAt: number;      // Unix timestamp (0 = no expiry)
  hasPassword: boolean;   // Whether password is required
}
```

### Password Protection Flow

**Creating share link:**
1. User selects file → opens share modal
2. User optionally sets password + expiration
3. Generate random salt → derive key from password via PBKDF2
4. Encrypt file's decryption key with this derived key
5. Encode payload into URL fragment
6. Store share metadata in IndexedDB

**Accessing share link:**
1. Visitor opens `/share/{fileId}#{payload}`
2. App parses fragment → extracts encrypted key, salt, expiry
3. If expired → show "link expired" message
4. If hasPassword → show password prompt
5. Derive key from password → decrypt file key
6. Fetch + decrypt file using decrypted key → serve for download

### IndexedDB Storage

New object store: `shares`
```typescript
interface ShareRecord {
  id: string;
  fileId: string;
  fileName: string;
  encryptedKey: string;    // Base64
  salt: string;            // Base64
  nonce: string;           // Base64
  expiresAt: number;       // Unix timestamp, 0 = never
  hasPassword: boolean;
  createdAt: number;
  accessCount: number;
}
```

### Security Considerations

- **Fragment-based:** URL fragment (`#`) is never sent to server — key material stays client-side
- **No server-side validation:** Expiry checked client-side only. Determined attacker can bypass by modifying JS. Acceptable for v1.
- **Password derivation:** Use separate PBKDF2 derivation (600K iterations) for share password, NOT the user's main key
- **Key encryption:** File's AES key is encrypted with share password's derived key, then embedded in URL
- **Revocation:** Delete from IndexedDB = link stops working (but if someone already has the URL and key, they can still access)

### Component Structure

```
ShareModal (Radix Dialog)
├── ShareLinkDisplay (copy-to-clipboard)
├── PasswordToggle + PasswordInput
├── ExpirySelector (1h, 24h, 7d, 30d, never)
├── CopyButton
└── RevokeButton (for managing existing shares)
```

### Pitfalls

- **URL length:** Encrypted payload in fragment can be long. Base64 encoding adds ~33% overhead. Most browsers handle 2KB+ URLs fine.
- **Key derivation on access:** PBKDF2 600K iterations takes ~1-2 seconds. Show loading state during password verification.
- **Share metadata sync:** Shares stored locally only. If user clears browser data, share metadata is lost (but links still work if someone has them).
- **Large file sharing:** Must decrypt entire file before serving download. No streaming for shared files in v1.

---

## 4. Photo Timeline (SHAR-02)

### Architecture

Chronological gallery filtering `FileRecord` entries where `mimeType.startsWith('image/')`, grouped by `createdAt` date.

### Data Flow

1. Load all files from `useFileStore().files`
2. Filter to images: `files.filter(f => f.mimeType.startsWith('image/'))`
3. Sort by `createdAt` descending
4. Group by date: `groupBy(files, f => formatDate(f.createdAt))`
5. Render in masonry/grid layout with lazy loading

### Date Grouping Strategy

```typescript
function groupByDate(files: FileRecord[]): Map<string, FileRecord[]> {
  const groups = new Map<string, FileRecord[]>();
  for (const file of files) {
    const key = file.createdAt.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const group = groups.get(key) || [];
    group.push(file);
    groups.set(key, group);
  }
  return groups;
}
```

### Thumbnail Strategy

- **Option A (recommended):** Use small decrypted Blob URLs for thumbnails. For images <1MB, full decrypt is fast.
- **Option B:** For large images, decrypt only first chunk (8MB) and create partial Blob URL for thumbnail. Skip for v1.
- **Lazy loading:** Use `loading="lazy"` attribute on `<img>` elements + Intersection Observer for virtualized rendering.

### Component Structure

```
PhotoTimeline
├── DateGroupHeader ("June 3, 2026")
│   └── PhotoGrid (CSS Grid or Masonry)
│       ├── PhotoCard (thumbnail + name)
│       │   └── onClick → LightboxModal
│       └── PhotoCard...
├── DateGroupHeader
│   └── PhotoGrid...
└── EmptyState ("No photos found")
```

### Lightbox

- Full-screen overlay using Radix Dialog
- Swipe navigation (left/right) on mobile
- Keyboard navigation (arrow keys)
- Close on escape or backdrop click
- Shows: full-size image, filename, date, size

### Performance Considerations

- **Lazy loading:** Only load thumbnails for visible images
- **Virtual scrolling:** For 1000+ photos, use windowed rendering (reuse TanStack Virtual from Phase 2)
- **Memory:** Revoke Blob URLs for images scrolled out of view
- **CDN refresh:** Photos near CDN expiry must be refreshed before display

### Pitfalls

- **No EXIF extraction:** Browser JS cannot reliably extract EXIF from encrypted blobs (would need to decrypt first). EXIF display deferred to v2.
- **Masonry layout complexity:** CSS Grid with `grid-auto-rows` is simpler than true masonry. Use fixed aspect ratio thumbnails for uniform grid.
- **Date timezone:** `createdAt` is stored as Date object. Grouping by local date may differ across timezones. Use UTC for consistency.

---

## 5. New Dependencies

### Required

None — all functionality achievable with existing stack (React, Zustand, Radix UI, Web APIs).

### Optional (Recommended)

| Package | Purpose | Size | Justification |
|---------|---------|------|---------------|
| `react-lazy-load-image-component` | Lazy loading with fade-in | ~5KB | Better UX than native `loading="lazy"` |
| `embla-carousel` | Lightbox swipe navigation | ~8KB | Touch-friendly carousel for photo lightbox |

### Not Recommended

| Package | Reason |
|---------|--------|
| `howler.js` | Audio playback. Overkill — native `HTMLAudioElement` sufficient for v1. |
| `react-photo-album` | Photo gallery. Adds dependency for layout we can achieve with CSS Grid. |
| `exifr` | EXIF extraction. Requires full image decrypt first. Defer to v2. |

---

## 6. Files to Create

| File | Purpose |
|------|---------|
| `src/stores/audio-store.ts` | Persistent audio player state |
| `src/stores/share-store.ts` | Share link management |
| `src/components/MediaPreviewModal.tsx` | Image/video/pdf preview overlay |
| `src/components/AudioPlayer.tsx` | Fixed bottom audio player bar |
| `src/components/ShareModal.tsx` | Share link generation UI |
| `src/components/PhotoTimeline.tsx` | Chronological photo gallery |
| `src/components/LightboxModal.tsx` | Full-screen photo viewer |
| `src/lib/sharing.ts` | Share link encode/decode + password protection |
| `src/lib/media.ts` | Media type detection + blob URL helpers |

## 7. Files to Modify

| File | Change |
|------|--------|
| `src/lib/db.ts` | Add `shares` object store (DB_VERSION → 2) |
| `src/types/index.ts` | Add `ShareRecord` type |
| `src/App.tsx` | Add `AudioPlayer` to layout (always mounted), add `/share/:id` route handling |
| `src/components/FileList.tsx` | Add click handler for media preview, add photo timeline toggle |

## 8. Implementation Order

**Wave 1: Media Preview**
1. `src/lib/media.ts` — media type helpers + blob URL management
2. `src/components/MediaPreviewModal.tsx` — image/video/pdf preview
3. Update `FileList.tsx` — click handler for media files

**Wave 2: Audio Player**
4. `src/stores/audio-store.ts` — player state management
5. `src/components/AudioPlayer.tsx` — persistent player UI
6. Update `App.tsx` — mount player in layout

**Wave 3: Sharing**
7. `src/types/index.ts` — add `ShareRecord`
8. `src/lib/db.ts` — add `shares` store (migration to v2)
9. `src/lib/sharing.ts` — encode/decode share links + password protection
10. `src/stores/share-store.ts` — share management state
11. `src/components/ShareModal.tsx` — share link generation UI
12. Update `App.tsx` — route handling for `/share/:id`

**Wave 4: Photo Timeline**
13. `src/components/PhotoTimeline.tsx` — chronological gallery
14. `src/components/LightboxModal.tsx` — full-screen viewer
15. Update `FileList.tsx` — add timeline/list view toggle

---

*Research completed: 2026-06-03*
