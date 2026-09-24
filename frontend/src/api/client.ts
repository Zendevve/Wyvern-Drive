import type { EntryDTO, VaultDTO } from "../types/dto";

/**
 * Domain error codes shared with the Go layers (internal/domain/errors.go).
 * The facade marshals exactly these codes into the error envelope every
 * binding rejection carries; the UI surfaces code + message verbatim.
 */
export type ClientErrorCode =
  | "INVALID_NAME"
  | "NOT_FOUND"
  | "FILE_CONFLICT"
  | "INVALID_PARENT"
  | "INVALID_HIERARCHY"
  | "FOLDER_NOT_EMPTY"
  | "INVALID_STATE"
  | "OPERATION_UNAVAILABLE"
  | "DATABASE_UNAVAILABLE"
  | "INVALID_CONFIG";

/** Every code above, for validating the envelope shape on catch. */
export const CLIENT_ERROR_CODES: readonly ClientErrorCode[] = [
  "INVALID_NAME",
  "NOT_FOUND",
  "FILE_CONFLICT",
  "INVALID_PARENT",
  "INVALID_HIERARCHY",
  "FOLDER_NOT_EMPTY",
  "INVALID_STATE",
  "OPERATION_UNAVAILABLE",
  "DATABASE_UNAVAILABLE",
  "INVALID_CONFIG",
];

/** Typed failure from a metadata operation. */
export class ClientError extends Error {
  readonly code: ClientErrorCode;
  readonly details: Record<string, unknown>;

  constructor(
    code: ClientErrorCode,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ClientError";
    this.code = code;
    this.details = details;
  }
}

/**
 * The one test seam. UI components talk only to this interface (via context);
 * production uses WailsClient, tests inject a behavioral double. There is no
 * fake-success adapter and no localhost fetch adapter (ADR-0006).
 */
export interface WyvernClient {
  createLocalVault(name: string): Promise<VaultDTO>;
  listVaults(): Promise<VaultDTO[]>;
  getVault(id: string): Promise<VaultDTO>;
  listEntries(
    vaultID: string,
    parentID: string | null,
  ): Promise<EntryDTO[]>;
  createFolder(
    vaultID: string,
    parentID: string | null,
    name: string,
  ): Promise<EntryDTO>;
  renameEntry(entryID: string, name: string): Promise<EntryDTO>;
  moveEntry(entryID: string, parentID: string | null): Promise<EntryDTO>;
  deleteFolder(entryID: string, recursive: boolean): Promise<void>;
}
