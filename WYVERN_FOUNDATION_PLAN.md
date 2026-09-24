# Wyvern Drive — Phase 0 and Phase 1 foundation

## Context

Implement only the first implementation task in the supplied Wyvern Drive specification: a runnable Go/Wails v3 desktop shell, headless health server, React/TypeScript frontend, configuration and logging, explicit SQLite migrations, domain/repositories, metadata operations and their tests. Completion means a local vault and nested folders survive application restart, with working rename/move/delete and case-insensitive collision prevention. This is not the encrypted-drive MVP: do not implement Discord, encryption, byte transfers, remote browser administration, sharing, or recovery in these two phases.

## Verified starting point

- Repository root is empty; there are no existing source files, conventions or callers to migrate. All source paths below will be new, not descriptions of existing code.
- Installed tools reported `go1.23.4 windows/amd64` and Node `v22.15.1`; implementation must use the pinned compatible toolchains specified below rather than assuming these are sufficient.
- SQLite foreign keys are connection-local and cannot be enabled inside an active transaction. Set them through connection initialization, not once on an arbitrary pooled connection. Source: https://www.sqlite.org/foreignkeys.html .
- SQLite unique partial indexes support separate root and non-root name constraints. Use these rather than a nullable-parent composite unique index that permits duplicate root names. Source: https://www.sqlite.org/partialindex.html .

## Approach

### Scope and package direction

Keep one Go module with independent `cmd/desktop` and `cmd/wyvernd` composition roots. Both use `internal/app`; only the desktop composition root imports Wails. Domain/repository/filesystem packages must compile without Wails or frontend assets. The empty repository has no reusable application implementation; use Go standard-library configuration, logging, HTTP and testing rather than new frameworks.

Phase 1 local vaults are explicitly metadata-only development vaults, not encrypted storage or a working local BlobStore. Show that distinction in the desktop shell. File/chunk/job models and repositories establish durable data contracts; do not add fake upload/download operations or generate pretend encryption keys. The actual storage backends follow in Phase 3; local on-disk SQLite is the persistence exercised here.

Expose only `GET /api/v1/health` from the headless server at this stage. Do not create an unauthenticated filesystem API to make the UI work; Wails bindings call shared Go application operations directly. Normal browser administration and HTTPClient belong to Phase 9.

### 1. Establish runnable composition roots (Phase 0)

Use module path `wyvern-drive` (no invented GitHub owner). Create only occupied directories: `cmd/desktop`, `cmd/wyvernd`, `internal/{app,config,logging,domain,database,filesystem,validation}`, `server/api`, `frontend/src/{api,components,types}`, `migrations`, `build`, `tests`, `.github/workflows`. Other target-layout directories are created when their phases implement real behavior; no empty Go packages or fake services.

New-file ownership: `internal/app/app.go` for composition, `internal/app/metadata_service.go` and `dto.go` for the presentation facade; `internal/config/config.go`; `internal/logging/logging.go`; `internal/domain/{types,errors,id}.go`; `internal/database/{store,migrate,repositories}.go`; `internal/filesystem/service.go`; `internal/validation/names.go`; `server/api/health.go`. Frontend entry files are `frontend/index.html`, `src/main.tsx`, `src/App.tsx`, `src/styles.css`; client files are `src/api/{client,wails-client}.ts` and DTOs `src/types/dto.ts`. Keep dialogs/sidebar/table inside `src/components` as implemented, not placeholder exports.

`internal/app.Open(ctx context.Context, cfg config.Config, logger *slog.Logger) (*App, error)` initializes SQLite/migrations and application operations; `(*App).Close() error` closes owned resources once. Fail startup and release partially opened resources on errors. No global mutable application singleton. All operations take contexts. `cmd/wyvernd/main.go` and the Windows-only `cmd/desktop/main.go` own process lifecycle; Windows desktop uses `//go:build windows` so Linux package enumeration does not import Wails. Do not add a second module or a fake non-Windows desktop executable.

`App` exposes `Store *database.Store` to the headless composition root and `Metadata *MetadataService` to the desktop composition root; it does not expose raw SQL or key-bearing domain values to JavaScript. Construct with `filesystem.New(store *database.Store) *Service` and `app.NewMetadataService(service *filesystem.Service) *MetadataService`.

Configuration in `internal/config`:
- `Load(args []string, lookupEnv func(string) (string, bool)) (Config, error)` resolves built-in defaults, `<data-dir>/config/config.json`, environment, then explicitly supplied flags. Resolve data directory first from `--data-dir`, `WYVERN_DATA_DIR`, then platform default; config cannot redirect its own data directory.
- Defaults: Windows `%LOCALAPPDATA%\Wyvern Drive`; Linux `/var/lib/wyvern-drive`. Empty Windows LOCALAPPDATA is an actionable configuration error, not a relative fallback. Flags: `--data-dir`, `--listen`, `--log-level`. Environment: `WYVERN_DATA_DIR`, `WYVERN_LISTEN`, `WYVERN_LOG_LEVEL`. JSON keys: `listen_address`, `log_level`; defaults `127.0.0.1:9847`, `INFO`.
- This health-only milestone accepts numeric loopback listen addresses only (`127.0.0.1` or `::1`); non-loopback configuration returns `INVALID_CONFIG`. Do not enable network exposure before authentication exists. Port 0 is permitted for tests, otherwise accept 1–65535. Use `net.SplitHostPort` and `net/netip`, not ad-hoc colon splitting.
- Missing config means defaults; malformed JSON, unknown keys, invalid levels/addresses, or unreadable existing config fail startup. Do not overwrite existing configuration. Resolve relative explicitly supplied data directories to absolute paths.
- Create `config`, `database`, `logs`, `cache`, `backups` beneath data directory. Database path is `database/wyvern.sqlite`. POSIX directory mode 0700, created files 0600; Windows inherits user data-directory ACLs (do not claim POSIX modes enforce Windows ACLs). No secrets exist in this milestone.

`internal/logging.New(dir string, level slog.Level) (*slog.Logger, io.Closer, error)` creates an append-only `logs/wyvern.jsonl` JSON handler and a stderr text handler through a small fan-out handler. Return and close the log file owner. If log opening fails, emit a safe stderr error and fail startup. Log only allowlisted operation names, IDs, durations and error codes; do not dump configuration, method arguments, request URLs/bodies or arbitrary wrapped errors. This avoids establishing a secret-leaking convention for later phases. No telemetry.

`wyvernd serve [flags]` opens the core, creates the health handler and explicitly binds before announcing readiness. Unknown command/flag is a usage error and nonzero exit; no-argument invocation prints help without creating data. Do not create placeholder `doctor`, `backup`, `verify`, `status` commands. Handle interrupt on Windows and SIGTERM on Linux; stop accepting requests, call HTTP `Shutdown` with a fresh 10-second context, close DB, then flush/close logging. Listen failure closes the core and returns nonzero.

`server/api.NewHandler(store *database.Store) http.Handler` uses Go `http.ServeMux` method patterns. `GET /api/v1/health` performs a short database query with a 2-second deadline and checks the expected migrated schema version. Success: HTTP 200, `Content-Type: application/json`, `Cache-Control: no-store`, body `{"status":"healthy","database":"ready","schema_version":N}` where N is the highest applied migration. Failure after startup: HTTP 503 with `{"error":{"code":"DATABASE_UNAVAILABLE","message":"The local database is unavailable.","details":{}}}`; never disclose SQL/path information. Unknown routes 404, wrong methods 405. No metadata routes, static browser admin or CORS headers yet. Set `ReadHeaderTimeout=5s`, `IdleTimeout=60s`, `MaxHeaderBytes=1<<20`; do not set a global short WriteTimeout. Desktop does not start this server automatically.

### 2. Establish explicit durable schema (Phase 0, then Phase 1)

Use `database/sql` with `modernc.org/sqlite v1.59.0` and `golang.org/x/text v0.42.0`; their published go.mod files require Go 1.25 and 1.26 respectively. Sources: https://proxy.golang.org/modernc.org/sqlite/@v/v1.59.0.mod and https://proxy.golang.org/golang.org/x/text/@v/v0.42.0.mod .

`database.Open(ctx context.Context, path string) (*Store, error)` uses a file URI built with URL escaping (including Windows drive letters/spaces), `mode=rwc`, `_pragma=foreign_keys(1)`, `_pragma=busy_timeout(5000)`, `_pragma=synchronous(FULL)`, `_txlock=immediate`. Use one open/idle connection for this milestone, no expiry. Enable and verify `journal_mode=WAL` outside a transaction; fail if unavailable rather than silently weakening durability. Apply connection-local settings in the DSN so reconnection retains them. Modernc supports `_pragma` and `_txlock`: https://gitlab.com/cznic/sqlite/-/raw/v1.59.0/sqlite.go . Never call DB-level queries while holding its single connection in a transaction.

Embed ordered SQL through `migrations/embed.go` with `//go:embed *.sql`; migrations are immutable and numbered, not inferred from Go structs. Runner creates `schema_migrations(version INTEGER PRIMARY KEY, name TEXT NOT NULL, checksum TEXT NOT NULL, applied_at INTEGER NOT NULL)` and checks applied versions/checksums. Refuse newer database versions, gaps or changed applied migrations. Run all pending SQL and corresponding version inserts in one transaction, roll back all pending work on failure, and do not start listeners/UI against a failed migration. Re-running with no pending migration is a no-op.

Runner signature: `database.Migrate(ctx context.Context, store *Store, source fs.FS, backupDir string) error`; `migrations/embed.go` exports `FS embed.FS`. `app.Open` calls `database.Open`, then Migrate with that FS and `<data-dir>/backups`, then constructs services. On success, record the highest expected version in Store before sharing it with callers. `(*Store).Readiness(ctx context.Context) (int,error)` queries the applied version and rejects an unavailable DB or version mismatch; the health handler uses this method. The migration checksum is lowercase hex SHA-256 over the exact SQL bytes; filenames match `NNNN_description.sql`, consecutive versions start at 1. Backups use SQLite's documented consistent-snapshot facility, not ordinary copying: https://www.sqlite.org/lang_vacuum.html .

Create `0001_foundation.sql` for `settings(key TEXT PRIMARY KEY, value TEXT NOT NULL)`; it gives Phase 0 a real applied schema. Add `0002_metadata.sql` in Phase 1. Before applying pending migrations to a nonempty application database, create a unique backup via parameterized `VACUUM INTO` under `backups/pre-migration-<UTC timestamp>-<random ID>.sqlite`, outside any transaction and before new schema writes. Backup failure aborts migration; do not copy a WAL database as a plain file. General backup rotation and CLI stay in later phases.

`0002_metadata.sql` defines:
- `vaults`: `id` TEXT PK; `name` TEXT NOT NULL; `backend_type` TEXT NOT NULL; `state` TEXT NOT NULL constrained to `metadata_only` or `ready`; `chunk_size` INTEGER NOT NULL > 0; `encrypted_vault_key` BLOB nullable; `recovery_anchor_message_id` TEXT nullable; `created_at`,`updated_at` INTEGER NOT NULL. Add `CHECK(state='metadata_only' OR encrypted_vault_key IS NOT NULL)`. The Phase 1 creation operation always writes `backend_type='local-test'`, `state='metadata_only'`, `chunk_size=16777216`, NULL key/anchor. No production local backend claim.
- `entries`: fields from the specification: `id`, `vault_id`, nullable `parent_id`, `kind`, `name`, `name_key`, `status`, `size`, `mime_type`, `created_at`, `updated_at`, nullable `deleted_at`. TEXT IDs, INTEGER byte counts/timestamps, `size>=0`. Kinds exactly `file|folder`; statuses exactly `available|uploading|upload_failed|deleting|delete_failed|corrupt`. Folder size is 0 and MIME is NULL. Add `UNIQUE(vault_id,id)` and composite FK `(vault_id,parent_id) REFERENCES entries(vault_id,id) ON DELETE RESTRICT`, plus vault FK and `CHECK(parent_id IS NULL OR parent_id<>id)`. A parent must also be an available folder; enforce this in the transactional service.
- Root unique index `(vault_id,name_key) WHERE parent_id IS NULL AND deleted_at IS NULL`; child unique index `(vault_id,parent_id,name_key) WHERE parent_id IS NOT NULL AND deleted_at IS NULL`. All nondeleted statuses reserve their names. Index `(vault_id,parent_id,name_key,id)` for listing.
- `files`: `entry_id` TEXT PK/FK entries RESTRICT; `wrapped_file_key` BLOB NOT NULL; `chunk_size` INTEGER > 0; `chunk_count` INTEGER >= 0; `sha256` BLOB nullable until completion (32 bytes when present); `created_at` INTEGER NOT NULL.
- `chunks`: `id` TEXT PK; `file_entry_id` TEXT FK files RESTRICT; `chunk_index` INTEGER >= 0; `backend_type`, `message_id`, `attachment_id`, `remote_name` TEXT NOT NULL; `nonce` BLOB length 24; `plaintext_size`,`ciphertext_size` INTEGER >= 0; `plaintext_sha256` BLOB length 32; `created_at` INTEGER NOT NULL; UNIQUE `(file_entry_id,chunk_index)`. These are metadata fields only; no Discord URL constructors or network code. Synthetic backend references in tests must not be represented as real Discord objects.
- `jobs`: fields listed in the specification: TEXT `id` PK, `type`, `vault_id` FK RESTRICT, nullable `entry_id` FK RESTRICT, `state`, nullable `source_path`,`destination_path`, INTEGER `bytes_total`,`bytes_completed`,`items_total`,`items_completed`, nullable TEXT `error_code`,`error_message`, INTEGER `created_at`,`updated_at`, nullable INTEGER `started_at`,`completed_at`. Nonnegative totals/progress, completed <= total. Types exactly `upload|download|delete|recovery_snapshot|restore|verify|cleanup`; states exactly `queued|running|paused|interrupted|completed|failed|cancelled|source_changed|remote_state_unknown`. Add index `(state,created_at,id)`.

Use UTC Unix milliseconds in SQL and `time.Time` in Go. Generate IDs from 16 `crypto/rand` bytes encoded as 32 lowercase hex characters; propagate entropy errors. Define typed string enums and `Vault`, `Entry`, `File`, `Chunk`, `Job` in `internal/domain`, with Go `int64` for lengths/progress and nullable pointers for optional values. Do not generate keys yet. No `users`, credentials, sessions, shares or recovery tables until the corresponding behavior exists.

### 3. Implement transactional metadata operations (Phase 1)

`internal/database` owns all parameterized SQL. Do not return raw `*sql.DB` to Wails/HTTP handlers. Use a private `querier` implemented by DB and Tx, concrete `Store`/`Tx` types, and `(*Store).WithTx(ctx context.Context, fn func(*Tx) error) error` for application transactions; rollback on error/panic and return commit errors. Reads exist on both Store and Tx; writes only on Tx. Close row iterators before further statements on the single connection.

Implement these repository operations, with context as first parameter:
- `GetVault(id string) (domain.Vault,error)`, `ListVaults() ([]domain.Vault,error)`, `InsertVault(domain.Vault) error`.
- `GetEntry(id string) (domain.Entry,error)`, `ListEntries(vaultID string,parentID *string) ([]domain.Entry,error)`, `InsertEntry(domain.Entry) error`, `RenameEntry(id,name,nameKey string,updatedAt time.Time) error`, `MoveEntry(id string,parentID *string,updatedAt time.Time) error`, `DeleteEntry(id string) error`.
- `GetFile(entryID string) (domain.File,error)`, `InsertFile(domain.File) error`, `ListChunks(entryID string) ([]domain.Chunk,error)` ordered by index, `InsertChunk(domain.Chunk) error`.
- `GetJob(id string) (domain.Job,error)`, `ListJobs() ([]domain.Job,error)`, `InsertJob(domain.Job) error`, `UpdateJob(job domain.Job,expectedState domain.JobState) error`. Last operation is compare-and-swap, rejects immutable identity/type/vault/entry changes, invalid progress and mismatched current state; completed/cancelled jobs are terminal. For this milestone it updates progress/error/timestamps only and requires the new state to equal the stored state. Actual job transitions and execution are introduced with the transfer engine, not guessed here. No worker engine or public job controls yet.

Repository inserts enforce matching file-entry kind and job-entry vault membership within the same transaction. Constraint failures map by modernc numeric error codes, never parsing SQL error strings. Unique-name failure => `FILE_CONFLICT`; missing records => `NOT_FOUND`; missing/wrong-kind/cross-vault parent => `INVALID_PARENT`. Wrap other database failures without returning driver details to presentation.

`validation.NormalizeName(name string) (display string,key string,err error)` retains case, uses NFC for display and `norm.NFC.String(cases.Fold().String(display))` for key. `cases.Fold` does not normalize by itself (https://raw.githubusercontent.com/golang/text/v0.42.0/cases/cases.go). Reject invalid UTF-8, empty/whitespace-only names, `.`, `..`, slash, backslash, Unicode control characters, and display names over 255 UTF-8 bytes. Do not silently trim or sanitize names. Do not add host-path construction or Windows filename restrictions here; these are virtual metadata names and safe local-download naming is a later task.

Implement `filesystem.Service` over the Store, with all hierarchy validations and mutation inside `WithTx`, including lookups preceding changes. It owns:
```go
CreateLocalVault(ctx context.Context, name string) (domain.Vault, error)
ListVaults(ctx context.Context) ([]domain.Vault, error)
GetVault(ctx context.Context, id string) (domain.Vault, error)
ListEntries(ctx context.Context, vaultID string, parentID *string) ([]domain.Entry, error)
CreateFolder(ctx context.Context, vaultID string, parentID *string, name string) (domain.Entry, error)
RenameEntry(ctx context.Context, entryID string, name string) (domain.Entry, error)
MoveEntry(ctx context.Context, entryID string, parentID *string) (domain.Entry, error)
DeleteFolder(ctx context.Context, entryID string, recursive bool) error
```
- Empty vault names rejected with the same name validator; vault names need not be globally unique (the specification constrains sibling entries, not vault names).
- List validates vault and optional parent before querying. Return a non-nil empty slice. Order folders first, then `name_key`, then ID, ascending. Load no descendants for a normal listing.
- Create folder writes `kind=folder,status=available,size=0`; no file-byte operation or backend required.
- Rename preserves ID, parent, created_at and children; case-only renames allowed; collisions are database-enforced. Same exact name is a no-op. Only available entries can be renamed/moved.
- Move remains in the same vault. NULL destination means root. Reject missing/nonfolder/unavailable/cross-vault destination, moving self beneath self, and cycles. Walk destination ancestors inside the transaction; reject if source encountered. Same parent is a no-op. Collision or any validation failure leaves original hierarchy unchanged. Concurrent reciprocal moves must serialize through immediate transactions and cannot create a cycle.
- `DeleteFolder(false)` rejects nonempty folders with `FOLDER_NOT_EMPTY`. Recursive folder deletion enumerates and validates the complete subtree before deleting in postorder within one transaction. If any file, file/chunk record or job dependency would be removed, fail `OPERATION_UNAVAILABLE` without mutation: remote-payload deletion is not implemented yet. Never let cascading foreign keys silently erase remote-reference metadata. Cycles from externally corrupted DB are detected with a visited set and reported `INVALID_HIERARCHY`, not infinite recursion.

Define `domain.Error` with stable `Code` and safe `Message`, and optional wrapped cause for internal use, implementing `error`/`Unwrap`. Codes for this milestone: `INVALID_NAME`, `NOT_FOUND`, `FILE_CONFLICT`, `INVALID_PARENT`, `INVALID_HIERARCHY`, `FOLDER_NOT_EMPTY`, `INVALID_STATE`, `OPERATION_UNAVAILABLE`, `DATABASE_UNAVAILABLE`, `INVALID_CONFIG`. Do not put SQL/path/secret contents in safe messages. Application methods return errors; presentation converts to a DTO, never exposes domain key-bearing structs.

### 4. Pin compatible tools and wire the native shell (Phase 0)

Use these exact direct versions, commit `go.sum` and `frontend/package-lock.json`, and never put `latest` in CI or checked-in install commands:

| Tool/package | Pin |
|---|---|
| Go toolchain / go.mod `go` directive | `1.27.1` |
| Node LTS | `24.21.0` |
| `github.com/wailsapp/wails/v3` and Wails CLI | `v3.0.0-beta.25` |
| `@wailsio/runtime` | `3.0.0-beta.25` |
| Task CLI module `github.com/go-task/task/v3/cmd/task` | `v3.53.1` |
| `react`, `react-dom`, `@types/react`, `@types/react-dom` | `19.3.0` each |
| `typescript` | `7.0.2` |
| `vite` | `8.3.0` |
| `@vitejs/plugin-react` | `6.1.1` |
| `tailwindcss`, `@tailwindcss/vite` | `4.3.3` each |
| `vitest` | `5.0.1` |
| `jsdom` | `30.1.1` |
| `@testing-library/react` | `16.3.3` |
| `@testing-library/dom` | `10.4.2` |
| `@testing-library/jest-dom` | `7.0.1` |
| `@types/node` (Node 24 line) | `24.10.1` |

Sources verified during planning: https://go.dev/dl/?mode=json ; https://nodejs.org/en/about/previous-releases ; https://github.com/wailsapp/wails/releases/tag/v3.0.0-beta.25 ; https://raw.githubusercontent.com/wailsapp/wails/v3.0.0-beta.25/v3/go.mod ; https://registry.npmjs.org/typescript/7.0.2 ; https://registry.npmjs.org/@wailsio%2fruntime/latest . Remaining npm pins/peers were read from their official registry `/<package>/latest` endpoints. Vite plugin 6 supports Vite 8; Tailwind plugin 4.3 supports Vite 8; Vitest 5 supports Vite 8 and Node 24; jsdom 30 requires at least Node 24.15 on that line. TypeScript 7.0.2 is current stable with a `tsc` binary; use it rather than copying the older Wails template TS pin. Node type definitions deliberately match Node 24 rather than Node 26.

Wails v3 is currently beta, not stable; exact beta pin is required by the explicit v3 requirement. Installed `wails3` already reports this pin but installed Go and Node must be upgraded or replaced by user-local toolchains before building. Task is not installed; use `go install github.com/go-task/task/v3/cmd/task@v3.53.1` and `go install github.com/wailsapp/wails/v3/cmd/wails3@v3.0.0-beta.25` after provisioning Go. Do not replace v3 with v2. Run `wails3 doctor` to establish WebView2 readiness; use official Evergreen WebView2 runtime if missing. NSIS/installer packaging is not needed for this milestone.

Implement only the verified Wails pattern in `cmd/desktop/main.go`: `application.New(application.Options{ Name:"Wyvern Drive", Services:..., Assets:application.AssetOptions{Handler:application.AssetFileServerFS(assetFS)} })`, then `app.Window.NewWithOptions(application.WebviewWindowOptions{Title:"Wyvern Drive",Width:1100,Height:720,URL:"/"})`, then `app.Run()`. Initialize the plain Go core before creating the window. Put lifetime in a `run() error` so deferred DB/log closure executes before main exits on error. Closing the last window quits; tray/background mode waits for Phase 8. Do not copy template demo ticker goroutines.

Register `internal/app.MetadataService` via `application.NewServiceWithOptions(service, application.ServiceOptions{MarshalError:...})`. It is a plain-Go facade accepting `filesystem.Service` and returning only DTOs; no Wails import in that package. Its exported operations have the same names and inputs as the eight filesystem methods in Step 3, but return `VaultDTO`, `[]VaultDTO`, `EntryDTO`, or `[]EntryDTO` instead of domain records (DeleteFolder returns error only). The leading `context.Context` is injected by the Wails binding runtime, not a frontend argument.

DTO JSON fields:
- VaultDTO: `id,name,backend_type,state,created_at,updated_at`.
- EntryDTO: `id,vault_id,parent_id,kind,name,status,size,mime_type,created_at,updated_at`; size is a decimal string so later int64 values survive JavaScript without precision loss. Times are UTC RFC3339Nano strings. NULL parent/MIME stay JSON null.
- Error marshaler emits `{"code":"...","message":"...","details":{}}` from typed safe errors; unexpected errors become `DATABASE_UNAVAILABLE` with a safe message. Return only valid JSON, including fallback. Wails errors carry this payload in the rejected Error's `cause`; `WailsClient` validates that shape and converts it to `ClientError`, never parses human-readable text. Ensure the error's top-level Error() string is safe too.

Pinned API evidence: https://raw.githubusercontent.com/wailsapp/wails/v3.0.0-beta.25/v3/pkg/application/services.go ; https://raw.githubusercontent.com/wailsapp/wails/v3.0.0-beta.25/v3/pkg/application/bindings.go ; https://raw.githubusercontent.com/wailsapp/wails/v3.0.0-beta.25/v3/internal/runtime/desktop/@wailsio/runtime/src/calls.ts ; https://raw.githubusercontent.com/wailsapp/wails/v3.0.0-beta.25/v3/internal/templates/_common/main.go.tmpl .

Avoid the clean-checkout embed/bindings cycle without fake dist files:
- `cmd/desktop/assets_dev.go`, build tag `windows && !production`, provides the real development asset FS `os.DirFS("frontend/dist")`; commands run from repository root. Main checks `index.html` exists before starting the window and returns an actionable build-first error if not.
- `frontend/assets_windows.go`, build tag `windows && production`, embeds `all:dist` and exports `Assets() (fs.FS,error)` using `fs.Sub(embedded,"dist")`.
- `cmd/desktop/assets_production.go`, build tag `windows && production`, calls the embed helper. Both desktop helper files expose the same unexported `desktopAssets() (fs.FS,error)`.
- Generate bindings in the normal nonproduction configuration before Vite build; no embed needs to match absent dist then. Production builds depend on successful Vite output. Never embed `node_modules`, sources or user data. Do not commit dist or `.gitkeep` placeholders.
- Generate from Windows, root working directory: `wails3 generate bindings -ts -d ./frontend/bindings ./cmd/desktop/...`. Commit generated TypeScript for clean Linux frontend builds; regenerate after any facade change, never edit it by hand. Use generated import paths as emitted rather than guessing method IDs.

This is a separate native entry point, not Wails' optional `-tags server` runtime. `wyvernd` must not import or initialize Wails, and builds with plain `go build ./cmd/wyvernd` and `CGO_ENABLED=0`.

### 5. Add the minimal metadata UI (Phase 1, after metadata tests pass)

Phase 0 frontend initially shows the product name and ready/local-database status; Phase 1 adds the controls below. Use React hooks and CSS/Tailwind only, no router/store/component-library dependency. Native titlebar, light restrained surfaces, system font, compact table, ordinary focus rings; no animation or ornamental dashboard.

`frontend/package.json` is private ESM with exact dependencies above and scripts `dev: "vite"`, `build: "vite build"`, `typecheck: "tsc --noEmit"`, `test: "vitest run"`. Use strict TS, `target: ES2022`, `module: ESNext`, `moduleResolution: Bundler`, `jsx: react-jsx`, DOM libraries and vite/client types; include src, generated bindings and Vite config. Vite uses `react()` and `tailwindcss()` plugins, `base:"./"`, default output `dist`. Import Tailwind using `@import "tailwindcss";`. Configure Vitest via `defineConfig` from `vitest/config`, jsdom environment, and jest-dom's `/vitest` setup import. Do not add the Wails Vite auto-generation plugin; Task owns explicit binding generation.

Define `WyvernClient` in `frontend/src/api/client.ts` with Promise-returning `createLocalVault(name)`, `listVaults()`, `getVault(id)`, `listEntries(vaultID,parentID)`, `createFolder(vaultID,parentID,name)`, `renameEntry(entryID,name)`, `moveEntry(entryID,parentID)`, `deleteFolder(entryID,recursive)` using the DTOs above. `WailsClient` is the only production implementation now and calls generated bindings. UI components receive this client through a React context; tests inject a behavioral test implementation. No fake runtime success and no localhost fetch adapter. In an ordinary browser without the native runtime, display “Open this build in Wyvern Drive desktop. Browser access is not enabled in this milestone.” and disable metadata controls.

Implement:
- Vault sidebar, “Create local vault” name form, persistent banner “Metadata-only development vault — file storage and encryption are not implemented yet.” No webhook field, “encryption enabled” badge, upload button or nonfunctional future-feature menus.
- Root/nested folder table with Name, Modified, Status; double-click folder navigation and breadcrumb buttons with root/back. Selection is a single row; no Phase 8 multi-select, drag/drop or keyboard-grid implementation.
- New Folder and Rename dialogs with explicit submit/cancel, label associations, keyboard focus and visible inline typed errors. Mutations refresh only after backend success; disable duplicate submits while in flight.
- Move dialog navigates folders with Root/Up and a destination confirmation. Hide the selected source from navigable targets; service remains authoritative for cycles and cross-vault rules.
- Delete confirmation names the folder and requires explicit “Delete permanently”; nonempty-folder rejection offers a second explicit recursive-delete confirmation, not silent recursion. Cancel never calls the mutation.
- Loading/empty/error states; ignore stale asynchronous listing results when user changes vault/folder before completion. Do not show locally fabricated entries while waiting for a commit. After restart select the first vault and its root; persisting navigation settings is unnecessary.

### 6. Make repeatable builds and tests part of the runnable foundation

Add a root Taskfile v3. Sequence dependent steps in `cmds`, not parallel `deps`. Tasks:
- `bindings`: Windows-only generator command above, fails clearly on other platforms.
- `frontend:install`: `npm ci`, `dir: frontend`; on the initial authoring pass use npm install once to create the committed lockfile.
- `frontend:typecheck`, `frontend:test`, `frontend:build`: corresponding npm scripts with `dir: frontend`.
- `server:build`: `go build -o bin/wyvernd[.exe] ./cmd/wyvernd`, host-appropriate suffix. `server:dev`: `go run ./cmd/wyvernd serve {{.CLI_ARGS}}`.
- `desktop:build`: Windows-only; sequential binding generation, frontend typecheck/build, `go build -tags production -o bin/wyvern-drive.exe ./cmd/desktop`. Do not use `-H windowsgui` on the first milestone so startup failures remain observable.
- `desktop:dev`: Windows-only; sequential binding generation, frontend build, `go run ./cmd/desktop {{.CLI_ARGS}}`. Rebuild-on-demand is sufficient; no watcher/configuration generator required.
- `test`: `go test ./...`, frontend typecheck, frontend test. `build`: server build plus desktop build on Windows, server build only on Linux. Use platform filtering, not silent unsupported desktop success.

Root task commands reuse the npm scripts, not divergent compiler options. `build/` holds reproducible build configuration only as needed; generated executables go under ignored `bin/`. Ignore node_modules, dist, binaries, local development data, logs and SQLite sidecars; do not ignore source migrations, go.sum, npm lockfile or generated bindings.

Create CI `.github/workflows/ci.yml` with separate Linux core and Windows native jobs and a frontend job. Verified action tags: `actions/checkout@v7`, `actions/setup-go@v7`, `actions/setup-node@v7`; exact tool versions as above. Linux: `go test ./...`, `go vet ./...`, `go test -race ./...`, headless `CGO_ENABLED=0 go build -o bin/wyvernd ./cmd/wyvernd`. Windows: install pinned Wails CLI, generate bindings, frontend `npm ci`, typecheck/tests/build, `go test ./...`, `go vet ./...`, production desktop build, headless build. Frontend Linux job uses committed generated bindings, `npm ci`, typecheck/tests/build; needs no Go GUI toolchain. No Discord secrets or network integration tests. Check `go list -deps ./cmd/wyvernd` output contains no `github.com/wailsapp/wails` package. CI compiles native desktop; actual interactive Windows smoke below remains required.

README must be accurate for this milestone: prerequisites/pins and installation links, package layout, local metadata-only status, data-directory/flag/environment precedence, Task and direct Go/npm commands, health URL, tests, and separate desktop/headless build requirements. Explain the intended encrypted-drive architecture without claiming encryption/Discord/transfers already work. State Discord is the planned first remote backend, no affiliation, and not a sole backup for irreplaceable data. Full release/deployment/recovery manuals accompany their later behaviors, not fabricated instructions now.

Execution order preserves the user's dependency phases: Step 1 + foundation portion of Step 2 + Step 4 shell and Step 6 build automation establish Phase 0; then the metadata migration and Step 3/tests establish Phase 1; finally Step 5 exposes the already-working metadata behavior. Frontend tool preparation can occur independently of the database work; mutation UI must not precede the tested service.



## Verification

No implementation or tests have run during planning; the repository remains empty. The following are completion checks for execution, not claims of existing behavior.

### Behavior tests to retain

Use the Go standard testing package and temporary on-disk SQLite files. Frontend tests use Vitest/Testing Library through the client seam. Never make a test contact Discord.

1. `internal/validation`: `Photo.jpg` versus `photo.JPG`, composed versus decomposed `é`, and `Straße` versus `STRASSE` produce equivalent keys while preserving display case; `.`, `..`, separators, controls, invalid UTF-8 and oversized names reject. Do not claim accent-insensitive matching.
2. `internal/database`: open/close/reopen persists data; new connections retain foreign-key enforcement; dangling/cross-vault parent insertion rejects; duplicate root names and duplicate child names reject; same name in different folders/vaults succeeds. Exercise actual constraints, not SQL source text.
3. Migration fixtures: fresh DB reaches version 2; version-1 DB containing a setting upgrades and retains it; the backup reopens and contains pre-upgrade data; a deliberately failing pending SQL migration leaves previous schema/version/data intact; changed checksum and unknown newer schema refuse startup. Keep test migration fixtures in `testing/fstest.MapFS`, not production SQL.
4. `internal/filesystem`: create root/nested folders, case-only rename, rename collision rollback, move across parents and back to root, cross-vault/nonfolder/descendant/self destination rejection, nonempty delete rejection, recursive folder-only delete, and full rollback when a descendant has a file/job dependency. Verify IDs, descendants and parent relationships rather than only row counts.
5. `tests/TestMetadataSurvivesRestart`: open application at a fresh temporary data directory, create vault `Personal`, create `Projects/Docs`, rename `Docs` to `Notes`, move `Notes` to root, close application, reopen same directory, and verify the same IDs and final hierarchy. Add a repository transaction storing synthetic file/chunk/job metadata; reopening returns the original records with int64 sizes intact. No bytes are uploaded and synthetic wrapped-key bytes are not advertised as cryptographic validation.
6. `tests/TestMetadataConcurrency`: two service calls racing to create case-equivalent siblings yield exactly one success and one `FILE_CONFLICT`; two application/store instances racing reciprocal folder moves cannot create a cycle. Use barriers, not timing sleeps; one conflicting move must fail with `INVALID_HIERARCHY` after serialization.
7. `internal/database`: injected error after several writes within `WithTx` leaves all writes absent; duplicate `(file_entry_id,chunk_index)` rejects; job compare-and-swap mismatch and writes to terminal jobs reject. Assert no partial progress update on transaction rollback.
8. `server/api`: healthy migrated database => specified 200 JSON; closed/unavailable DB => specified safe 503 JSON; unknown routes and methods rejected. `internal/config`: flags override environment overrides JSON overrides defaults, omitted flags do not erase configured values, unknown/malformed config fails, and nonloopback listener refuses.
9. `cmd/wyvernd`: subprocess tests with temporary data dirs start the compiled command on an ephemeral loopback port, wait for its readiness log and fetch health; port conflict and invalid config exit nonzero without announcing healthy. On Linux, send SIGTERM, wait for a successful exit and reopen its DB. Do not use `os.Process.Signal(os.Interrupt)` to interrupt a Windows child (unsupported); verify graceful Windows shutdown by Ctrl-C through the supervised terminal in the actual-surface smoke. Test actual lifecycle, not a mock Serve call.
10. Frontend: create vault then folder, nested navigation/back, rejected rename leaves old row and shows conflict, move refreshes the tree, cancel delete makes no mutation, explicit recursive-delete confirmation works, stale list response cannot overwrite a newly selected folder, and operation failures re-enable controls. Do not write pixel snapshots or assertions over Tailwind classes.

### Exact commands

Prerequisites: Go 1.27.1, Node 24.21.0/npm, Wails CLI beta.25 and Windows WebView2. Task v3.53.1 is optional for the direct command path. Working directory is repository root unless `--prefix frontend` is present. Use a fresh data directory for smoke checks, never the user's default vault data.

On Windows, after initial dependency/lockfile creation:
```text
wails3 doctor
npm --prefix frontend ci
wails3 generate bindings -ts -d ./frontend/bindings ./cmd/desktop/...
npm --prefix frontend run typecheck
npm --prefix frontend test
npm --prefix frontend run build
go test ./...
go vet ./...
go build -o bin/wyvernd.exe ./cmd/wyvernd
go build -tags production -o bin/wyvern-drive.exe ./cmd/desktop
go list -deps ./cmd/wyvernd
```
The last output must contain no Wails package. Run Go race tests on Linux CI (CGO/compiler available); don't make Windows race testing depend on installing an extra C toolchain. Linux also runs `go test ./...` and `go vet ./...` without GTK/WebKit libraries and builds the daemon with `CGO_ENABLED=0`. A fresh checkout with no dist must successfully generate bindings, build assets and compile production desktop in that order.

### Actual-surface smoke

1. Launch `bin/wyvernd.exe serve --data-dir <fresh-server-dir> --listen 127.0.0.1:9847` under a supervised process. Log readiness only after bind succeeds, using message `HTTP server listening` and actual listener address. Query `http://127.0.0.1:9847/api/v1/health` using `Invoke-RestMethod` in PowerShell (or an HTTP client); expect 200 with `healthy`, `ready`, schema 2. Stop normally, launch with identical flags, expect the same schema without migration duplication. Repeat on Linux with `./bin/wyvernd`, SIGTERM and an HTTP client.
2. Launch the real `bin/wyvern-drive.exe --data-dir <fresh-desktop-dir>`. For automation only, set process-local `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223` (choose 9224 then 9225 if occupied), and attach the browser tool via `app.cdp_url: "http://127.0.0.1:9223"`. Inspect the Wyvern WebView target without navigating it. Microsoft documents both this environment variable and flag: https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/webview-features-flags . Never bake the debugging flag into code, production builds or user configuration.
3. Through the actual Wails UI create `Personal`, then root folder `Projects`, then `Projects/Docs`. Try `projects` at root and observe conflict with no duplicate. Rename `Docs` to `Notes`, move it to root using the destination picker. Observe `Projects` and `Notes` at root; neither has changed identity. Cancel a deletion and verify the row persists. Capture the actual window content.
4. Close the native window, confirm process exits, relaunch the same executable/data directory, and verify the same vault/folder tree from the UI. Re-enter Projects, create a nested child, return to root and recursively delete Projects after explicit confirmation. Restart again: Notes persists and Projects/child do not. Confirm the UI never claims encryption or working file storage.
5. Run the production executable from outside the repository using its absolute path; embedded assets must still render. No frontend dev server should be running. Headless health server need not run for any native metadata operation.

If CDP attachment is unavailable, launch the actual desktop and perform the same actions manually using WebView2 DevTools/native UI; backend tests are not a substitute for the native smoke. If no interactive desktop is accessible at all, record that exact missing verification prerequisite and do not claim “desktop launches” based only on compilation or a mocked browser preview.

## Assumptions and contingencies

- The first implementation task limits this delivery to Phase 0/1. “Local vault” here is an explicitly labeled metadata-only development namespace; it has no fake encrypted key or operational blob backend. This follows the requested first-milestone boundary before encryption and storage-backend implementation. No real file payload is accepted or stored unencrypted.
- No public repository owner/module URL was supplied. Use local module name `wyvern-drive`; publishing under an owned import path is not required to build either executable.
- The Wails v3 requirement takes precedence over availability of a stable release: pin beta.25 and disclose it. If a toolchain or WebView2 prerequisite is missing, install/download the exact official user-local prerequisite during execution where permitted; do not downgrade libraries, substitute Electron/Wails v2, or declare an unlaunched desktop successful.
- Runtime/package pins were verified during planning; reproduce these pins on execution instead of following new latest releases. If the dependency registry/network is unavailable, continue independent source/model work and report that dependency acquisition is blocking runtime proof; never fabricate a lockfile or vendor stub packages.
- Native build and bindings generation run on Windows. On a Linux-only execution host, complete the headless/core/frontend work and run the Windows job on an available Windows runner; native interactive proof still needs Windows access. The Windows desktop limitation does not permit dropping the headless Linux build.
