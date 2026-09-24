/**
 * DTO shapes mirror the Go presentation facade (internal/app/dto.go).
 *
 * They are plain interfaces (not the generated binding classes) so tests can
 * construct values without the native runtime. Field-for-field compatible
 * with the generated EntryDTO/VaultDTO, except kind/state/status are narrowed
 * to the Go enum unions.
 */
export type VaultState = "metadata_only" | "ready";

export type EntryKind = "file" | "folder";

export type EntryStatus =
  | "available"
  | "uploading"
  | "upload_failed"
  | "deleting"
  | "delete_failed"
  | "corrupt";

export interface VaultDTO {
  id: string;
  name: string;
  backend_type: string;
  state: VaultState;
  created_at: string;
  updated_at: string;
}

export interface EntryDTO {
  id: string;
  vault_id: string;
  parent_id: string | null;
  kind: EntryKind;
  name: string;
  status: EntryStatus;
  /**
   * Decimal string rendering of the int64 size, so large values survive JSON
   * exactly. Display as-is (or with digit grouping); never Number() it.
   */
  size: string;
  mime_type: string | null;
  /** UTC RFC3339Nano timestamp string. */
  created_at: string;
  /** UTC RFC3339Nano timestamp string. */
  updated_at: string;
}
