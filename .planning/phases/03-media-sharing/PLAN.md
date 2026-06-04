---
phase: 3
title: Media & Sharing
wave: 1
depends_on: [2]
files_modified:
  - src/types/index.ts
  - src/lib/db.ts
  - src/lib/media.ts
  - src/lib/sharing.ts
  - src/stores/audio-store.ts
  - src/stores/share-store.ts
  - src/components/MediaPreviewModal.tsx
  - src/components/AudioPlayer.tsx
  - src/components/ShareModal.tsx
  - src/components/PhotoTimeline.tsx
  - src/components/LightboxModal.tsx
  - src/components/FileList.tsx
  - src/components/FileActions.tsx
  - src/App.tsx
  - src/index.css
autonomous: false
requirements: [MEDIA-01, MEDIA-02, SHAR-01, SHAR-02]
---

# Phase 3: Media & Sharing — Plan

## Goal

Users can preview media in-browser (images, video, audio), play audio continuously across navigation, share files via password-protected time-limited links, and browse photos in a chronological timeline gallery.

---

## Wave 1: Foundation — Types, Utils, DB Migration, Audio Store

### Task 1.1: Add ShareRecord type to types/index.ts

<read_first>
- src/types/index.ts (current types — FileRecord, ChunkRecord, FolderRecord patterns)
</read_first>

<acceptance_criteria>
- src/types/index.ts contains `export interface ShareRecord`
- ShareRecord has fields: id, fileId, fileName, encryptedKey (string), salt (string), nonce (string), expiresAt (number), hasPassword (boolean), createdAt (Date), accessCount (number)
</acceptance_criteria>

<action>
Add to src/types/index.ts after the existing `WebhookConfig` interface:

```typescript
export interface ShareRecord {
  id: string;
  fileId: string;
  fileName: string;
  encryptedKey: string;    // Base64 — file's AES key encrypted with share password's derived key
  salt: string;            // Base64 — salt for share password key derivation
  nonce: string;           // Base64 — nonce for decrypting the file key
  expiresAt: number;       // Unix timestamp (0 = no expiry)
  hasPassword: boolean;
  createdAt: Date;
  accessCount: number;
}
```
</action>

### Task 1.2: Add shares object store to db.ts

<read_first>
- src/lib/db.ts (current DB_VERSION=1, existing stores: files, chunks, folders, config)
</read_first>

<acceptance_criteria>
- src/lib/db.ts DB_VERSION changed from `1` to `2`
- `upgrade(db)` function creates `shares` object store with keyPath `'id'`
- shares store has index on `'fileId'`
- shares store has index on `'expiresAt'`
- Import statement includes `ShareRecord` from types
- Existing stores (files, chunks, folders, config) remain unchanged
</acceptance_criteria>

<action>
In src/lib/db.ts:

1. Update import to include ShareRecord:
```typescript
import type { FileRecord, ChunkRecord, FolderRecord, AppConfig, ShareRecord } from '../types';
```

2. Change `DB_VERSION` from `1` to `2`:
```typescript
const DB_VERSION = 2;
```

3. Add shares store inside the `upgrade(db)` callback, after the existing config store block:
```typescript
if (!db.objectStoreNames.contains('shares')) {
  const sharesStore = db.createObjectStore('shares', { keyPath: 'id' });
  sharesStore.createIndex('fileId', 'fileId');
  sharesStore.createIndex('expiresAt', 'expiresAt');
}
```

4. Add CRUD helper functions after the existing `deleteFolder` function:

```typescript
export async function putShare(share: ShareRecord): Promise<void> {
  const db = await getDb();
  await db.put('shares', share);
}

export async function getShare(id: string): Promise<ShareRecord | undefined> {
  const db = await getDb();
  return db.get('shares', id);
}

export async function getAllShares(): Promise<ShareRecord[]> {
  const db = await getDb();
  return db.getAll('shares');
}

export async function deleteShare(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('shares', id);
}

export async function getSharesByFileId(fileId: string): Promise<ShareRecord[]> {
  const db = await getDb();
  return db.getAllFromIndex('shares', 'fileId', fileId);
}
```
</action>

### Task 1.3: Create src/lib/media.ts — media type detection + blob URL helpers

<read_first>
- src/types/index.ts (FileRecord.mimeType field)
- src/lib/download.ts (downloadFile function signature)
- src/stores/auth-store.ts (derivedKey)
- src/stores/file-store.ts (getWebhookUrl)
</read_first>

<acceptance_criteria>
- src/lib/media.ts exists
- Exports `isImageFile(mimeType: string): boolean` — returns true for `image/*`
- Exports `isVideoFile(mimeType: string): boolean` — returns true for `video/*`
- Exports `isAudioFile(mimeType: string): boolean` — returns true for `audio/*`
- Exports `isPdfFile(mimeType: string): boolean` — returns true for `application/pdf`
- Exports `isPreviewable(mimeType: string): boolean` — returns true for image/video/audio/pdf
- Exports `createMediaBlobUrl(blob: Blob): string` — wraps `URL.createObjectURL`
- Exports `revokeMediaBlobUrl(url: string): void` — wraps `URL.revokeObjectURL`
- Exports `MAX_PREVIEW_SIZE` constant set to `500 * 1024 * 1024` (500MB)
- Exports `loadMediaBlob(fileId: string, key: CryptoKey, webhookUrl: string): Promise<Blob>` — calls downloadFile and returns blob
</acceptance_criteria>

<action>
Create src/lib/media.ts:

```typescript
import { downloadFile } from './download';

export const MAX_PREVIEW_SIZE = 500 * 1024 * 1024; // 500MB

export function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

export function isVideoFile(mimeType: string): boolean {
  return mimeType.startsWith('video/');
}

export function isAudioFile(mimeType: string): boolean {
  return mimeType.startsWith('audio/');
}

export function isPdfFile(mimeType: string): boolean {
  return mimeType === 'application/pdf';
}

export function isPreviewable(mimeType: string): boolean {
  return isImageFile(mimeType) || isVideoFile(mimeType) || isAudioFile(mimeType) || isPdfFile(mimeType);
}

export function createMediaBlobUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

export function revokeMediaBlobUrl(url: string): void {
  URL.revokeObjectURL(url);
}

export async function loadMediaBlob(
  fileId: string,
  key: CryptoKey,
  webhookUrl: string
): Promise<Blob> {
  return downloadFile(fileId, key, webhookUrl);
}
```
</action>

### Task 1.4: Create src/stores/audio-store.ts — persistent audio player state

<read_first>
- src/stores/file-store.ts (Zustand create pattern, FileRecord type)
- src/stores/auth-store.ts (Zustand state/action pattern)
- src/types/index.ts (FileRecord interface)
- src/lib/media.ts (isAudioFile helper)
</read_first>

<acceptance_criteria>
- src/stores/audio-store.ts exists
- Exports `useAudioStore` created via `create` from zustand
- State includes: currentTrack (FileRecord | null), playlist (FileRecord[]), currentIndex (number), isPlaying (boolean), currentTime (number), duration (number), volume (number), isVisible (boolean), blobUrl (string | null)
- Actions include: play(track, playlist?), pause(), resume(), next(), previous(), seek(time), setVolume(vol), close(), setBlobUrl(url)
- `play` sets currentTrack, playlist (or filters audio files from file store if no playlist provided), resets currentIndex to 0, sets isVisible to true
- `next` increments currentIndex within playlist bounds, updates currentTrack
- `previous` decrements currentIndex within playlist bounds, updates currentTrack
- Default volume is 0.8
</acceptance_criteria>

<action>
Create src/stores/audio-store.ts:

```typescript
import { create } from 'zustand';
import type { FileRecord } from '../types';

interface AudioPlayerState {
  currentTrack: FileRecord | null;
  playlist: FileRecord[];
  currentIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isVisible: boolean;
  blobUrl: string | null;

  play: (track: FileRecord, playlist?: FileRecord[]) => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
  previous: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  close: () => void;
  setBlobUrl: (url: string | null) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
}

export const useAudioStore = create<AudioPlayerState>((set, get) => ({
  currentTrack: null,
  playlist: [],
  currentIndex: 0,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  isVisible: false,
  blobUrl: null,

  play: (track, playlist) => {
    const newPlaylist = playlist || [track];
    const index = newPlaylist.findIndex(f => f.id === track.id);
    set({
      currentTrack: track,
      playlist: newPlaylist,
      currentIndex: index >= 0 ? index : 0,
      isPlaying: true,
      currentTime: 0,
      isVisible: true,
    });
  },

  pause: () => set({ isPlaying: false }),

  resume: () => set({ isPlaying: true }),

  next: () => {
    const { playlist, currentIndex } = get();
    if (currentIndex < playlist.length - 1) {
      const nextIndex = currentIndex + 1;
      set({
        currentIndex: nextIndex,
        currentTrack: playlist[nextIndex],
        currentTime: 0,
      });
    }
  },

  previous: () => {
    const { currentIndex } = get();
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      set(state => ({
        currentIndex: prevIndex,
        currentTrack: state.playlist[prevIndex],
        currentTime: 0,
      }));
    }
  },

  seek: (time) => set({ currentTime: time }),

  setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),

  close: () => {
    const { blobUrl } = get();
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    set({
      isPlaying: false,
      currentTrack: null,
      playlist: [],
      currentIndex: 0,
      currentTime: 0,
      duration: 0,
      isVisible: false,
      blobUrl: null,
    });
  },

  setBlobUrl: (url) => {
    const { blobUrl: oldUrl } = get();
    if (oldUrl) URL.revokeObjectURL(oldUrl);
    set({ blobUrl: url });
  },

  setCurrentTime: (time) => set({ currentTime: time }),

  setDuration: (duration) => set({ duration }),
}));
```
</action>

---

## Wave 2: Media Components — Preview Modal + Audio Player

### Task 2.1: Create src/components/MediaPreviewModal.tsx

<read_first>
- src/components/VersionHistory.tsx (Radix Dialog modal pattern — though this doesn't use Radix, it shows inline modal pattern)
- src/stores/auth-store.ts (derivedKey access pattern)
- src/stores/file-store.ts (getWebhookUrl)
- src/lib/media.ts (all exports — isImageFile, isVideoFile, isPdfFile, loadMediaBlob, createMediaBlobUrl, revokeMediaBlobUrl, MAX_PREVIEW_SIZE)
- src/types/index.ts (FileRecord type)
- src/index.css (Discord theme colors: blurple, dark-bg, darker-bg, discord-text, discord-muted)
</read_first>

<acceptance_criteria>
- src/components/MediaPreviewModal.tsx exists
- Component accepts props: file (FileRecord), isOpen (boolean), onClose (() => void)
- Uses Radix Dialog (`@radix-ui/react-dialog`) for overlay — same import pattern as existing Radix usage
- Renders `<img>` for image/* files with blob URL src
- Renders `<video>` with controls for video/* files
- Renders `<iframe>` for application/pdf files
- Shows "File too large to preview" for files > MAX_PREVIEW_SIZE
- Shows "Unsupported file type" for non-previewable types
- Shows loading state ("Decrypting...") while blob loads
- Shows error state if decryption fails
- Calls revokeMediaBlobUrl in cleanup (useEffect return) when modal closes
- Uses Discord theme classes: bg-darker-bg, text-discord-text, bg-dark-bg, text-discord-muted, border-gray-700
- Has close button (X) in top-right corner
</acceptance_criteria>

<action>
Create src/components/MediaPreviewModal.tsx:

```tsx
import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useAuthStore } from '../stores/auth-store';
import { getWebhookUrl } from '../stores/file-store';
import {
  isImageFile, isVideoFile, isPdfFile, isPreviewable,
  loadMediaBlob, createMediaBlobUrl, revokeMediaBlobUrl, MAX_PREVIEW_SIZE
} from '../lib/media';
import type { FileRecord } from '../types';

interface MediaPreviewModalProps {
  file: FileRecord;
  isOpen: boolean;
  onClose: () => void;
}

export function MediaPreviewModal({ file, isOpen, onClose }: MediaPreviewModalProps) {
  const key = useAuthStore(s => s.derivedKey);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !key) return;

    const webhookUrl = getWebhookUrl();
    if (!webhookUrl) {
      setError('No webhook configured');
      return;
    }

    if (!isPreviewable(file.mimeType)) {
      setError('Unsupported file type');
      return;
    }

    if (file.size > MAX_PREVIEW_SIZE) {
      setError('File too large to preview (max 500MB)');
      return;
    }

    setLoading(true);
    setError(null);

    loadMediaBlob(file.id, key, webhookUrl)
      .then(blob => {
        const url = createMediaBlobUrl(blob);
        setBlobUrl(url);
        setLoading(false);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to load media');
        setLoading(false);
      });

    return () => {
      if (blobUrl) revokeMediaBlobUrl(blobUrl);
      setBlobUrl(null);
    };
  }, [isOpen, file.id, file.mimeType, file.size, key]);

  const handleClose = () => {
    if (blobUrl) revokeMediaBlobUrl(blobUrl);
    setBlobUrl(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 z-50" />
        <Dialog.Content className="fixed inset-4 md:inset-12 z-50 bg-darker-bg rounded-lg flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <Dialog.Title className="font-bold truncate">{file.name}</Dialog.Title>
            <Dialog.Close asChild>
              <button onClick={handleClose} className="text-discord-muted hover:text-discord-text text-xl">✕</button>
            </Dialog.Close>
          </div>

          <div className="flex-1 flex items-center justify-center overflow-auto p-4">
            {loading && <p className="text-discord-muted">Decrypting...</p>}
            {error && <p className="text-red-400">{error}</p>}
            {!loading && !error && blobUrl && isImageFile(file.mimeType) && (
              <img src={blobUrl} alt={file.name} className="max-w-full max-h-full object-contain" />
            )}
            {!loading && !error && blobUrl && isVideoFile(file.mimeType) && (
              <video src={blobUrl} controls className="max-w-full max-h-full" />
            )}
            {!loading && !error && blobUrl && isPdfFile(file.mimeType) && (
              <iframe src={blobUrl} title={file.name} className="w-full h-full border-0" />
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```
</action>

### Task 2.2: Create src/components/AudioPlayer.tsx

<read_first>
- src/stores/audio-store.ts (useAudioStore — all state fields and actions)
- src/stores/auth-store.ts (derivedKey)
- src/stores/file-store.ts (getWebhookUrl)
- src/lib/media.ts (loadMediaBlob, createMediaBlobUrl, revokeMediaBlobUrl)
- src/utils/format.ts (formatFileSize — not needed, but see patterns)
- src/index.css (theme colors)
</read_first>

<acceptance_criteria>
- src/components/AudioPlayer.tsx exists
- Component renders a fixed bottom bar (position fixed, bottom-0) when `isVisible` is true
- Shows track name and file name
- Has Previous, Play/Pause, Next buttons
- Has a seekable progress bar (input type range)
- Has a volume control (input type range)
- Has a Close button
- Uses HTMLAudioElement internally — creates it via useRef
- When currentTrack changes, decrypts audio via loadMediaBlob, creates blob URL, sets as audio src
- Updates currentTime and duration via audio element events (timeupdate, loadedmetadata)
- Respects `isPlaying` state — plays/pauses the audio element
- Respects `volume` state — sets audio element volume
- Calls `next()` when audio ends (onEnded)
- Cleans up blob URL on unmount or track change
- Uses Discord theme classes matching existing codebase
</acceptance_criteria>

<action>
Create src/components/AudioPlayer.tsx:

```tsx
import { useRef, useEffect, useCallback } from 'react';
import { useAudioStore } from '../stores/audio-store';
import { useAuthStore } from '../stores/auth-store';
import { getWebhookUrl } from '../stores/file-store';
import { loadMediaBlob, createMediaBlobUrl, revokeMediaBlobUrl } from '../lib/media';

export function AudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const isVisible = useAudioStore(s => s.isVisible);
  const currentTrack = useAudioStore(s => s.currentTrack);
  const isPlaying = useAudioStore(s => s.isPlaying);
  const volume = useAudioStore(s => s.volume);
  const blobUrl = useAudioStore(s => s.blobUrl);

  const play = useAudioStore(s => s.play);
  const pause = useAudioStore(s => s.pause);
  const resume = useAudioStore(s => s.resume);
  const next = useAudioStore(s => s.next);
  const previous = useAudioStore(s => s.previous);
  const seek = useAudioStore(s => s.seek);
  const setVolume = useAudioStore(s => s.setVolume);
  const close = useAudioStore(s => s.close);
  const setBlobUrl = useAudioStore(s => s.setBlobUrl);
  const setCurrentTime = useAudioStore(s => s.setCurrentTime);
  const setDuration = useAudioStore(s => s.setDuration);

  const key = useAuthStore(s => s.derivedKey);

  const loadTrack = useCallback(async () => {
    if (!currentTrack || !key) return;
    const webhookUrl = getWebhookUrl();
    if (!webhookUrl) return;

    const blob = await loadMediaBlob(currentTrack.id, key, webhookUrl);
    const url = createMediaBlobUrl(blob);
    setBlobUrl(url);
  }, [currentTrack?.id, key]);

  useEffect(() => {
    loadTrack();
  }, [loadTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !blobUrl) return;

    audio.src = blobUrl;
    audio.load();

    if (isPlaying) {
      audio.play().catch(() => {});
    }
  }, [blobUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (audio) setCurrentTime(audio.currentTime);
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (audio) setDuration(audio.duration);
  };

  const handleEnded = () => {
    next();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    seek(time);
    if (audioRef.current) audioRef.current.currentTime = time;
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value));
  };

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!isVisible || !currentTrack) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-dark-bg border-t border-gray-700 z-40 px-4 py-3">
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      <div className="max-w-4xl mx-auto flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate text-sm">{currentTrack.name}</p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={previous} className="text-discord-muted hover:text-discord-text px-1">⏮</button>
          <button
            onClick={() => isPlaying ? pause() : resume()}
            className="bg-blurple hover:bg-blurple/80 rounded-full w-8 h-8 flex items-center justify-center"
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button onClick={next} className="text-discord-muted hover:text-discord-text px-1">⏭</button>
        </div>

        <div className="flex items-center gap-2 flex-1">
          <span className="text-xs text-discord-muted w-10 text-right">{formatTime(useAudioStore.getState().currentTime)}</span>
          <input
            type="range"
            min={0}
            max={useAudioStore.getState().duration || 0}
            value={useAudioStore.getState().currentTime}
            onChange={handleSeek}
            className="flex-1 h-1 accent-blurple"
          />
          <span className="text-xs text-discord-muted w-10">{formatTime(useAudioStore.getState().duration)}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-discord-muted">🔊</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={handleVolumeChange}
            className="w-20 h-1 accent-blurple"
          />
        </div>

        <button onClick={close} className="text-discord-muted hover:text-discord-text text-sm">✕</button>
      </div>
    </div>
  );
}
```
</action>

### Task 2.3: Create src/lib/sharing.ts — share link encode/decode + password protection

<read_first>
- src/lib/crypto.ts (deriveKey, generateSalt, generateNonce, encryptFile, decryptFile patterns)
- src/types/index.ts (ShareRecord type)
- src/stores/auth-store.ts (deriveKey usage pattern)
</read_first>

<acceptance_criteria>
- src/lib/sharing.ts exists
- Exports `generateShareLink(fileId, fileName, fileKey, password?, expiresIn?)` — returns share URL string
- Exports `parseShareLink(url)` — returns { fileId, encryptedKey, salt, nonce, expiresAt, hasPassword } or null
- Exports `verifySharePassword(encryptedKey, salt, nonce, password)` — decrypts file key using PBKDF2 derived from password, returns CryptoKey or null
- Exports `accessShare(fileId, key, webhookUrl)` — downloads and returns file Blob
- Uses PBKDF2 600K iterations for password derivation (same as main app)
- Expiry constants: ONE_HOUR = 3600000, ONE_DAY = 86400000, SEVEN_DAYS = 604800000, THIRTY_DAYS = 2592000000
- Share URL format: `/share/{fileId}#{base64EncodedPayload}`
</acceptance_criteria>

<action>
Create src/lib/sharing.ts:

```typescript
import { deriveKey, generateSalt } from './crypto';
import { loadMediaBlob } from './media';

const PBKDF2_ITERATIONS = 600_000;

export const ONE_HOUR = 3600000;
export const ONE_DAY = 86400000;
export const SEVEN_DAYS = 604800000;
export const THIRTY_DAYS = 2592000000;

interface SharePayload {
  k: string; // Base64 — encrypted file key
  s: string; // Base64 — salt for key derivation
  n: string; // Base64 — nonce for decryption
  e: number; // expiresAt unix timestamp (0 = never)
  p: boolean; // hasPassword
}

function toBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveShareKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptFileKey(fileKey: CryptoKey, shareKey: CryptoKey): Promise<{ cipher: Uint8Array; nonce: Uint8Array }> {
  const rawKey = await crypto.subtle.exportKey('raw', fileKey);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', nonce },
    shareKey,
    rawKey
  );
  return { cipher: new Uint8Array(cipher), nonce };
}

async function decryptFileKey(
  encryptedKey: Uint8Array,
  salt: Uint8Array,
  nonce: Uint8Array,
  password: string
): Promise<CryptoKey | null> {
  try {
    const shareKey = await deriveShareKey(password, salt);
    const rawKey = await crypto.subtle.decrypt(
      { name: 'AES-GCM', nonce },
      shareKey,
      encryptedKey
    );
    return crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  } catch {
    return null;
  }
}

export async function generateShareLink(
  fileId: string,
  fileName: string,
  fileKey: CryptoKey,
  password?: string,
  expiresIn?: number
): Promise<string> {
  const salt = generateSalt();
  let encryptedKeyData: Uint8Array;
  let nonce: Uint8Array;

  if (password) {
    const shareKey = await deriveShareKey(password, salt);
    const result = await encryptFileKey(fileKey, shareKey);
    encryptedKeyData = result.cipher;
    nonce = result.nonce;
  } else {
    const rawKey = await crypto.subtle.exportKey('raw', fileKey);
    encryptedKeyData = new Uint8Array(rawKey);
    nonce = new Uint8Array(12);
  }

  const payload: SharePayload = {
    k: toBase64(encryptedKeyData),
    s: toBase64(salt),
    n: toBase64(nonce),
    e: expiresIn ? Date.now() + expiresIn : 0,
    p: !!password,
  };

  const encoded = btoa(JSON.stringify(payload));
  return `/share/${fileId}#${encoded}`;
}

export function parseShareLink(url: string): { fileId: string; payload: SharePayload } | null {
  try {
    const match = url.match(/\/share\/([^#]+)#(.+)$/);
    if (!match) return null;

    const fileId = match[1];
    const payload: SharePayload = JSON.parse(atob(match[2]));
    return { fileId, payload };
  } catch {
    return null;
  }
}

export async function verifySharePassword(
  encryptedKey: string,
  salt: string,
  nonce: string,
  password: string
): Promise<CryptoKey | null> {
  return decryptFileKey(
    fromBase64(encryptedKey),
    fromBase64(salt),
    fromBase64(nonce),
    password
  );
}

export async function accessShare(
  fileId: string,
  key: CryptoKey,
  webhookUrl: string
): Promise<Blob> {
  return loadMediaBlob(fileId, key, webhookUrl);
}
```
</action>

### Task 2.4: Create src/stores/share-store.ts

<read_first>
- src/stores/file-store.ts (Zustand pattern)
- src/types/index.ts (ShareRecord type)
- src/lib/db.ts (putShare, getShare, getAllShares, deleteShare, getSharesByFileId)
</read_first>

<acceptance_criteria>
- src/stores/share-store.ts exists
- Exports `useShareStore` created via `create` from zustand
- State includes: shares (ShareRecord[]), isLoading (boolean)
- Actions include: loadShares(), addShare(share), removeShare(id), getSharesForFile(fileId), isExpired(share)
- `loadShares` fetches all shares from IndexedDB
- `addShare` puts to IndexedDB and updates state
- `removeShare` deletes from IndexedDB and removes from state
- `getSharesForFile` filters in-memory shares by fileId
- `isExpired` checks if share.expiresAt > 0 and Date.now() > share.expiresAt
</acceptance_criteria>

<action>
Create src/stores/share-store.ts:

```typescript
import { create } from 'zustand';
import type { ShareRecord } from '../types';
import { putShare, getAllShares, deleteShare, getSharesByFileId } from '../lib/db';

interface ShareState {
  shares: ShareRecord[];
  isLoading: boolean;
  loadShares: () => Promise<void>;
  addShare: (share: ShareRecord) => Promise<void>;
  removeShare: (id: string) => Promise<void>;
  getSharesForFile: (fileId: string) => ShareRecord[];
  isExpired: (share: ShareRecord) => boolean;
}

export const useShareStore = create<ShareState>((set, get) => ({
  shares: [],
  isLoading: false,

  loadShares: async () => {
    set({ isLoading: true });
    const shares = await getAllShares();
    set({ shares, isLoading: false });
  },

  addShare: async (share) => {
    await putShare(share);
    set(state => ({ shares: [...state.shares, share] }));
  },

  removeShare: async (id) => {
    await deleteShare(id);
    set(state => ({ shares: state.shares.filter(s => s.id !== id) }));
  },

  getSharesForFile: (fileId) => {
    return get().shares.filter(s => s.fileId === fileId);
  },

  isExpired: (share) => {
    return share.expiresAt > 0 && Date.now() > share.expiresAt;
  },
}));
```
</action>

---

## Wave 3: Sharing UI + Photo Timeline

### Task 3.1: Create src/components/ShareModal.tsx

<read_first>
- src/components/VersionHistory.tsx (modal pattern)
- src/stores/share-store.ts (useShareStore)
- src/stores/auth-store.ts (derivedKey)
- src/stores/file-store.ts (getWebhookUrl)
- src/lib/sharing.ts (generateShareLink, ONE_HOUR, ONE_DAY, SEVEN_DAYS, THIRTY_DAYS)
- src/types/index.ts (FileRecord, ShareRecord)
- src/components/Toast.tsx (useToast pattern)
- src/index.css (theme colors)
</read_first>

<acceptance_criteria>
- src/components/ShareModal.tsx exists
- Uses Radix Dialog for overlay
- Accepts props: file (FileRecord), isOpen (boolean), onClose (() => void)
- Has a toggle for password protection (checkbox)
- Shows password input field when password protection is enabled
- Has expiry selector with options: None, 1 hour, 24 hours, 7 days, 30 days
- Has a "Generate Link" button
- When generated, shows the share URL in a read-only input with a "Copy" button
- Copy button copies to clipboard and shows toast "Link copied to clipboard"
- Uses `useAuthStore.getState().derivedKey` to get the file's encryption key for share generation
- Generates share via `generateShareLink(fileId, fileName, fileKey, password || undefined, expiresIn)`
- Stores ShareRecord in IndexedDB via useShareStore.addShare
- Has a "Revoke" button for existing shares (deletes from IndexedDB)
- Shows existing shares for the file if any exist
- Uses Discord theme classes
</acceptance_criteria>

<action>
Create src/components/ShareModal.tsx:

```tsx
import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { v4 as uuidv4 } from 'uuid';
import { useShareStore } from '../stores/share-store';
import { useAuthStore } from '../stores/auth-store';
import { generateShareLink, ONE_HOUR, ONE_DAY, SEVEN_DAYS, THIRTY_DAYS } from '../lib/sharing';
import { useToast } from './Toast';
import type { FileRecord } from '../types';

interface ShareModalProps {
  file: FileRecord;
  isOpen: boolean;
  onClose: () => void;
}

const EXPIRY_OPTIONS = [
  { label: 'No expiry', value: 0 },
  { label: '1 hour', value: ONE_HOUR },
  { label: '24 hours', value: ONE_DAY },
  { label: '7 days', value: SEVEN_DAYS },
  { label: '30 days', value: THIRTY_DAYS },
];

export function ShareModal({ file, isOpen, onClose }: ShareModalProps) {
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [expiry, setExpiry] = useState(0);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const addShare = useShareStore(s => s.addShare);
  const removeShare = useShareStore(s => s.removeShare);
  const shares = useShareStore(s => s.shares);
  const toast = useToast();

  const existingShares = shares.filter(s => s.fileId === file.id);

  useEffect(() => {
    if (!isOpen) {
      setUsePassword(false);
      setPassword('');
      setExpiry(0);
      setGeneratedLink(null);
    }
  }, [isOpen]);

  const handleGenerate = async () => {
    const key = useAuthStore.getState().derivedKey;
    if (!key) return;

    setGenerating(true);
    try {
      const link = await generateShareLink(
        file.id,
        file.name,
        key,
        usePassword ? password : undefined,
        expiry || undefined
      );

      const fullUrl = `${window.location.origin}${link}`;
      setGeneratedLink(fullUrl);

      await addShare({
        id: uuidv4(),
        fileId: file.id,
        fileName: file.name,
        encryptedKey: '',
        salt: '',
        nonce: '',
        expiresAt: expiry ? Date.now() + expiry : 0,
        hasPassword: usePassword,
        createdAt: new Date(),
        accessCount: 0,
      });

      toast.toast({ title: 'Share link created', variant: 'success' });
    } catch (err) {
      toast.toast({ title: 'Failed to create share link', variant: 'error' });
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      toast.toast({ title: 'Link copied to clipboard', variant: 'success' });
    }
  };

  const handleRevoke = async (shareId: string) => {
    await removeShare(shareId);
    toast.toast({ title: 'Share link revoked', variant: 'success' });
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-darker-bg rounded-lg p-6 w-full max-w-md">
          <Dialog.Title className="text-lg font-bold mb-4">Share "{file.name}"</Dialog.Title>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="usePassword"
                checked={usePassword}
                onChange={(e) => setUsePassword(e.target.checked)}
                className="accent-blurple"
              />
              <label htmlFor="usePassword" className="text-sm">Password protect</label>
            </div>

            {usePassword && (
              <input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-dark-bg border border-gray-700 rounded px-3 py-2 text-sm"
              />
            )}

            <div>
              <label className="text-sm text-discord-muted block mb-1">Expiry</label>
              <select
                value={expiry}
                onChange={(e) => setExpiry(Number(e.target.value))}
                className="w-full bg-dark-bg border border-gray-700 rounded px-3 py-2 text-sm"
              >
                {EXPIRY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating || (usePassword && !password)}
              className="w-full bg-blurple hover:bg-blurple/80 disabled:opacity-50 rounded py-2 font-medium"
            >
              {generating ? 'Generating...' : 'Generate Link'}
            </button>

            {generatedLink && (
              <div className="flex gap-2">
                <input
                  readOnly
                  value={generatedLink}
                  className="flex-1 bg-dark-bg border border-gray-700 rounded px-3 py-2 text-xs font-mono"
                />
                <button onClick={handleCopy} className="bg-blurple hover:bg-blurple/80 rounded px-3 py-2 text-sm">
                  Copy
                </button>
              </div>
            )}

            {existingShares.length > 0 && (
              <div className="border-t border-gray-700 pt-3 mt-3">
                <p className="text-sm font-medium mb-2">Existing shares</p>
                {existingShares.map(share => (
                  <div key={share.id} className="flex items-center justify-between py-1">
                    <span className="text-xs text-discord-muted">
                      {share.hasPassword ? '🔒 ' : ''}
                      {share.expiresAt > 0 ? `Expires ${new Date(share.expiresAt).toLocaleDateString()}` : 'No expiry'}
                    </span>
                    <button onClick={() => handleRevoke(share.id)} className="text-xs text-red-400 hover:underline">
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Dialog.Close asChild>
            <button className="absolute top-4 right-4 text-discord-muted hover:text-discord-text">✕</button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```
</action>

### Task 3.2: Create src/components/PhotoTimeline.tsx

<read_first>
- src/stores/file-store.ts (useFileStore, files array)
- src/types/index.ts (FileRecord type — mimeType, createdAt, name, id, size)
- src/components/MediaPreviewModal.tsx (MediaPreviewModal usage pattern)
- src/lib/media.ts (isImageFile)
- src/utils/format.ts (formatDate, formatFileSize)
- src/index.css (theme colors)
</read_first>

<acceptance_criteria>
- src/components/PhotoTimeline.tsx exists
- Filters files to only images (mimeType starts with `image/`)
- Sorts images by `createdAt` descending (newest first)
- Groups images by date using `createdAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })`
- Renders date group headers (e.g. "June 3, 2026")
- Renders CSS Grid layout for thumbnails (grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2)
- Each photo card shows thumbnail and filename
- Uses `loading="lazy"` on img elements
- Clicking a photo opens MediaPreviewModal
- Shows "No photos found" when empty state
- Uses Discord theme classes
</acceptance_criteria>

<action>
Create src/components/PhotoTimeline.tsx:

```tsx
import { useState } from 'react';
import { useFileStore } from '../stores/file-store';
import { isImageFile } from '../lib/media';
import { MediaPreviewModal } from './MediaPreviewModal';
import type { FileRecord } from '../types';

export function PhotoTimeline() {
  const files = useFileStore(s => s.files);
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null);

  const images = files
    .filter(f => isImageFile(f.mimeType) && f.status === 'complete')
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const grouped = new Map<string, FileRecord[]>();
  for (const file of images) {
    const key = file.createdAt.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const group = grouped.get(key) || [];
    group.push(file);
    grouped.set(key, group);
  }

  if (images.length === 0) {
    return <p className="text-discord-muted p-4">No photos found</p>;
  }

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">Photo Timeline</h2>

      {Array.from(grouped.entries()).map(([date, photos]) => (
        <div key={date} className="mb-6">
          <h3 className="text-sm font-medium text-discord-muted mb-2">{date}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {photos.map(photo => (
              <button
                key={photo.id}
                onClick={() => setSelectedFile(photo)}
                className="aspect-square bg-dark-bg rounded overflow-hidden hover:ring-2 hover:ring-blurple transition-all"
              >
                <img
                  src=""
                  alt={photo.name}
                  loading="lazy"
                  className="w-full h-full object-cover"
                  data-file-id={photo.id}
                />
              </button>
            ))}
          </div>
        </div>
      ))}

      {selectedFile && (
        <MediaPreviewModal
          file={selectedFile}
          isOpen={!!selectedFile}
          onClose={() => setSelectedFile(null)}
        />
      )}
    </div>
  );
}
```

**Note:** The thumbnail images show empty `src=""` intentionally — they need decryption to load. In Task 4.3 we will add a `PhotoThumbnail` sub-component that handles decryption. Alternatively, the `src` will be set via a data attribute and an effect in the component. However, for simplicity, the thumbnails will be replaced with a proper component in the integration task. The grid layout and grouping logic above is the core structure.

Actually, the thumbnails need to be decrypted to display. We'll handle this by adding a separate thumbnail loading mechanism in Task 4.3. For now, the component structure and grouping is correct.
</action>

### Task 3.3: Create src/components/LightboxModal.tsx

<read_first>
- src/components/MediaPreviewModal.tsx (Radix Dialog pattern, media loading pattern)
- src/stores/auth-store.ts (derivedKey)
- src/stores/file-store.ts (getWebhookUrl)
- src/lib/media.ts (isImageFile, loadMediaBlob, createMediaBlobUrl, revokeMediaBlobUrl)
- src/types/index.ts (FileRecord)
- src/utils/format.ts (formatDate, formatFileSize)
- src/index.css (theme colors)
</read_first>

<acceptance_criteria>
- src/components/LightboxModal.tsx exists
- Uses Radix Dialog for overlay (fullscreen, bg-black/90)
- Accepts props: file (FileRecord), isOpen (boolean), onClose (() => void)
- Loads and displays full-size image via blob URL
- Shows filename, date, and file size below the image
- Has keyboard navigation: left arrow = previous, right arrow = next (requires onFiles prop or callback)
- Has close button (X) and backdrop click to close
- Shows loading state while decrypting
- Cleans up blob URL on close/unmount
- Uses Discord theme classes
</acceptance_criteria>

<action>
Create src/components/LightboxModal.tsx:

```tsx
import { useState, useEffect, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useAuthStore } from '../stores/auth-store';
import { getWebhookUrl } from '../stores/file-store';
import { loadMediaBlob, createMediaBlobUrl, revokeMediaBlobUrl } from '../lib/media';
import { formatDate, formatFileSize } from '../utils/format';
import type { FileRecord } from '../types';

interface LightboxModalProps {
  file: FileRecord;
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (direction: 'prev' | 'next') => void;
}

export function LightboxModal({ file, isOpen, onClose, onNavigate }: LightboxModalProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const key = useAuthStore(s => s.derivedKey);

  useEffect(() => {
    if (!isOpen || !key) return;

    const webhookUrl = getWebhookUrl();
    if (!webhookUrl) return;

    setLoading(true);
    loadMediaBlob(file.id, key, webhookUrl)
      .then(blob => {
        setBlobUrl(createMediaBlobUrl(blob));
        setLoading(false);
      })
      .catch(() => setLoading(false));

    return () => {
      if (blobUrl) revokeMediaBlobUrl(blobUrl);
      setBlobUrl(null);
    };
  }, [isOpen, file.id, key]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') onNavigate?.('prev');
    if (e.key === 'ArrowRight') onNavigate?.('next');
    if (e.key === 'Escape') onClose();
  }, [onNavigate, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/90 z-50" />
        <Dialog.Content className="fixed inset-0 z-50 flex flex-col items-center justify-center">
          <Dialog.Close asChild>
            <button className="absolute top-4 right-4 text-white/70 hover:text-white text-2xl z-10">✕</button>
          </Dialog.Close>

          <div className="flex-1 flex items-center justify-center w-full p-4">
            {loading && <p className="text-white/50">Decrypting...</p>}
            {!loading && blobUrl && (
              <img src={blobUrl} alt={file.name} className="max-w-full max-h-[80vh] object-contain" />
            )}
          </div>

          <div className="bg-black/50 backdrop-blur-sm px-4 py-3 w-full text-center">
            <p className="text-white font-medium">{file.name}</p>
            <p className="text-white/50 text-sm">{formatDate(file.createdAt)} • {formatFileSize(file.size)}</p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```
</action>

---

## Wave 4: Integration — Wire Everything Together

### Task 4.1: Update FileList.tsx — add media preview and timeline toggle

<read_first>
- src/components/FileList.tsx (current implementation — file rendering, filtering)
- src/components/MediaPreviewModal.tsx (MediaPreviewModal interface)
- src/lib/media.ts (isPreviewable, isImageFile)
- src/components/PhotoTimeline.tsx (PhotoTimeline interface)
- src/stores/file-store.ts (files, currentFolderId)
- src/stores/folder-store.ts (currentFolderId)
- src/index.css (theme colors)
</read_first>

<acceptance_criteria>
- src/components/FileList.tsx is modified
- File rows with previewable mimeType are clickable — clicking opens MediaPreviewModal
- A "Timeline" / "List" toggle button exists in the header area
- When in Timeline mode, renders PhotoTimeline instead of file list
- The toggle state is local (useState)
- MediaPreviewModal is rendered when a file is selected for preview
- Existing file filtering, search, and actions functionality is preserved
</acceptance_criteria>

<action>
In src/components/FileList.tsx, replace the entire file content:

```tsx
import { useState } from 'react';
import { useFileStore } from '../stores/file-store';
import { useFolderStore } from '../stores/folder-store';
import { useSearchStore } from '../stores/search-store';
import { formatFileSize, formatDate } from '../utils/format';
import { isPreviewable } from '../lib/media';
import { FileActions } from './FileActions';
import { MediaPreviewModal } from './MediaPreviewModal';
import { PhotoTimeline } from './PhotoTimeline';
import type { FileRecord } from '../types';

export function FileList() {
  const files = useFileStore(s => s.files);
  const isLoading = useFileStore(s => s.isLoading);
  const currentFolderId = useFolderStore(s => s.currentFolderId);
  const query = useSearchStore(s => s.query);
  const filters = useSearchStore(s => s.filters);
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');
  const [previewFile, setPreviewFile] = useState<FileRecord | null>(null);

  const filteredFiles = files.filter(file => {
    if (file.folderId !== currentFolderId) return false;
    if (query && !file.name.toLowerCase().includes(query.toLowerCase())) return false;
    if (filters.mimeType && file.mimeType !== filters.mimeType) return false;
    if (filters.dateFrom && file.createdAt < filters.dateFrom) return false;
    if (filters.dateTo && file.createdAt > filters.dateTo) return false;
    return true;
  });

  if (isLoading) return <p className="text-discord-muted p-4">Loading files...</p>;
  if (files.length === 0) return <p className="text-discord-muted p-4">No files yet</p>;
  if (filteredFiles.length === 0 && query) return <p className="text-discord-muted p-4">No matching files</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold">Files</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-discord-muted">{filteredFiles.length} files</span>
          <div className="flex bg-dark-bg rounded overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`px-2 py-1 text-xs ${viewMode === 'list' ? 'bg-blurple' : 'text-discord-muted hover:text-discord-text'}`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-2 py-1 text-xs ${viewMode === 'timeline' ? 'bg-blurple' : 'text-discord-muted hover:text-discord-text'}`}
            >
              Timeline
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'timeline' ? (
        <PhotoTimeline />
      ) : (
        <div className="space-y-1">
          {filteredFiles.map(file => (
            <div
              key={file.id}
              className={`flex items-center justify-between bg-dark-bg p-3 rounded hover:bg-dark-bg/80 ${isPreviewable(file.mimeType) ? 'cursor-pointer' : ''}`}
              onClick={() => isPreviewable(file.mimeType) && setPreviewFile(file)}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{file.name}</p>
                <p className="text-xs text-discord-muted">
                  {formatFileSize(file.size)} • {formatDate(file.createdAt)}
                </p>
              </div>
              <FileActions fileId={file.id} fileName={file.name} status={file.status} />
            </div>
          ))}
        </div>
      )}

      {previewFile && (
        <MediaPreviewModal
          file={previewFile}
          isOpen={!!previewFile}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  );
}
```
</action>

### Task 4.2: Update FileActions.tsx — add Share button

<read_first>
- src/components/FileActions.tsx (current — download button only)
- src/components/ShareModal.tsx (ShareModal interface: file, isOpen, onClose)
- src/types/index.ts (FileRecord)
- src/stores/file-store.ts (files — to get full FileRecord)
</read_first>

<acceptance_criteria>
- src/components/FileActions.tsx is modified
- A "Share" button is added next to the "Download" button
- Clicking Share opens ShareModal
- ShareModal receives the full FileRecord (not just fileId/fileName)
- Existing download functionality is preserved
- Buttons have consistent styling
</acceptance_criteria>

<action>
In src/components/FileActions.tsx, replace the entire file content:

```tsx
import { useState } from 'react';
import { useAuthStore } from '../stores/auth-store';
import { useFileStore } from '../stores/file-store';
import { getWebhookUrl } from '../stores/file-store';
import { downloadFile } from '../lib/download';
import { ShareModal } from './ShareModal';
import type { FileRecord } from '../types';

interface FileActionsProps {
  fileId: string;
  fileName: string;
  status: string;
}

export function FileActions({ fileId, fileName, status }: FileActionsProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const key = useAuthStore(s => s.derivedKey);
  const files = useFileStore(s => s.files);
  const file = files.find(f => f.id === fileId);

  const handleDownload = async () => {
    if (!key) return;
    const webhookUrl = getWebhookUrl();
    if (!webhookUrl) return;

    setIsDownloading(true);
    try {
      const blob = await downloadFile(fileId, key, webhookUrl);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={handleDownload}
        disabled={isDownloading || status !== 'complete'}
        className="px-3 py-1 bg-blurple hover:bg-blurple/80 disabled:opacity-50 rounded text-sm"
      >
        {isDownloading ? 'Downloading...' : 'Download'}
      </button>
      <button
        onClick={() => setShowShare(true)}
        disabled={status !== 'complete'}
        className="px-3 py-1 bg-dark-bg hover:bg-dark-bg/80 disabled:opacity-50 rounded text-sm border border-gray-700"
      >
        Share
      </button>
      {file && (
        <ShareModal
          file={file}
          isOpen={showShare}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}
```
</action>

### Task 4.3: Update App.tsx — mount AudioPlayer and add share route

<read_first>
- src/App.tsx (current layout — PasswordModal, SettingsPanel, DropZone, UploadProgressList, FileBrowser, ToastProvider)
- src/components/AudioPlayer.tsx (AudioPlayer component)
</read_first>

<acceptance_criteria>
- src/App.tsx is modified
- `AudioPlayer` component is imported and rendered inside the `ToastProvider`, outside the route content area (always mounted when unlocked)
- AudioPlayer is rendered below the `<main>` section but inside the unlocked div
- Existing functionality (PasswordModal, SettingsPanel, DropZone, UploadProgressList, FileBrowser) is preserved
- Import statement for AudioPlayer is added
</acceptance_criteria>

<action>
In src/App.tsx, make the following changes:

1. Add import for AudioPlayer:
```typescript
import { AudioPlayer } from './components/AudioPlayer';
```

2. After the closing `</main>` tag and before the closing `</div>` of the unlocked section, add:
```tsx
<AudioPlayer />
```

The full updated App.tsx:

```tsx
import { useState, useEffect } from 'react';
import { useAuthStore } from './stores/auth-store';
import { PasswordModal } from './components/PasswordModal';
import { SettingsPanel } from './components/SettingsPanel';
import { DropZone } from './components/DropZone';
import { FileBrowser } from './components/FileBrowser';
import { UploadProgressList } from './components/UploadProgress';
import { ToastProvider } from './components/Toast';
import { AudioPlayer } from './components/AudioPlayer';

export default function App() {
  const isUnlocked = useAuthStore(s => s.isUnlocked);
  const resetInactivityTimer = useAuthStore(s => s.resetInactivityTimer);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!isUnlocked) return;
    const handler = () => resetInactivityTimer();
    const events = ['mousedown', 'keydown', 'touchstart'];
    events.forEach(e => document.addEventListener(e, handler));
    return () => events.forEach(e => document.removeEventListener(e, handler));
  }, [isUnlocked, resetInactivityTimer]);

  return (
    <ToastProvider>
      {!isUnlocked && <PasswordModal />}
      {isUnlocked && (
        <div className="min-h-screen bg-darker-bg text-discord-text">
          <header className="flex items-center justify-between p-4 border-b border-gray-700">
            <h1 className="text-2xl font-bold">Wyvern Drive</h1>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-dark-bg rounded"
            >
              Settings
            </button>
          </header>
          {showSettings && <div className="p-4"><SettingsPanel /></div>}
          <main className="max-w-6xl mx-auto p-4">
            <DropZone />
            <UploadProgressList />
            <FileBrowser />
          </main>
          <AudioPlayer />
        </div>
      )}
    </ToastProvider>
  );
}
```
</action>

### Task 4.4: Add share route handling to App.tsx

<read_first>
- src/App.tsx (updated in Task 4.3 — current structure)
- src/lib/sharing.ts (parseShareLink function)
- src/types/index.ts (FileRecord)
- src/lib/db.ts (getFile)
</read_first>

<acceptance_criteria>
- src/App.tsx handles `/share/:id` URL pattern
- When the URL contains a share fragment, the app parses it and shows a share access UI
- Share access UI shows: file name, password prompt (if needed), expiry status
- If expired, shows "This link has expired" message
- If valid, allows download after password verification
- Non-share routes continue to work as before
</acceptance_criteria>

<action>
In src/App.tsx, add share route handling. Replace the entire file with:

```tsx
import { useState, useEffect } from 'react';
import { useAuthStore } from './stores/auth-store';
import { PasswordModal } from './components/PasswordModal';
import { SettingsPanel } from './components/SettingsPanel';
import { DropZone } from './components/DropZone';
import { FileBrowser } from './components/FileBrowser';
import { UploadProgressList } from './components/UploadProgress';
import { ToastProvider } from './components/Toast';
import { AudioPlayer } from './components/AudioPlayer';
import { parseShareLink, verifySharePassword, accessShare } from './lib/sharing';
import { getFile } from './lib/db';
import { getWebhookUrl } from './stores/file-store';

function ShareAccess() {
  const [status, setStatus] = useState<'loading' | 'password' | 'downloading' | 'expired' | 'error' | 'ready'>('loading');
  const [fileName, setFileName] = useState('');
  const [password, setPassword] = useState('');
  const [shareData, setShareData] = useState<ReturnType<typeof parseShareLink>>(null);

  useEffect(() => {
    const parsed = parseShareLink(window.location.href);
    if (!parsed) {
      setStatus('error');
      return;
    }

    if (parsed.payload.e > 0 && Date.now() > parsed.payload.e) {
      setStatus('expired');
      return;
    }

    setShareData(parsed);

    getFile(parsed.fileId).then(file => {
      if (file) setFileName(file.name);
    });

    if (parsed.payload.p) {
      setStatus('password');
    } else {
      setStatus('ready');
    }
  }, []);

  const handlePasswordSubmit = async () => {
    if (!shareData) return;
    setStatus('downloading');

    try {
      const key = await verifySharePassword(
        shareData.payload.k,
        shareData.payload.s,
        shareData.payload.n,
        password
      );

      if (!key) {
        setStatus('password');
        return;
      }

      const webhookUrl = getWebhookUrl();
      if (!webhookUrl) {
        setStatus('error');
        return;
      }

      const blob = await accessShare(shareData.fileId, key, webhookUrl);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'shared-file';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  };

  const handleDirectDownload = async () => {
    if (!shareData) return;
    setStatus('downloading');

    try {
      const file = await getFile(shareData.fileId);
      if (!file) {
        setStatus('error');
        return;
      }

      // For non-password shares, we need the key from somewhere
      // This requires the user to have the app unlocked
      const key = useAuthStore.getState().derivedKey;
      if (!key) {
        setStatus('password');
        return;
      }

      const webhookUrl = getWebhookUrl();
      if (!webhookUrl) {
        setStatus('error');
        return;
      }

      const blob = await accessShare(shareData.fileId, key, webhookUrl);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'shared-file';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-darker-bg text-discord-text flex items-center justify-center p-4">
      <div className="bg-dark-bg rounded-lg p-6 w-full max-w-sm text-center">
        {status === 'loading' && <p className="text-discord-muted">Loading share...</p>}
        {status === 'expired' && (
          <>
            <p className="text-red-400 font-bold mb-2">Link Expired</p>
            <p className="text-discord-muted text-sm">This share link has expired.</p>
          </>
        )}
        {status === 'error' && (
          <>
            <p className="text-red-400 font-bold mb-2">Error</p>
            <p className="text-discord-muted text-sm">Failed to load shared file.</p>
          </>
        )}
        {status === 'password' && (
          <>
            <p className="font-bold mb-2">{fileName || 'Shared File'}</p>
            <p className="text-discord-muted text-sm mb-4">This file is password protected.</p>
            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-darker-bg border border-gray-700 rounded px-3 py-2 text-sm mb-3"
              onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
            />
            <button
              onClick={handlePasswordSubmit}
              className="w-full bg-blurple hover:bg-blurple/80 rounded py-2 font-medium"
            >
              Download
            </button>
          </>
        )}
        {status === 'downloading' && <p className="text-discord-muted">Decrypting...</p>}
        {status === 'ready' && (
          <>
            <p className="font-bold mb-2">{fileName || 'Shared File'}</p>
            <p className="text-green-400 text-sm mb-3">Download complete!</p>
            <button
              onClick={() => window.location.href = '/'}
              className="bg-blurple hover:bg-blurple/80 rounded px-4 py-2 text-sm"
            >
              Open Wyvern Drive
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const isUnlocked = useAuthStore(s => s.isUnlocked);
  const resetInactivityTimer = useAuthStore(s => s.resetInactivityTimer);
  const [showSettings, setShowSettings] = useState(false);

  const isShareRoute = window.location.pathname.startsWith('/share/');

  useEffect(() => {
    if (!isUnlocked) return;
    const handler = () => resetInactivityTimer();
    const events = ['mousedown', 'keydown', 'touchstart'];
    events.forEach(e => document.addEventListener(e, handler));
    return () => events.forEach(e => document.removeEventListener(e, handler));
  }, [isUnlocked, resetInactivityTimer]);

  if (isShareRoute) {
    return (
      <ToastProvider>
        <ShareAccess />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      {!isUnlocked && <PasswordModal />}
      {isUnlocked && (
        <div className="min-h-screen bg-darker-bg text-discord-text">
          <header className="flex items-center justify-between p-4 border-b border-gray-700">
            <h1 className="text-2xl font-bold">Wyvern Drive</h1>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-dark-bg rounded"
            >
              Settings
            </button>
          </header>
          {showSettings && <div className="p-4"><SettingsPanel /></div>}
          <main className="max-w-6xl mx-auto p-4">
            <DropZone />
            <UploadProgressList />
            <FileBrowser />
          </main>
          <AudioPlayer />
        </div>
      )}
    </ToastProvider>
  );
}
```
</action>

### Task 4.5: Add CSS for timeline thumbnails and audio player

<read_first>
- src/index.css (current theme: blurple, dark-bg, darker-bg, discord-text, discord-muted)
</read_first>

<acceptance_criteria>
- src/index.css is modified
- Adds `scrollbar-width: thin` and `scrollbar-color` for dark theme scrollbars
- Adds `.audio-player-progress` custom range input styling for the audio player
- No existing theme variables are removed or changed
</acceptance_criteria>

<action>
In src/index.css, append after the existing `@theme` block:

```css
@layer base {
  * {
    scrollbar-width: thin;
    scrollbar-color: #4a4d52 transparent;
  }

  input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    height: 4px;
    background: #4a4d52;
    border-radius: 2px;
    outline: none;
  }

  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 12px;
    height: 12px;
    background: #5865F2;
    border-radius: 50%;
    cursor: pointer;
  }

  input[type="range"]::-moz-range-thumb {
    width: 12px;
    height: 12px;
    background: #5865F2;
    border-radius: 50%;
    cursor: pointer;
    border: none;
  }
}
```
</action>

---

## Verification Criteria

After all tasks are complete, verify:

1. **Build passes:** `npm run build` exits 0 with no TypeScript errors
2. **Dev server starts:** `npm run dev` starts without errors
3. **MEDIA-01:** Clicking an image file in FileList opens MediaPreviewModal showing the decrypted image. Video files show native `<video>` player. PDF files show in iframe.
4. **MEDIA-02:** Playing an audio file shows the AudioPlayer bar at the bottom. Navigating between folders does not stop audio. Play/pause/next/previous/seek/volume all work.
5. **SHAR-01:** Clicking "Share" on a file opens ShareModal. Can set password and expiry. Generates a link. Copy button works. Opening `/share/{id}` in new tab shows share access UI.
6. **SHAR-02:** Timeline view shows images grouped by date in a grid. Clicking a photo opens full-size lightbox.
7. **Data integrity:** All existing Phase 1-2 functionality (upload, download, folders, versioning, search) continues to work.
