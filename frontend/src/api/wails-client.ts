import * as MetadataService from "../../bindings/wyvern-drive/internal/app/metadataservice.js";
import type {
  EntryDTO as BindingEntry,
  VaultDTO as BindingVault,
} from "../../bindings/wyvern-drive/internal/app/models.js";
import type { EntryDTO, VaultDTO } from "../types/dto";
import {
  CLIENT_ERROR_CODES,
  ClientError,
  type ClientErrorCode,
  type WyvernClient,
} from "./client";

interface ErrorEnvelope {
  code: ClientErrorCode;
  message: string;
  details: Record<string, unknown>;
}

function isEnvelope(value: unknown): value is ErrorEnvelope {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["code"] === "string" &&
    (CLIENT_ERROR_CODES as readonly string[]).includes(v["code"]) &&
    typeof v["message"] === "string" &&
    (typeof v["details"] === "object" &&
      v["details"] !== null &&
      !Array.isArray(v["details"]))
  );
}

/**
 * Convert a binding rejection into a ClientError. The Wails v3 Go transport
 * puts the service's MarshalError output (internal/app/dto.go: a JSON string
 * {"code","message","details"}) on the rejection's `cause`; the human
 * message is never parsed. Anything missing or malformed is a safe
 * DATABASE_UNAVAILABLE, matching the facade's own fallback.
 */
function readCause(err: unknown): unknown {
  if (typeof err !== "object" || err === null) return undefined;
  if (!("cause" in err)) return undefined;
  return err.cause;
}

export function toClientError(err: unknown): ClientError {
  if (err instanceof ClientError) return err;
  const cause = readCause(err);
  if (typeof cause === "string" && cause.length > 0) {
    try {
      const parsed: unknown = JSON.parse(cause);
      if (isEnvelope(parsed)) {
        return new ClientError(
          parsed.code,
          parsed.message,
          parsed.details,
        );
      }
    } catch {
      // fall through to the safe default below
    }
  }
  return new ClientError(
    "DATABASE_UNAVAILABLE",
    "database operation failed",
  );
}

function toVaultDTO(v: BindingVault): VaultDTO {
  return {
    id: v.id,
    name: v.name,
    backend_type: v.backend_type,
    state: v.state as VaultDTO["state"],
    created_at: v.created_at,
    updated_at: v.updated_at,
  };
}

function toEntryDTO(e: BindingEntry): EntryDTO {
  return {
    id: e.id,
    vault_id: e.vault_id,
    parent_id: e.parent_id,
    kind: e.kind as EntryDTO["kind"],
    name: e.name,
    status: e.status as EntryDTO["status"],
    size: e.size,
    mime_type: e.mime_type,
    created_at: e.created_at,
    updated_at: e.updated_at,
  };
}

async function call<T>(fn: () => PromiseLike<T>): Promise<T> {
  try {
    // Generated bindings return CancellablePromise, a thenable: await works.
    return await fn();
  } catch (err) {
    throw toClientError(err);
  }
}

/**
 * The only production WyvernClient. Every op delegates to the generated
 * MetadataService bindings using their emitted import paths and method names.
 */
export class WailsClient implements WyvernClient {
  createLocalVault(name: string): Promise<VaultDTO> {
    return call(() => MetadataService.CreateLocalVault(name)).then(toVaultDTO);
  }

  listVaults(): Promise<VaultDTO[]> {
    return call(() => MetadataService.ListVaults()).then((list) =>
      list.map(toVaultDTO),
    );
  }

  getVault(id: string): Promise<VaultDTO> {
    return call(() => MetadataService.GetVault(id)).then(toVaultDTO);
  }

  listEntries(vaultID: string, parentID: string | null): Promise<EntryDTO[]> {
    return call(() => MetadataService.ListEntries(vaultID, parentID)).then(
      (list) => list.map(toEntryDTO),
    );
  }

  createFolder(
    vaultID: string,
    parentID: string | null,
    name: string,
  ): Promise<EntryDTO> {
    return call(() => MetadataService.CreateFolder(vaultID, parentID, name)).then(
      toEntryDTO,
    );
  }

  renameEntry(entryID: string, name: string): Promise<EntryDTO> {
    return call(() => MetadataService.RenameEntry(entryID, name)).then(
      toEntryDTO,
    );
  }

  moveEntry(entryID: string, parentID: string | null): Promise<EntryDTO> {
    return call(() => MetadataService.MoveEntry(entryID, parentID)).then(
      toEntryDTO,
    );
  }

  async deleteFolder(entryID: string, recursive: boolean): Promise<void> {
    await call(() => MetadataService.DeleteFolder(entryID, recursive));
  }
}
