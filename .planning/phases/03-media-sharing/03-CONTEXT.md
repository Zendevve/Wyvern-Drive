# Phase 3: Media & Sharing - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers in-browser media preview, persistent audio playback, secure share links, and a photo timeline gallery. Users can preview images, play videos/audio directly in browser, share files with password-protected time-limited links, and browse photos chronologically.

</domain>

<decisions>
## Implementation Decisions

### Media Preview
- Images displayed inline via CDN URL with decrypt-on-load for encrypted files
- Videos play in-browser using native HTML5 video player
- Audio plays with custom player UI (not native controls)
- Media preview uses modal/overlay for full-size viewing

### Persistent Audio Player
- Audio player persists across navigation via global state
- Player bar fixed at bottom of screen
- Controls: play/pause, next/previous, progress bar, volume
- Playlist derived from current folder's audio files

### Secure Sharing
- Share links encode: file ID + encrypted key fragment + expiry timestamp
- Password protection via additional encryption layer
- Share links stored in IndexedDB with metadata
- Expiry checked client-side before allowing download

### Photo Timeline
- Chronological grid layout (Google Photos style)
- Group photos by date (day/week/month)
- Lazy loading for performance
- Lightbox for full-size viewing

### the agent's Discretion
- All remaining implementation choices at the agent's discretion

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/download.ts` — downloadFile function for fetching and decrypting
- `src/lib/discord.ts` — refreshCdnUrl for getting fresh CDN URLs
- `src/components/FileList.tsx` — file listing with media type detection
- `src/stores/file-store.ts` — files array with mimeType field
- `src/types/index.ts` — FileRecord with mimeType, size, createdAt fields

### Established Patterns
- Zustand for state management
- Web Worker for heavy operations
- Toast notifications for user feedback
- Modal/overlay patterns via Radix UI

### Integration Points
- FileRecord.mimeType determines media type (image/*, video/*, audio/*)
- FileRecord.cdnUrl or chunk CDN URLs for media streaming
- useAuthStore.derivedKey for decrypting media on load
- useFileStore.files for building playlists and timelines

</code_context>

<specifics>
## Specific Ideas

- Media preview uses blob URLs for decrypted content
- Audio player uses Howler.js or custom Web Audio API
- Share links format: `/share/{id}#{encrypted_key}`
- Photo timeline groups by `createdAt` date
- Lazy loading via Intersection Observer

</specifics>

<deferred>
## Deferred Ideas

- Offline media caching — v2
- Subtitle support — v2
- Collaborative playlists — v2
- Advanced photo editing — v2

</deferred>
