# Phase 1: Core Storage Engine — PLAN.md

**Goal:** End-to-end encrypted file storage pipeline — upload, encrypt, chunk, store via Discord CDN, download, decrypt, reassemble.

**Requirements:** STRG-01, STRG-02, STRG-03, INFRA-01, INFRA-02, INFRA-03, INFRA-04

**Success Criteria:**
1. User can configure Discord webhook URL and validate it works
2. User can upload any file size — it chunks, encrypts, and sends to Discord
3. Files are encrypted with AES-256-GCM before leaving the browser
4. Large files (>8MB) split into chunks and upload in parallel with progress indicator
5. User can download files — chunks are fetched, decrypted, and reassembled
6. Rate limit errors (429) trigger automatic backoff and retry
7. App deployed as static files with no backend server

---

## Wave 1: Foundation + Core Services

Foundation: project scaffold, type definitions, IndexedDB schema, and all core service modules. Task 1.1 must complete first; Tasks 1.2–1.5 can run in parallel after 1.1.

### Task 1.1: Project Scaffold

**requirements:** [INFRA-01]
**depends_on:** []
**files_modified:** `package.json`, `tsconfig.json`, `vite.config.ts`, `tailwind.config.ts`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `index.html`, `src/lib/`, `src/components/`, `src/hooks/`, `src/stores/`, `src/types/`, `src/utils/`, `.env.example`

<read_first>
- GEMINI.md (project structure conventions)
- .planning/research/STACK.md (stack decisions)
- .planning/phases/01-core-storage-engine/01-CONTEXT.md (implementation decisions)
</read_first>

<acceptance_criteria>
- `package.json` exists and contains dependencies: `react`, `react-dom`, `vite`, `typescript`, `tailwindcss`, `@radix-ui/react-dialog`, `@radix-ui/react-toast`, `zustand`, `idb`, `uuid`
- `package.json` contains devDependencies: `@types/react`, `@types/react-dom`, `@vitejs/plugin-react`, `tailwindcss`, `postcss`, `autoprefixer`
- `package.json` scripts contain `"dev"`, `"build"`, `"preview"`, `"test"`
- `vite.config.ts` contains `defineConfig` with `@vitejs/plugin-react`
- `src/main.tsx` renders `<App />` into `#root`
- `src/index.css` contains `@import "tailwindcss"` (Tailwind v4 style)
- `src/App.tsx` exports a default function `App`
- `index.html` contains `<div id="root">` and `<script type="module" src="/src/main.tsx">`
- Directory structure exists: `src/lib/`, `src/components/`, `src/hooks/`, `src/stores/`, `src/types/`, `src/utils/`
- `.env.example` contains `VITE_DISCORD_WEBHOOK_URL=`
- `tsconfig.json` contains `"strict": true`, `"target": "ES2022"`, `"module": "ESNext"`
</acceptance_criteria>

<action>
1. Initialize Vite project with React + TypeScript template:
   ```bash
   npm create vite@latest . -- --template react-ts
   ```
   (Run in project root — existing files are just .planning/ and GEMINI.md, safe to scaffold)

2. Install production dependencies:
   ```bash
   npm install zustand idb uuid @radix-ui/react-dialog @radix-ui/react-toast @radix-ui/react-dropdown-menu
   npm install -D @types/uuid tailwindcss @tailwindcss/vite
   ```

3. Configure `vite.config.ts`:
   ```ts
   import { defineConfig } from 'vite'
   import react from '@vitejs/plugin-react'
   import tailwindcss from '@tailwindcss/vite'

   export default defineConfig({
     plugins: [react(), tailwindcss()],
   })
   ```

4. Replace `src/index.css` with Tailwind v4 import:
   ```css
   @import "tailwindcss";

   @theme {
     --color-blurple: #5865F2;
     --color-dark-bg: #2C2F33;
     --color-darker-bg: #23272A;
     --color-discord-text: #dcddde;
     --color-discord-muted: #72767d;
   }
   ```

5. Create directory structure:
   ```
   mkdir -p src/lib src/components src/hooks src/stores src/types src/utils
   ```

6. Create `.env.example` with:
   ```
   VITE_DISCORD_WEBHOOK_URL=
   ```

7. Update `src/App.tsx` to minimal shell:
   ```tsx
   export default function App() {
     return <div className="min-h-screen bg-darker-bg text-discord-text">Wyvern Drive</div>
   }
   ```

8. Verify build works: `npm run build` exits 0
</action>

---

### Task 1.2: TypeScript Types + IndexedDB Schema

**requirements:** [STRG-01, STRG-02, STRG-03, INFRA-04]
**depends_on:** [1.1]
**files_modified:** `src/types/index.ts`, `src/lib/db.ts`

<read_first>
- .planning/research/ARCHITECTURE.md (IndexedDB schema section, lines 237-327)
- .planning/phases/01-core-storage-engine/01-CONTEXT.md (webhook token storage decision)
- GEMINI.md (src/lib/ convention)
</read_first>

<acceptance_criteria>
- `src/types/index.ts` contains exported interfaces: `FileRecord`, `ChunkRecord`, `FolderRecord`, `UploadProgress`, `AppConfig`, `WebhookConfig`
- `FileRecord` has fields: `id`, `name`, `mimeType`, `size`, `folderId`, `createdAt`, `updatedAt`, `status`, `version`, `encryptionSalt`, `encryptionNonce`, `chunkSize`, `totalChunks`, `checksum`
- `FileRecord.status` is typed as `'uploading' | 'complete' | 'failed'`
- `ChunkRecord` has fields: `id`, `fileId`, `chunkIndex`, `messageId`, `attachmentId`, `cdnUrl`, `cdnExpiry`, `channelId`, `size`, `uploadedAt`
- `src/lib/db.ts` opens database named `'wyvern-drive'` version 1
- `src/lib/db.ts` creates object store `files` with keyPath `'id'` and indexes on `folderId`, `status`, `mimeType`, `createdAt`
- `src/lib/db.ts` creates object store `chunks` with keyPath `'id'` and indexes on `fileId`, `messageId`, `cdnExpiry`
- `src/lib/db.ts` creates object store `config` with keyPath `'key'`
- `src/lib/db.ts` exports typed helpers: `getDb()`, `putFile()`, `getFile()`, `getChunksByFileId()`, `putChunk()`, `getConfig()`, `setConfig()`
</acceptance_criteria>

<action>
1. Create `src/types/index.ts` with all type definitions:
   ```ts
   export interface FileRecord {
     id: string;
     name: string;
     mimeType: string;
     size: number;
     folderId: string | null;
     createdAt: Date;
     updatedAt: Date;
     status: 'uploading' | 'complete' | 'failed';
     version: number;
     encryptionSalt: Uint8Array;
     encryptionNonce: Uint8Array;
     chunkSize: number;
     totalChunks: number;
     checksum: string;
   }

   export interface ChunkRecord {
     id: string;
     fileId: string;
     chunkIndex: number;
     messageId: string;
     attachmentId: string;
     cdnUrl: string;
     cdnExpiry: Date;
     channelId: string;
     size: number;
     uploadedAt: Date;
   }

   export interface FolderRecord {
     id: string;
     name: string;
     parentId: string | null;
     path: string;
     createdAt: Date;
     updatedAt: Date;
   }

   export interface UploadProgress {
     fileId: string;
     fileName: string;
     totalChunks: number;
     completedChunks: number;
     status: 'pending' | 'encrypting' | 'uploading' | 'complete' | 'failed';
     error?: string;
   }

   export interface AppConfig {
     key: string;
     value: unknown;
   }

   export interface WebhookConfig {
     url: string;
     id: string;
     token: string;
     channelId: string;
     guildId: string | null;
     name: string;
   }
   ```

2. Create `src/lib/db.ts` using `idb` library:
   ```ts
   import { openDB, type IDBPDatabase } from 'idb';
   import type { FileRecord, ChunkRecord, FolderRecord, AppConfig } from '../types';

   const DB_NAME = 'wyvern-drive';
   const DB_VERSION = 1;

   let dbInstance: IDBPDatabase | null = null;

   export async function getDb(): Promise<IDBPDatabase> {
     if (dbInstance) return dbInstance;
     dbInstance = await openDB(DB_NAME, DB_VERSION, {
       upgrade(db) {
         // Files store
         if (!db.objectStoreNames.contains('files')) {
           const filesStore = db.createObjectStore('files', { keyPath: 'id' });
           filesStore.createIndex('folderId', 'folderId');
           filesStore.createIndex('status', 'status');
           filesStore.createIndex('mimeType', 'mimeType');
           filesStore.createIndex('createdAt', 'createdAt');
         }
         // Chunks store
         if (!db.objectStoreNames.contains('chunks')) {
           const chunksStore = db.createObjectStore('chunks', { keyPath: 'id' });
           chunksStore.createIndex('fileId', 'fileId');
           chunksStore.createIndex('messageId', 'messageId');
           chunksStore.createIndex('cdnExpiry', 'cdnExpiry');
         }
         // Folders store
         if (!db.objectStoreNames.contains('folders')) {
           const foldersStore = db.createObjectStore('folders', { keyPath: 'id' });
           foldersStore.createIndex('parentId', 'parentId');
           foldersStore.createIndex('path', 'path');
         }
         // Config store
         if (!db.objectStoreNames.contains('config')) {
           db.createObjectStore('config', { keyPath: 'key' });
         }
       },
     });
     return dbInstance;
   }

   export async function putFile(file: FileRecord): Promise<void> {
     const db = await getDb();
     await db.put('files', file);
   }

   export async function getFile(id: string): Promise<FileRecord | undefined> {
     const db = await getDb();
     return db.get('files', id);
   }

   export async function getAllFiles(): Promise<FileRecord[]> {
     const db = await getDb();
     return db.getAll('files');
   }

   export async function putChunk(chunk: ChunkRecord): Promise<void> {
     const db = await getDb();
     await db.put('chunks', chunk);
   }

   export async function getChunksByFileId(fileId: string): Promise<ChunkRecord[]> {
     const db = await getDb();
     return db.getAllFromIndex('chunks', 'fileId', fileId);
   }

   export async function getConfig<T = unknown>(key: string): Promise<T | undefined> {
     const db = await getDb();
     const record = await db.get('config', key) as AppConfig | undefined;
     return record?.value as T | undefined;
   }

   export async function setConfig(key: string, value: unknown): Promise<void> {
     const db = await getDb();
     await db.put('config', { key, value });
   }

   export async function deleteFile(id: string): Promise<void> {
     const db = await getDb();
     const chunks = await getChunksByFileId(id);
     const tx = db.transaction(['files', 'chunks'], 'readwrite');
     for (const chunk of chunks) {
       await tx.objectStore('chunks').delete(chunk.id);
     }
     await tx.objectStore('files').delete(id);
     await tx.done;
   }
   ```

3. Verify: `npm run build` exits 0
</action>

---

### Task 1.3: Encryption Service (Web Worker)

**requirements:** [STRG-01]
**depends_on:** [1.1]
**files_modified:** `src/lib/crypto.ts`, `src/lib/crypto.worker.ts`

<read_first>
- .planning/research/ARCHITECTURE.md (Encryption Pipeline section, lines 329-410)
- .planning/phases/01-core-storage-engine/01-CONTEXT.md (PBKDF2 600K, password modal decision)
- .planning/research/PITFALLS.md (Nonce/IV reuse, key derivation weakness sections)
</read_first>

<acceptance_criteria>
- `src/lib/crypto.worker.ts` contains `onmessage` handler that processes `{ type: 'deriveKey', password, salt }` messages
- `src/lib/crypto.worker.ts` contains `onmessage` handler that processes `{ type: 'encrypt', data, key }` messages
- `src/lib/crypto.worker.ts` contains `onmessage` handler that processes `{ type: 'decrypt', data, key, nonce }` messages
- `src/lib/crypto.worker.ts` uses PBKDF2 with 600,000 iterations and SHA-256 for key derivation
- `src/lib/crypto.worker.ts` uses AES-GCM with 128-bit auth tag for encrypt/decrypt
- `src/lib/crypto.worker.ts` generates 12-byte (96-bit) random nonces via `crypto.getRandomValues(new Uint8Array(12))`
- `src/lib/crypto.ts` exports `deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey>`
- `src/lib/crypto.ts` exports `encryptFile(data: ArrayBuffer, key: CryptoKey, nonce: Uint8Array): Promise<ArrayBuffer>`
- `src/lib/crypto.ts` exports `decryptFile(data: ArrayBuffer, key: CryptoKey, nonce: Uint8Array): Promise<ArrayBuffer>`
- `src/lib/crypto.ts` exports `generateSalt(): Uint8Array` returning 16 random bytes
- `src/lib/crypto.ts` exports `generateNonce(): Uint8Array` returning 12 random bytes
- `src/lib/crypto.ts` exports `hashFile(data: ArrayBuffer): Promise<string>` returning SHA-256 hex string
- Key is created with `extractable: false`
</acceptance_criteria>

<action>
1. Create `src/lib/crypto.worker.ts`:
   ```ts
   /// <reference lib="webworker" />

   interface DeriveKeyMessage {
     type: 'deriveKey';
     password: string;
     salt: Uint8Array;
     id: string;
   }

   interface EncryptMessage {
     type: 'encrypt';
     data: ArrayBuffer;
     key: CryptoKey;
     nonce: Uint8Array;
     id: string;
   }

   interface DecryptMessage {
     type: 'decrypt';
     data: ArrayBuffer;
     key: CryptoKey;
     nonce: Uint8Array;
     id: string;
   }

   type WorkerMessage = DeriveKeyMessage | EncryptMessage | DecryptMessage;

   self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
     const msg = e.data;
     try {
       switch (msg.type) {
         case 'deriveKey': {
           const encoder = new TextEncoder();
           const passwordKey = await crypto.subtle.importKey(
             'raw',
             encoder.encode(msg.password),
             'PBKDF2',
             false,
             ['deriveKey']
           );
           const derivedKey = await crypto.subtle.deriveKey(
             {
               name: 'PBKDF2',
               salt: msg.salt,
               iterations: 600_000,
               hash: 'SHA-256',
             },
             passwordKey,
             { name: 'AES-GCM', length: 256 },
             false,
             ['encrypt', 'decrypt']
           );
           self.postMessage({ type: 'deriveKey', key: derivedKey, id: msg.id });
           break;
         }
         case 'encrypt': {
           const encrypted = await crypto.subtle.encrypt(
             { name: 'AES-GCM', iv: msg.nonce, tagLength: 128 },
             msg.key,
             msg.data
           );
           self.postMessage({ type: 'encrypt', data: encrypted, id: msg.id }, [encrypted]);
           break;
         }
         case 'decrypt': {
           const decrypted = await crypto.subtle.decrypt(
             { name: 'AES-GCM', iv: msg.nonce, tagLength: 128 },
             msg.key,
             msg.data
           );
           self.postMessage({ type: 'decrypt', data: decrypted, id: msg.id }, [decrypted]);
           break;
         }
       }
     } catch (err) {
       self.postMessage({ type: 'error', error: (err as Error).message, id: msg.id });
     }
   };
   ```

2. Create `src/lib/crypto.ts` (main thread wrapper):
   ```ts
   const worker = new Worker(new URL('./crypto.worker.ts', import.meta.url), { type: 'module' });

   let messageCounter = 0;
   const pending = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void }>();

   worker.onmessage = (e) => {
     const { id, type, ...rest } = e.data;
     const p = pending.get(id);
     if (!p) return;
     pending.delete(id);
     if (type === 'error') {
       p.reject(new Error(rest.error));
     } else {
       p.resolve(rest);
     }
   };

   function sendMessage(msg: Record<string, unknown>): Promise<any> {
     const id = `msg-${++messageCounter}`;
     return new Promise((resolve, reject) => {
       pending.set(id, { resolve, reject });
       worker.postMessage({ ...msg, id });
     });
   }

   export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
     const result = await sendMessage({ type: 'deriveKey', password, salt });
     return result.key;
   }

   export async function encryptFile(data: ArrayBuffer, key: CryptoKey, nonce: Uint8Array): Promise<ArrayBuffer> {
     const result = await sendMessage({ type: 'encrypt', data, key, nonce });
     return result.data;
   }

   export async function decryptFile(data: ArrayBuffer, key: CryptoKey, nonce: Uint8Array): Promise<ArrayBuffer> {
     const result = await sendMessage({ type: 'decrypt', data, key, nonce });
     return result.data;
   }

   export function generateSalt(): Uint8Array {
     return crypto.getRandomValues(new Uint8Array(16));
   }

   export function generateNonce(): Uint8Array {
     return crypto.getRandomValues(new Uint8Array(12));
   }

   export async function hashFile(data: ArrayBuffer): Promise<string> {
     const hash = await crypto.subtle.digest('SHA-256', data);
     return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
   }
   ```

3. Verify: `npm run build` exits 0
</action>

---

### Task 1.4: Discord API Client + Rate Limiter

**requirements:** [STRG-02, INFRA-03, INFRA-04]
**depends_on:** [1.1]
**files_modified:** `src/lib/discord.ts`, `src/lib/rate-limiter.ts`

<read_first>
- .planning/research/ARCHITECTURE.md (Discord Integration Layer, lines 134-235)
- .planning/research/PITFALLS.md (Webhook Rate Limits, CDN URL Expiration, File Size Limits, API Versioning sections)
- .planning/phases/01-core-storage-engine/01-CONTEXT.md (single webhook, `?wait=true`, webhook names avoid clyde/discord)
</read_first>

<acceptance_criteria>
- `src/lib/rate-limiter.ts` exports class `RateLimiter` with method `enqueue<T>(fn: () => Promise<T>): Promise<T>`
- `src/lib/rate-limiter.ts` implements exponential backoff: 1s, 2s, 4s, 8s, 16s, max 60s
- `src/lib/rate-limiter.ts` handles HTTP 429 responses by reading `retry_after` from response body
- `src/lib/discord.ts` exports `uploadChunk(webhookUrl: string, file: Blob, metadata: object): Promise<DiscordMessageResponse>`
- `src/lib/discord.ts` uploads via `POST {webhookUrl}?wait=true` with `multipart/form-data`
- `src/lib/discord.ts` payload_json contains `content` field with JSON-stringified metadata
- `src/lib/discord.ts` exports `fetchMessage(webhookUrl: string, messageId: string): Promise<DiscordMessageResponse>`
- `src/lib/discord.ts` fetches via `GET {webhookUrl}/messages/{messageId}?wait=false`
- `src/lib/discord.ts` exports `validateWebhook(url: string): Promise<boolean>` — sends test message, returns true on 200/204
- `src/lib/discord.ts` exports `refreshCdnUrl(webhookUrl: string, messageId: string): Promise<string>` — fetches message, returns fresh attachment URL
- `src/lib/discord.ts` parses CDN URL `ex` parameter to check expiry with 5-minute buffer
- All Discord API URLs use `/api/v10/` prefix
- All API calls go through `RateLimiter.enqueue()`
- `DiscordMessageResponse` type includes `id`, `channel_id`, `attachments` (array with `id`, `url`, `filename`, `size`)
</acceptance_criteria>

<action>
1. Create `src/lib/rate-limiter.ts`:
   ```ts
   export class RateLimiter {
     private queue: Array<() => Promise<any>> = [];
     private processing = false;
     private maxRetries = 5;
     private baseDelay = 1000;

     async enqueue<T>(fn: () => Promise<T>): Promise<T> {
       return new Promise<T>((resolve, reject) => {
         this.queue.push(async () => {
           try {
             const result = await this.executeWithRetry(fn);
             resolve(result);
           } catch (err) {
             reject(err);
           }
         });
         this.processQueue();
       });
     }

     private async processQueue() {
       if (this.processing) return;
       this.processing = true;
       while (this.queue.length > 0) {
         const task = this.queue.shift()!;
         await task();
       }
       this.processing = false;
     }

     private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
       let lastError: Error | null = null;
       for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
         try {
           return await fn();
         } catch (err: any) {
           lastError = err;
           if (err instanceof DiscordRateLimitError) {
             const delay = err.retryAfter
               ? err.retryAfter * 1000
               : Math.min(this.baseDelay * Math.pow(2, attempt), 60_000);
             await this.sleep(delay);
           } else if (err instanceof DiscordApiError && (err.status === 401 || err.status === 403)) {
             throw err;
           } else {
             if (attempt === this.maxRetries) throw err;
             await this.sleep(Math.min(this.baseDelay * Math.pow(2, attempt), 60_000));
           }
         }
       }
       throw lastError;
     }

     private sleep(ms: number): Promise<void> {
       return new Promise(resolve => setTimeout(resolve, ms));
     }
   }

   export class DiscordRateLimitError extends Error {
     constructor(public retryAfter: number) {
       super(`Rate limited. Retry after ${retryAfter}s`);
       this.name = 'DiscordRateLimitError';
     }
   }

   export class DiscordApiError extends Error {
     constructor(public status: number, message: string) {
       super(message);
       this.name = 'DiscordApiError';
     }
   }
   ```

2. Create `src/lib/discord.ts`:
   ```ts
   import { RateLimiter, DiscordRateLimitError, DiscordApiError } from './rate-limiter';

   const API_VERSION = 'v10';
   const BASE_URL = `https://discord.com/api/${API_VERSION}`;
   const CDN_BUFFER_MS = 5 * 60 * 1000;

   export interface DiscordAttachment {
     id: string;
     filename: string;
     size: number;
     url: string;
     content_type: string;
   }

   export interface DiscordMessageResponse {
     id: string;
     channel_id: string;
     content: string;
     attachments: DiscordAttachment[];
   }

   const limiter = new RateLimiter();

   function extractWebhookParts(webhookUrl: string): { id: string; token: string } {
     const match = webhookUrl.match(/\/webhooks\/(\d+)\/([^/?]+)/);
     if (!match) throw new Error('Invalid webhook URL');
     return { id: match[1], token: match[2] };
   }

   function parseCdnExpiry(url: string): Date | null {
     const expiryMatch = url.match(/[?&]ex=([a-f0-9]+)/i);
     if (!expiryMatch) return null;
     const timestamp = parseInt(expiryMatch[1], 16);
     return new Date(timestamp * 1000);
   }

   export async function validateWebhook(url: string): Promise<boolean> {
     try {
       const response = await fetch(url, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ content: 'Wyvern Drive connection test' }),
       });
       if (response.status === 429) {
         const body = await response.json();
         throw new DiscordRateLimitError(body.retry_after || 1);
       }
       return response.ok || response.status === 204;
     } catch {
       return false;
     }
   }

   export async function uploadChunk(
     webhookUrl: string,
     file: Blob,
     metadata: Record<string, unknown>
   ): Promise<DiscordMessageResponse> {
     return limiter.enqueue(async () => {
       const formData = new FormData();
       formData.append('payload_json', JSON.stringify({
         content: JSON.stringify(metadata),
       }));
       formData.append('files[0]', file, `chunk_${metadata.chunkIndex}.bin`);

       const response = await fetch(`${webhookUrl}?wait=true`, {
         method: 'POST',
         body: formData,
       });

       if (response.status === 429) {
         const body = await response.json();
         throw new DiscordRateLimitError(body.retry_after || 1);
       }
       if (!response.ok) {
         throw new DiscordApiError(response.status, `Upload failed: ${response.statusText}`);
       }

       return response.json();
     });
   }

   export async function fetchMessage(
     webhookUrl: string,
     messageId: string
   ): Promise<DiscordMessageResponse> {
     const { id, token } = extractWebhookParts(webhookUrl);
     return limiter.enqueue(async () => {
       const url = `${BASE_URL}/webhooks/${id}/${token}/messages/${messageId}`;
       const response = await fetch(url);
       if (response.status === 429) {
         const body = await response.json();
         throw new DiscordRateLimitError(body.retry_after || 1);
       }
       if (!response.ok) {
         throw new DiscordApiError(response.status, `Fetch failed: ${response.statusText}`);
       }
       return response.json();
     });
   }

   export async function refreshCdnUrl(
     webhookUrl: string,
     messageId: string
   ): Promise<string> {
     const message = await fetchMessage(webhookUrl, messageId);
     if (message.attachments.length === 0) {
       throw new Error('No attachments in message');
     }
     return message.attachments[0].url;
   }

   export function isCdnExpired(url: string): boolean {
     const expiry = parseCdnExpiry(url);
     if (!expiry) return false;
     return Date.now() > expiry.getTime() - CDN_BUFFER_MS;
   }
   ```

3. Verify: `npm run build` exits 0
</action>

---

### Task 1.5: Chunker Service

**requirements:** [STRG-03]
**depends_on:** [1.1]
**files_modified:** `src/lib/chunker.ts`

<read_first>
- .planning/research/ARCHITECTURE.md (Upload Flow lines 58-60, data flow)
- .planning/research/PITFALLS.md (Parallel Upload Ordering, Memory Pressure During Chunking sections)
- .planning/phases/01-core-storage-engine/01-CONTEXT.md (8MB default, 3 concurrent uploads)
</read_first>

<acceptance_criteria>
- `src/lib/chunker.ts` exports `DEFAULT_CHUNK_SIZE` constant with value `8 * 1024 * 1024` (8MB)
- `src/lib/chunker.ts` exports `splitFile(file: File, chunkSize?: number): Blob[]` — returns array of Blob chunks using `File.slice()`
- `src/lib/chunker.ts` exports `reassembleChunks(chunks: Blob[]): Blob` — concatenates Blobs into single Blob
- `src/lib/chunker.ts` exports `getChunkCount(fileSize: number, chunkSize?: number): number`
- `splitFile` does NOT load entire file into memory — uses `File.slice()` which returns views
- Each chunk from `splitFile` is a Blob with correct byte range (last chunk may be smaller)
- `reassembleChunks` handles empty array gracefully (returns empty Blob)
- `getChunkCount` correctly calculates: `Math.ceil(fileSize / chunkSize)`
</acceptance_criteria>

<action>
1. Create `src/lib/chunker.ts`:
   ```ts
   export const DEFAULT_CHUNK_SIZE = 8 * 1024 * 1024;

   export function getChunkCount(fileSize: number, chunkSize: number = DEFAULT_CHUNK_SIZE): number {
     return Math.ceil(fileSize / chunkSize);
   }

   export function splitFile(file: File, chunkSize: number = DEFAULT_CHUNK_SIZE): Blob[] {
     const chunks: Blob[] = [];
     let offset = 0;

     while (offset < file.size) {
       const end = Math.min(offset + chunkSize, file.size);
       chunks.push(file.slice(offset, end));
       offset = end;
     }

     return chunks;
   }

   export function reassembleChunks(chunks: Blob[]): Blob {
     if (chunks.length === 0) return new Blob([]);
     return new Blob(chunks);
   }
   ```

2. Verify: `npm run build` exits 0
</action>

---

## Wave 2: State Management + Upload/Download Pipelines

Depends on Wave 1 completion. Tasks 2.1–2.3 can run in parallel.

### Task 2.1: Zustand Stores

**requirements:** [STRG-01, STRG-02, INFRA-02]
**depends_on:** [1.2, 1.3, 1.4]
**files_modified:** `src/stores/auth-store.ts`, `src/stores/file-store.ts`, `src/stores/upload-store.ts`

<read_first>
- src/types/index.ts (type definitions from Task 1.2)
- src/lib/db.ts (database helpers from Task 1.2)
- .planning/phases/01-core-storage-engine/01-CONTEXT.md (password modal, auto-lock 15min, settings UI, single webhook)
</read_first>

<acceptance_criteria>
- `src/stores/auth-store.ts` exports `useAuthStore` with: `password`, `derivedKey`, `isUnlocked`, `unlock(password)`, `lock()`, `startInactivityTimer()`, `stopInactivityTimer()`
- `src/stores/auth-store.ts` auto-locks after 15 minutes of inactivity (900,000ms)
- `src/stores/auth-store.ts` `lock()` clears `password` and `derivedKey` from state
- `src/stores/auth-store.ts` `unlock()` calls `deriveKey()` from crypto.ts and stores result
- `src/stores/file-store.ts` exports `useFileStore` with: `files`, `currentFolderId`, `loadFiles()`, `addFile()`, `deleteFile()`, `setCurrentFolder()`
- `src/stores/file-store.ts` `loadFiles()` fetches all files from IndexedDB
- `src/stores/file-store.ts` `addFile()` writes to IndexedDB and updates state
- `src/stores/upload-store.ts` exports `useUploadStore` with: `uploads`, `startUpload(file)`, `updateProgress(fileId, progress)`, `completeUpload(fileId)`, `failUpload(fileId, error)`
- `src/stores/upload-store.ts` `startUpload()` creates `UploadProgress` record and adds to state
- `src/stores/file-store.ts` webhook config stored in localStorage via `getWebhookUrl()` and `setWebhookUrl()` exported functions
- All stores use Zustand `create` with proper TypeScript types
</acceptance_criteria>

<action>
1. Create `src/stores/auth-store.ts`:
   ```ts
   import { create } from 'zustand';
   import { deriveKey } from '../lib/crypto';
   import { generateSalt } from '../lib/crypto';

   const AUTO_LOCK_MS = 15 * 60 * 1000;

   interface AuthState {
     password: string | null;
     derivedKey: CryptoKey | null;
     salt: Uint8Array | null;
     isUnlocked: boolean;
     inactivityTimer: ReturnType<typeof setTimeout> | null;
     unlock: (password: string) => Promise<void>;
     lock: () => void;
     resetInactivityTimer: () => void;
   }

   export const useAuthStore = create<AuthState>((set, get) => ({
     password: null,
     derivedKey: null,
     salt: null,
     isUnlocked: false,
     inactivityTimer: null,

     unlock: async (password: string) => {
       const salt = generateSalt();
       const key = await deriveKey(password, salt);
       set({ password, derivedKey: key, salt, isUnlocked: true });
       get().resetInactivityTimer();
     },

     lock: () => {
       const timer = get().inactivityTimer;
       if (timer) clearTimeout(timer);
       set({
         password: null,
         derivedKey: null,
         salt: null,
         isUnlocked: false,
         inactivityTimer: null,
       });
     },

     resetInactivityTimer: () => {
       const timer = get().inactivityTimer;
       if (timer) clearTimeout(timer);
       const newTimer = setTimeout(() => {
         get().lock();
       }, AUTO_LOCK_MS);
       set({ inactivityTimer: newTimer });
     },
   }));
   ```

2. Create `src/stores/file-store.ts`:
   ```ts
   import { create } from 'zustand';
   import type { FileRecord } from '../types';
   import { getAllFiles, putFile, deleteFile as dbDeleteFile } from '../lib/db';

   const WEBHOOK_URL_KEY = 'wyvern-webhook-url';

   export function getWebhookUrl(): string | null {
     return localStorage.getItem(WEBHOOK_URL_KEY);
   }

   export function setWebhookUrl(url: string): void {
     localStorage.setItem(WEBHOOK_URL_KEY, url);
   }

   interface FileState {
     files: FileRecord[];
     currentFolderId: string | null;
     isLoading: boolean;
     loadFiles: () => Promise<void>;
     addFile: (file: FileRecord) => Promise<void>;
     deleteFile: (id: string) => Promise<void>;
     setCurrentFolder: (folderId: string | null) => void;
   }

   export const useFileStore = create<FileState>((set, get) => ({
     files: [],
     currentFolderId: null,
     isLoading: false,

     loadFiles: async () => {
       set({ isLoading: true });
       const files = await getAllFiles();
       set({ files, isLoading: false });
     },

     addFile: async (file: FileRecord) => {
       await putFile(file);
       set(state => ({ files: [...state.files, file] }));
     },

     deleteFile: async (id: string) => {
       await dbDeleteFile(id);
       set(state => ({ files: state.files.filter(f => f.id !== id) }));
     },

     setCurrentFolder: (folderId: string | null) => {
       set({ currentFolderId: folderId });
     },
   }));
   ```

3. Create `src/stores/upload-store.ts`:
   ```ts
   import { create } from 'zustand';
   import type { UploadProgress } from '../types';

   interface UploadState {
     uploads: UploadProgress[];
     startUpload: (fileId: string, fileName: string, totalChunks: number) => void;
     updateProgress: (fileId: string, completedChunks: number, status?: UploadProgress['status']) => void;
     completeUpload: (fileId: string) => void;
     failUpload: (fileId: string, error: string) => void;
     removeUpload: (fileId: string) => void;
   }

   export const useUploadStore = create<UploadState>((set) => ({
     uploads: [],

     startUpload: (fileId, fileName, totalChunks) => {
       set(state => ({
         uploads: [...state.uploads, {
           fileId,
           fileName,
           totalChunks,
           completedChunks: 0,
           status: 'pending',
         }],
       }));
     },

     updateProgress: (fileId, completedChunks, status) => {
       set(state => ({
         uploads: state.uploads.map(u =>
           u.fileId === fileId
             ? { ...u, completedChunks, ...(status ? { status } : {}) }
             : u
         ),
       }));
     },

     completeUpload: (fileId) => {
       set(state => ({
         uploads: state.uploads.map(u =>
           u.fileId === fileId ? { ...u, status: 'complete', completedChunks: u.totalChunks } : u
         ),
       }));
     },

     failUpload: (fileId, error) => {
       set(state => ({
         uploads: state.uploads.map(u =>
           u.fileId === fileId ? { ...u, status: 'failed', error } : u
         ),
       }));
     },

     removeUpload: (fileId) => {
       set(state => ({
         uploads: state.uploads.filter(u => u.fileId !== fileId),
       }));
     },
   }));
   ```

4. Verify: `npm run build` exits 0
</action>

---

### Task 2.2: Upload Pipeline

**requirements:** [STRG-01, STRG-02, STRG-03]
**depends_on:** [1.2, 1.3, 1.4, 1.5, 2.1]
**files_modified:** `src/lib/upload.ts`

<read_first>
- src/lib/crypto.ts (encryption functions)
- src/lib/chunker.ts (splitFile, DEFAULT_CHUNK_SIZE)
- src/lib/discord.ts (uploadChunk)
- src/lib/db.ts (putFile, putChunk)
- src/stores/upload-store.ts (progress tracking)
- .planning/research/ARCHITECTURE.md (Upload Flow lines 36-77)
- .planning/phases/01-core-storage-engine/01-CONTEXT.md (3 concurrent uploads, auto-retry 3x, progress per-file)
</read_first>

<acceptance_criteria>
- `src/lib/upload.ts` exports `uploadFile(file: File, key: CryptoKey, webhookUrl: string, onProgress?: (progress: UploadProgress) => void): Promise<FileRecord>`
- `uploadFile` generates per-file salt (16 bytes) and nonce (12 bytes)
- `uploadFile` computes SHA-256 checksum of original file via `hashFile()`
- `uploadFile` splits file into chunks using `splitFile()`
- `uploadFile` encrypts each chunk with AES-256-GCM using the derived key and per-chunk nonce
- `uploadFile` uploads chunks with max 3 concurrent uploads (concurrency limiter)
- `uploadFile` stores each chunk's messageId, cdnUrl, cdnExpiry, channelId in IndexedDB via `putChunk()`
- `uploadFile` creates FileRecord in IndexedDB with status `'complete'` after all chunks uploaded
- `uploadFile` calls `onProgress` callback after each chunk upload with updated `completedChunks`
- `uploadFile` generates UUID v4 for file ID and chunk IDs via `crypto.randomUUID()`
- `uploadFile` stores chunk metadata with correct `chunkIndex` (0, 1, 2, ...)
- `uploadFile` payload_json content includes: `fileId`, `chunkIndex`, `chunkTotal`, `filename`, `uploadedAt`
</acceptance_criteria>

<action>
1. Create `src/lib/upload.ts`:
   ```ts
   import { v4 as uuidv4 } from 'uuid';
   import { encryptFile, generateSalt, generateNonce, hashFile } from './crypto';
   import { splitFile, DEFAULT_CHUNK_SIZE } from './chunker';
   import { uploadChunk, type DiscordMessageResponse } from './discord';
   import { putFile, putChunk } from './db';
   import type { FileRecord, ChunkRecord, UploadProgress } from '../types';

   const MAX_CONCURRENT = 3;

   async function runWithConcurrency<T>(
     tasks: Array<() => Promise<T>>,
     limit: number
   ): Promise<T[]> {
     const results: T[] = [];
     const executing = new Set<Promise<void>>();

     for (const task of tasks) {
       const p = task().then(result => {
         results.push(result);
       });
       const tracked = p.then(() => { executing.delete(tracked); });
       executing.add(tracked);

       if (executing.size >= limit) {
         await Promise.race(executing);
       }
     }

     await Promise.all(executing);
     return results;
   }

   export async function uploadFile(
     file: File,
     key: CryptoKey,
     webhookUrl: string,
     onProgress?: (progress: UploadProgress) => void
   ): Promise<FileRecord> {
     const fileId = uuidv4();
     const salt = generateSalt();
     const nonce = generateNonce();
     const chunks = splitFile(file);
     const totalChunks = chunks.length;

     const fileBuffer = await file.arrayBuffer();
     const checksum = await hashFile(fileBuffer);

     const fileRecord: FileRecord = {
       id: fileId,
       name: file.name,
       mimeType: file.type,
       size: file.size,
       folderId: null,
       createdAt: new Date(),
       updatedAt: new Date(),
       status: 'uploading',
       version: 1,
       encryptionSalt: salt,
       encryptionNonce: nonce,
       chunkSize: DEFAULT_CHUNK_SIZE,
       totalChunks,
       checksum,
     };

     await putFile(fileRecord);

     const progress: UploadProgress = {
       fileId,
       fileName: file.name,
       totalChunks,
       completedChunks: 0,
       status: 'encrypting',
     };
     onProgress?.(progress);

     let completedChunks = 0;

     const uploadTasks = chunks.map((chunkBlob, index) => {
       return async () => {
         const chunkBuffer = await chunkBlob.arrayBuffer();
         const chunkNonce = generateNonce();
         const encryptedData = await encryptFile(chunkBuffer, key, chunkNonce);

         onProgress?.({ ...progress, status: 'uploading', completedChunks });

         const response: DiscordMessageResponse = await uploadChunk(
           webhookUrl,
           new Blob([encryptedData], { type: 'application/octet-stream' }),
           {
             fileId,
             chunkIndex: index,
             chunkTotal: totalChunks,
             filename: file.name,
             uploadedAt: new Date().toISOString(),
           }
         );

         const attachment = response.attachments[0];
         const chunkRecord: ChunkRecord = {
           id: uuidv4(),
           fileId,
           chunkIndex: index,
           messageId: response.id,
           attachmentId: attachment.id,
           cdnUrl: attachment.url,
           cdnExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
           channelId: response.channel_id,
           size: encryptedData.byteLength,
           uploadedAt: new Date(),
         };

         await putChunk(chunkRecord);

         completedChunks++;
         onProgress?.({ ...progress, status: 'uploading', completedChunks });
       };
     });

     await runWithConcurrency(uploadTasks, MAX_CONCURRENT);

     fileRecord.status = 'complete';
     fileRecord.updatedAt = new Date();
     await putFile(fileRecord);

     onProgress?.({ ...progress, status: 'complete', completedChunks: totalChunks });

     return fileRecord;
   }
   ```

2. Verify: `npm run build` exits 0
</action>

---

### Task 2.3: Download Pipeline

**requirements:** [STRG-01, STRG-02, INFRA-04]
**depends_on:** [1.2, 1.3, 1.4, 1.5, 2.1]
**files_modified:** `src/lib/download.ts`

<read_first>
- src/lib/crypto.ts (decryptFile, deriveKey)
- src/lib/chunker.ts (reassembleChunks)
- src/lib/discord.ts (refreshCdnUrl, isCdnExpired)
- src/lib/db.ts (getFile, getChunksByFileId)
- .planning/research/ARCHITECTURE.md (Download Flow lines 79-117)
- .planning/phases/01-core-storage-engine/01-CONTEXT.md (CDN URL expired: auto-refresh silently)
</read_first>

<acceptance_criteria>
- `src/lib/download.ts` exports `downloadFile(fileId: string, key: CryptoKey, webhookUrl: string): Promise<Blob>`
- `downloadFile` retrieves FileRecord from IndexedDB via `getFile()`
- `downloadFile` retrieves all ChunkRecords ordered by `chunkIndex` via `getChunksByFileId()`
- `downloadFile` checks each chunk's CDN URL for expiry via `isCdnExpired()`
- `downloadFile` auto-refreshes expired URLs via `refreshCdnUrl()` and updates IndexedDB
- `downloadFile` fetches each chunk from CDN URL as `ArrayBuffer`
- `downloadFile` decrypts each chunk with stored nonce and derived key
- `downloadFile` reassembles decrypted chunks via `reassembleChunks()`
- `downloadFile` returns final Blob
- `src/lib/download.ts` exports `getFreshCdnUrl(fileId: string, chunkIndex: number, webhookUrl: string): Promise<string>` — single chunk URL refresh
- `src/lib/download.ts` exports `getFileSize(fileId: string): Promise<number>` — returns total size from FileRecord
</acceptance_criteria>

<action>
1. Create `src/lib/download.ts`:
   ```ts
   import { decryptFile } from './crypto';
   import { reassembleChunks } from './chunker';
   import { refreshCdnUrl, isCdnExpired } from './discord';
   import { getFile, getChunksByFileId, putChunk } from '../lib/db';

   export async function downloadFile(
     fileId: string,
     key: CryptoKey,
     webhookUrl: string
   ): Promise<Blob> {
     const fileRecord = await getFile(fileId);
     if (!fileRecord) throw new Error(`File not found: ${fileId}`);

     const chunkRecords = await getChunksByFileId(fileId);
     chunkRecords.sort((a, b) => a.chunkIndex - b.chunkIndex);

     if (chunkRecords.length === 0) throw new Error('No chunks found for file');

     const decryptedChunks: Blob[] = [];

     for (const chunk of chunkRecords) {
       let cdnUrl = chunk.cdnUrl;

       if (isCdnExpired(cdnUrl)) {
         cdnUrl = await refreshCdnUrl(webhookUrl, chunk.messageId);
         chunk.cdnUrl = cdnUrl;
         chunk.cdnExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
         await putChunk(chunk);
       }

       const response = await fetch(cdnUrl);
       if (!response.ok) {
         throw new Error(`Failed to fetch chunk ${chunk.chunkIndex}: ${response.statusText}`);
       }

       const encryptedData = await response.arrayBuffer();
       const decryptedData = await decryptFile(encryptedData, key, fileRecord.encryptionNonce);
       decryptedChunks.push(new Blob([decryptedData]));
     }

     return reassembleChunks(decryptedChunks);
   }

   export async function getFreshCdnUrl(
     fileId: string,
     chunkIndex: number,
     webhookUrl: string
   ): Promise<string> {
     const chunkRecords = await getChunksByFileId(fileId);
     const chunk = chunkRecords.find(c => c.chunkIndex === chunkIndex);
     if (!chunk) throw new Error(`Chunk ${chunkIndex} not found for file ${fileId}`);

     if (!isCdnExpired(chunk.cdnUrl)) return chunk.cdnUrl;

     const freshUrl = await refreshCdnUrl(webhookUrl, chunk.messageId);
     chunk.cdnUrl = freshUrl;
     chunk.cdnExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
     await putChunk(chunk);
     return freshUrl;
   }

   export async function getFileSize(fileId: string): Promise<number> {
     const file = await getFile(fileId);
     if (!file) throw new Error(`File not found: ${fileId}`);
     return file.size;
   }
   ```

2. Verify: `npm run build` exits 0
</action>

---

## Wave 3: UI Components

Depends on Wave 2 completion. Tasks 3.1–3.4 can run in parallel.

### Task 3.1: Password/Unlock Modal + Auto-Lock

**requirements:** [STRG-01]
**depends_on:** [2.1]
**files_modified:** `src/components/PasswordModal.tsx`, `src/App.tsx`

<read_first>
- src/stores/auth-store.ts (useAuthStore)
- .planning/phases/01-core-storage-engine/01-CONTEXT.md (Password modal on first use, auto-lock 15min)
</read_first>

<acceptance_criteria>
- `src/components/PasswordModal.tsx` exports `PasswordModal` component
- `PasswordModal` renders a dialog/modal with password input field
- `PasswordModal` has a "Set Password" / "Unlock" button that calls `useAuthStore().unlock(password)`
- `PasswordModal` shows password strength indicator (basic length-based for v1)
- `PasswordModal` prevents closing without entering password (enforced lock)
- `PasswordModal` validates password is at least 8 characters
- `src/App.tsx` conditionally renders `PasswordModal` when `useAuthStore().isUnlocked === false`
- `src/App.tsx` renders main app content only when `isUnlocked === true`
- `src/App.tsx` attaches activity listeners (`mousedown`, `keydown`, `touchstart`) that call `resetInactivityTimer()`
- Modal uses Radix UI Dialog component (`@radix-ui/react-dialog`)
</acceptance_criteria>

<action>
1. Create `src/components/PasswordModal.tsx`:
   ```tsx
   import { useState } from 'react';
   import * as Dialog from '@radix-ui/react-dialog';
   import { useAuthStore } from '../stores/auth-store';

   export function PasswordModal() {
     const [password, setPassword] = useState('');
     const [error, setError] = useState('');
     const [isLoading, setIsLoading] = useState(false);
     const unlock = useAuthStore(s => s.unlock);

     const handleSubmit = async (e: React.FormEvent) => {
       e.preventDefault();
       if (password.length < 8) {
         setError('Password must be at least 8 characters');
         return;
       }
       setIsLoading(true);
       setError('');
       try {
         await unlock(password);
       } catch {
         setError('Failed to derive encryption key');
       } finally {
         setIsLoading(false);
       }
     };

     const strength = password.length === 0 ? 0
       : password.length < 12 ? 1
       : password.length < 16 ? 2
       : 3;

     const strengthLabels = ['—', 'Weak', 'Medium', 'Strong'];
     const strengthColors = ['bg-gray-600', 'bg-red-500', 'bg-yellow-500', 'bg-green-500'];

     return (
       <Dialog.Root open={true}>
         <Dialog.Portal>
           <Dialog.Overlay className="fixed inset-0 bg-black/70" />
           <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-darker-bg p-6 rounded-lg shadow-xl w-96">
             <Dialog.Title className="text-xl font-bold mb-4">Unlock Wyvern Drive</Dialog.Title>
             <Dialog.Description className="text-discord-muted mb-4">
               Enter your encryption password to unlock your files.
             </Dialog.Description>
             <form onSubmit={handleSubmit}>
               <input
                 type="password"
                 value={password}
                 onChange={(e) => { setPassword(e.target.value); setError(''); }}
                 placeholder="Encryption password"
                 className="w-full bg-dark-bg border border-gray-600 rounded px-3 py-2 text-discord-text mb-2"
                 autoFocus
               />
               <div className="flex items-center gap-2 mb-4">
                 <div className="flex-1 h-1.5 bg-gray-700 rounded">
                   <div className={`h-full rounded transition-all ${strengthColors[strength]}`} style={{ width: `${(strength + 1) * 25}%` }} />
                 </div>
                 <span className="text-xs text-discord-muted">{strengthLabels[strength]}</span>
               </div>
               {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
               <button
                 type="submit"
                 disabled={isLoading || password.length < 8}
                 className="w-full bg-blurple hover:bg-blurple/80 disabled:opacity-50 text-white py-2 rounded font-medium"
               >
                 {isLoading ? 'Deriving key...' : 'Unlock'}
               </button>
             </form>
           </Dialog.Content>
         </Dialog.Portal>
       </Dialog.Root>
     );
   }
   ```

2. Update `src/App.tsx`:
   ```tsx
   import { useEffect } from 'react';
   import { useAuthStore } from './stores/auth-store';
   import { PasswordModal } from './components/PasswordModal';

   export default function App() {
     const isUnlocked = useAuthStore(s => s.isUnlocked);
     const resetInactivityTimer = useAuthStore(s => s.resetInactivityTimer);

     useEffect(() => {
       if (!isUnlocked) return;
       const events = ['mousedown', 'keydown', 'touchstart'];
       const handler = () => resetInactivityTimer();
       events.forEach(e => document.addEventListener(e, handler));
       return () => events.forEach(e => document.removeEventListener(e, handler));
     }, [isUnlocked, resetInactivityTimer]);

     if (!isUnlocked) {
       return <PasswordModal />;
     }

     return (
       <div className="min-h-screen bg-darker-bg text-discord-text">
         <h1 className="text-2xl font-bold p-4">Wyvern Drive</h1>
       </div>
     );
   }
   ```

3. Verify: `npm run build` exits 0
</action>

---

### Task 3.2: Settings UI (Webhook Configuration)

**requirements:** [INFRA-02, INFRA-03]
**depends_on:** [1.4, 2.1]
**files_modified:** `src/components/SettingsPanel.tsx`, `src/App.tsx`

<read_first>
- src/lib/discord.ts (validateWebhook)
- src/stores/file-store.ts (getWebhookUrl, setWebhookUrl)
- .planning/phases/01-core-storage-engine/01-CONTEXT.md (Webhook URL in Settings UI, validate on save, single webhook)
- .env.example
</read_first>

<acceptance_criteria>
- `src/components/SettingsPanel.tsx` exports `SettingsPanel` component
- `SettingsPanel` renders a text input for webhook URL
- `SettingsPanel` pre-fills input with `getWebhookUrl()` value from localStorage
- `SettingsPanel` has a "Validate" button that calls `validateWebhook(url)` and shows success/failure
- `SettingsPanel` has a "Save" button that calls `setWebhookUrl(url)` and persists to localStorage
- `SettingsPanel` shows connection status indicator (green dot = valid, red = invalid, gray = unknown)
- `SettingsPanel` validates URL format before sending (must match discord.com/api pattern)
- `SettingsPanel` uses `VITE_DISCORD_WEBHOOK_URL` from env as initial default if localStorage empty
- `src/App.tsx` includes SettingsPanel in the app layout (accessible via settings icon/button)
- Toast notification shown on successful save and validation failure
</acceptance_criteria>

<action>
1. Create `src/components/SettingsPanel.tsx`:
   ```tsx
   import { useState, useEffect } from 'react';
   import { validateWebhook } from '../lib/discord';
   import { getWebhookUrl, setWebhookUrl } from '../stores/file-store';

   export function SettingsPanel() {
     const [url, setUrl] = useState('');
     const [status, setStatus] = useState<'unknown' | 'valid' | 'invalid'>('unknown');
     const [isSaving, setIsSaving] = useState(false);
     const [message, setMessage] = useState('');

     useEffect(() => {
       const stored = getWebhookUrl();
       const envUrl = import.meta.env.VITE_DISCORD_WEBHOOK_URL;
       setUrl(stored || envUrl || '');
     }, []);

     const handleValidate = async () => {
       if (!url) return;
       setStatus('unknown');
       const isValid = await validateWebhook(url);
       setStatus(isValid ? 'valid' : 'invalid');
       setMessage(isValid ? 'Webhook connected successfully' : 'Invalid webhook URL');
     };

     const handleSave = async () => {
       setIsSaving(true);
       try {
         setWebhookUrl(url);
         setMessage('Webhook URL saved');
         await handleValidate();
       } finally {
         setIsSaving(false);
       }
     };

     const statusColors = {
       unknown: 'bg-gray-500',
       valid: 'bg-green-500',
       invalid: 'bg-red-500',
     };

     return (
       <div className="bg-dark-bg p-4 rounded-lg">
         <h2 className="text-lg font-bold mb-3">Discord Webhook</h2>
         <div className="flex items-center gap-2 mb-3">
           <div className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
           <span className="text-sm text-discord-muted">
             {status === 'valid' ? 'Connected' : status === 'invalid' ? 'Disconnected' : 'Unknown'}
           </span>
         </div>
         <input
           type="url"
           value={url}
           onChange={(e) => { setUrl(e.target.value); setStatus('unknown'); }}
           placeholder="https://discord.com/api/webhooks/..."
           className="w-full bg-darker-bg border border-gray-600 rounded px-3 py-2 text-discord-text mb-3"
         />
         <div className="flex gap-2">
           <button
             onClick={handleValidate}
             disabled={!url}
             className="px-4 py-2 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 rounded text-sm"
           >
             Validate
           </button>
           <button
             onClick={handleSave}
             disabled={!url || isSaving}
             className="px-4 py-2 bg-blurple hover:bg-blurple/80 disabled:opacity-50 rounded text-sm"
           >
             {isSaving ? 'Saving...' : 'Save'}
           </button>
         </div>
         {message && <p className="text-sm mt-2 text-discord-muted">{message}</p>}
       </div>
     );
   }
   ```

2. Update `src/App.tsx` to include settings toggle:
   ```tsx
   import { useState } from 'react';
   // ... existing imports
   import { SettingsPanel } from './components/SettingsPanel';

   export default function App() {
     const [showSettings, setShowSettings] = useState(false);
     // ... existing code

     return (
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
         {showSettings && <SettingsPanel />}
         {/* Main content */}
       </div>
     );
   }
   ```

3. Verify: `npm run build` exits 0
</action>

---

### Task 3.3: File Browser UI (Upload Zone + File List + Download)

**requirements:** [STRG-02, STRG-03, INFRA-01]
**depends_on:** [2.1, 2.2, 2.3]
**files_modified:** `src/components/DropZone.tsx`, `src/components/FileList.tsx`, `src/components/FileActions.tsx`, `src/App.tsx`

<read_first>
- src/stores/file-store.ts (useFileStore, getWebhookUrl)
- src/stores/auth-store.ts (useAuthStore)
- src/stores/upload-store.ts (useUploadStore)
- src/lib/upload.ts (uploadFile)
- src/lib/download.ts (downloadFile)
- src/types/index.ts (FileRecord)
- .planning/phases/01-core-storage-engine/01-CONTEXT.md (drag-and-drop + file picker equally prominent, click filename to download)
</read_first>

<acceptance_criteria>
- `src/components/DropZone.tsx` exports `DropZone` component with both drag-and-drop zone and file picker button
- `DropZone` handles `onDrop` event, reads dropped files, calls `uploadFile()` for each
- `DropZone` file picker button accepts multiple files via `<input type="file" multiple>`
- `DropZone` calls `useUploadStore().startUpload()` before each upload
- `DropZone` passes `onProgress` callback to `uploadFile()` that calls `useUploadStore().updateProgress()`
- `src/components/FileList.tsx` exports `FileList` component
- `FileList` renders each file as a row with: name, size (formatted), status, download button
- `FileList` calls `useFileStore().loadFiles()` on mount
- `FileList` shows "No files yet" when empty
- `FileList` formats file sizes using `formatFileSize()` utility (KB, MB, GB)
- `src/components/FileActions.tsx` exports `FileActions` component with download button
- `FileActions` download button calls `downloadFile()` then creates object URL and triggers `<a>` download
- `FileActions` shows downloading state while fetching
- `src/App.tsx` renders `DropZone` and `FileList` in main content area
</acceptance_criteria>

<action>
1. Create `src/utils/format.ts`:
   ```ts
   export function formatFileSize(bytes: number): string {
     if (bytes === 0) return '0 B';
     const k = 1024;
     const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
     const i = Math.floor(Math.log(bytes) / Math.log(k));
     return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
   }

   export function formatDate(date: Date): string {
     return date.toLocaleDateString('en-US', {
       year: 'numeric',
       month: 'short',
       day: 'numeric',
     });
   }
   ```

2. Create `src/components/DropZone.tsx`:
   ```tsx
   import { useCallback, useRef } from 'react';
   import { useAuthStore } from '../stores/auth-store';
   import { useUploadStore } from '../stores/upload-store';
   import { useFileStore, getWebhookUrl } from '../stores/file-store';
   import { uploadFile } from '../lib/upload';

   export function DropZone() {
     const key = useAuthStore(s => s.derivedKey);
     const startUpload = useUploadStore(s => s.startUpload);
     const updateProgress = useUploadStore(s => s.updateProgress);
     const completeUpload = useUploadStore(s => s.completeUpload);
     const failUpload = useUploadStore(s => s.failUpload);
     const loadFiles = useFileStore(s => s.loadFiles);
     const inputRef = useRef<HTMLInputElement>(null);

     const handleFiles = useCallback(async (files: FileList | File[]) => {
       const webhookUrl = getWebhookUrl();
       if (!webhookUrl || !key) return;

       for (const file of Array.from(files)) {
         const fileId = crypto.randomUUID();
         startUpload(fileId, file.name, 0);

         try {
           await uploadFile(file, key, webhookUrl, (progress) => {
             updateProgress(progress.fileId, progress.completedChunks, progress.status);
           });
           completeUpload(fileId);
           await loadFiles();
         } catch (err) {
           failUpload(fileId, (err as Error).message);
         }
       }
     }, [key, startUpload, updateProgress, completeUpload, failUpload, loadFiles]);

     const onDrop = useCallback((e: React.DragEvent) => {
       e.preventDefault();
       if (e.dataTransfer.files.length > 0) {
         handleFiles(e.dataTransfer.files);
       }
     }, [handleFiles]);

     const onDragOver = useCallback((e: React.DragEvent) => {
       e.preventDefault();
     }, []);

     return (
       <div
         onDrop={onDrop}
         onDragOver={onDragOver}
         className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-blurple transition-colors cursor-pointer"
         onClick={() => inputRef.current?.click()}
       >
         <p className="text-discord-muted mb-2">Drag and drop files here</p>
         <p className="text-sm text-discord-muted mb-4">or</p>
         <button
           onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
           className="px-4 py-2 bg-blurple hover:bg-blurple/80 rounded text-sm"
         >
           Browse Files
         </button>
         <input
           ref={inputRef}
           type="file"
           multiple
           className="hidden"
           onChange={(e) => e.target.files && handleFiles(e.target.files)}
         />
       </div>
     );
   }
   ```

3. Create `src/components/FileList.tsx`:
   ```tsx
   import { useEffect } from 'react';
   import { useFileStore } from '../stores/file-store';
   import { formatFileSize, formatDate } from '../utils/format';
   import { FileActions } from './FileActions';

   export function FileList() {
     const files = useFileStore(s => s.files);
     const isLoading = useFileStore(s => s.isLoading);
     const loadFiles = useFileStore(s => s.loadFiles);

     useEffect(() => { loadFiles(); }, [loadFiles]);

     if (isLoading) return <p className="text-discord-muted p-4">Loading files...</p>;
     if (files.length === 0) return <p className="text-discord-muted p-4">No files yet</p>;

     return (
       <div className="mt-4">
         <h2 className="text-lg font-bold mb-2">Files</h2>
         <div className="space-y-1">
           {files.map(file => (
             <div key={file.id} className="flex items-center justify-between bg-dark-bg p-3 rounded hover:bg-dark-bg/80">
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
       </div>
     );
   }
   ```

4. Create `src/components/FileActions.tsx`:
   ```tsx
   import { useState } from 'react';
   import { useAuthStore } from '../stores/auth-store';
   import { getWebhookUrl } from '../stores/file-store';
   import { downloadFile } from '../lib/download';

   interface FileActionsProps {
     fileId: string;
     fileName: string;
     status: string;
   }

   export function FileActions({ fileId, fileName, status }: FileActionsProps) {
     const [isDownloading, setIsDownloading] = useState(false);
     const key = useAuthStore(s => s.derivedKey);

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
       <button
         onClick={handleDownload}
         disabled={isDownloading || status !== 'complete'}
         className="px-3 py-1 bg-blurple hover:bg-blurple/80 disabled:opacity-50 rounded text-sm"
       >
         {isDownloading ? 'Downloading...' : 'Download'}
       </button>
     );
   }
   ```

5. Update `src/App.tsx` to include file browser:
   ```tsx
   import { useState } from 'react';
   import { useAuthStore } from './stores/auth-store';
   import { PasswordModal } from './components/PasswordModal';
   import { SettingsPanel } from './components/SettingsPanel';
   import { DropZone } from './components/DropZone';
   import { FileList } from './components/FileList';

   export default function App() {
     const isUnlocked = useAuthStore(s => s.isUnlocked);
     const [showSettings, setShowSettings] = useState(false);

     if (!isUnlocked) return <PasswordModal />;

     return (
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
         <main className="max-w-4xl mx-auto p-4">
           <DropZone />
           <FileList />
         </main>
       </div>
     );
   }
   ```

6. Verify: `npm run build` exits 0
</action>

---

### Task 3.4: Upload Progress UI + Toast Notifications

**requirements:** [STRG-03, INFRA-03]
**depends_on:** [2.1, 3.3]
**files_modified:** `src/components/UploadProgress.tsx`, `src/components/Toast.tsx`, `src/App.tsx`

<read_first>
- src/stores/upload-store.ts (useUploadStore)
- src/utils/format.ts (formatFileSize)
- .planning/phases/01-core-storage-engine/01-CONTEXT.md (Progress per-file with chunk count, toast notifications for errors)
</read_first>

<acceptance_criteria>
- `src/components/UploadProgress.tsx` exports `UploadProgressList` component
- `UploadProgressList` renders each active upload with: file name, chunk progress ("3/7 chunks"), status indicator
- `UploadProgressList` shows progress bar per file based on `completedChunks / totalChunks`
- `UploadProgressList` hides completed uploads after 3 seconds
- `UploadProgressList` shows error message for failed uploads with retry indication
- `src/components/Toast.tsx` exports `ToastProvider` and `useToast` hook
- `useToast` exports `toast({ title, description, variant })` function
- `Toast` auto-dismisses after 5 seconds
- `Toast` supports variants: `default`, `success`, `error`
- `src/App.tsx` wraps app in `ToastProvider`
- `UploadProgressList` renders above file list when uploads are active
</acceptance_criteria>

<action>
1. Create `src/components/Toast.tsx`:
   ```tsx
   import { createContext, useContext, useState, useCallback, useEffect } from 'react';

   interface Toast {
     id: string;
     title: string;
     description?: string;
     variant: 'default' | 'success' | 'error';
   }

   interface ToastContextValue {
     toast: (t: Omit<Toast, 'id'>) => void;
   }

   const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

   export function useToast() {
     return useContext(ToastContext);
   }

   export function ToastProvider({ children }: { children: React.ReactNode }) {
     const [toasts, setToasts] = useState<Toast[]>([]);

     const addToast = useCallback((t: Omit<Toast, 'id'>) => {
       const id = crypto.randomUUID();
       setToasts(prev => [...prev, { ...t, id }]);
     }, []);

     useEffect(() => {
       if (toasts.length === 0) return;
       const timer = setTimeout(() => {
         setToasts(prev => prev.slice(1));
       }, 5000);
       return () => clearTimeout(timer);
     }, [toasts]);

     const variantStyles = {
       default: 'bg-dark-bg border-gray-600',
       success: 'bg-green-900/50 border-green-600',
       error: 'bg-red-900/50 border-red-600',
     };

     return (
       <ToastContext.Provider value={{ toast: addToast }}>
         {children}
         <div className="fixed bottom-4 right-4 z-50 space-y-2">
           {toasts.map(t => (
             <div key={t.id} className={`border rounded-lg px-4 py-3 shadow-lg ${variantStyles[t.variant]} min-w-64`}>
               <p className="font-medium">{t.title}</p>
               {t.description && <p className="text-sm text-discord-muted">{t.description}</p>}
             </div>
           ))}
         </div>
       </ToastContext.Provider>
     );
   }
   ```

2. Create `src/components/UploadProgress.tsx`:
   ```tsx
   import { useEffect, useState } from 'react';
   import { useUploadStore } from '../stores/upload-store';

   export function UploadProgressList() {
     const uploads = useUploadStore(s => s.uploads);
     const removeUpload = useUploadStore(s => s.removeUpload);
     const [completedTimers, setCompletedTimers] = useState<Map<string, number>>(new Map());

     useEffect(() => {
       for (const upload of uploads) {
         if (upload.status === 'complete' && !completedTimers.has(upload.fileId)) {
           const timer = window.setTimeout(() => {
             removeUpload(upload.fileId);
             completedTimers.delete(upload.fileId);
           }, 3000);
           completedTimers.set(upload.fileId, timer);
         }
       }
     }, [uploads, completedTimers, removeUpload]);

     const activeUploads = uploads.filter(u => u.status !== 'complete');

     if (activeUploads.length === 0) return null;

     return (
       <div className="mb-4 space-y-2">
         {activeUploads.map(upload => {
           const progress = upload.totalChunks > 0
             ? Math.round((upload.completedChunks / upload.totalChunks) * 100)
             : 0;

           const statusText = {
             pending: 'Queued...',
             encrypting: 'Encrypting...',
             uploading: `Uploading ${upload.completedChunks}/${upload.totalChunks} chunks`,
             failed: `Failed: ${upload.error}`,
           }[upload.status];

           return (
             <div key={upload.fileId} className="bg-dark-bg rounded-lg p-3">
               <div className="flex items-center justify-between mb-1">
                 <span className="text-sm font-medium truncate">{upload.fileName}</span>
                 <span className="text-xs text-discord-muted">{statusText}</span>
               </div>
               <div className="h-1.5 bg-gray-700 rounded">
                 <div
                   className={`h-full rounded transition-all ${
                     upload.status === 'failed' ? 'bg-red-500' : 'bg-blurple'
                   }`}
                   style={{ width: `${progress}%` }}
                 />
               </div>
             </div>
           );
         })}
       </div>
     );
   }
   ```

3. Update `src/App.tsx` to include ToastProvider and UploadProgressList:
   ```tsx
   import { useState } from 'react';
   import { useAuthStore } from './stores/auth-store';
   import { PasswordModal } from './components/PasswordModal';
   import { SettingsPanel } from './components/SettingsPanel';
   import { DropZone } from './components/DropZone';
   import { FileList } from './components/FileList';
   import { UploadProgressList } from './components/UploadProgress';
   import { ToastProvider } from './components/Toast';

   export default function App() {
     const isUnlocked = useAuthStore(s => s.isUnlocked);
     const [showSettings, setShowSettings] = useState(false);

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
             <main className="max-w-4xl mx-auto p-4">
               <DropZone />
               <UploadProgressList />
               <FileList />
             </main>
           </div>
         )}
       </ToastProvider>
     );
   }
   ```

4. Verify: `npm run build` exits 0
</action>

---

## Verification

After all tasks complete:

```bash
# Build must succeed
npm run build

# Dev server must start
npm run dev &
sleep 3 && curl -s http://localhost:5173 | grep "Wyvern Drive"
```

---

## must_haves

These are the invariants that MUST be true for Phase 1 to be considered complete:

1. **STRG-01**: `src/lib/crypto.worker.ts` contains PBKDF2 with 600,000 iterations and AES-GCM encryption
2. **STRG-02**: `src/lib/discord.ts` uploads files via webhook with `?wait=true` and returns message responses
3. **STRG-03**: `src/lib/chunker.ts` splits files into 8MB chunks; `src/lib/upload.ts` runs max 3 concurrent uploads
4. **INFRA-01**: `npm run build` produces static files in `dist/` with no server dependencies
5. **INFRA-02**: `src/components/SettingsPanel.tsx` persists webhook URL to localStorage; `src/lib/discord.ts` validates webhooks
6. **INFRA-03**: `src/lib/rate-limiter.ts` implements exponential backoff on 429 responses
7. **INFRA-04**: `src/lib/download.ts` checks CDN URL expiry and auto-refreshes via message fetch
8. **E2E Pipeline**: Upload flow (file → encrypt → chunk → upload → IndexedDB) and download flow (IndexedDB → fetch CDN → decrypt → reassemble → Blob) are fully wired
9. **Password Lock**: App is inaccessible without entering password; auto-locks after 15min inactivity
10. **No backend**: Zero server-side code; `package.json` has no Express/Fastify/etc. dependency
