import { useState } from "react";
import type { ClientError } from "../api/client";
import { useWyvernClient } from "../api/context";
import { toClientError } from "../api/wails-client";
import type { EntryDTO } from "../types/dto";
import { FormError, Modal } from "./Modal";

/**
 * Two-step folder delete. The first confirmation deletes non-recursively;
 * when the backend refuses with FOLDER_NOT_EMPTY, a second explicit
 * confirmation offers the recursive delete. Recursion is never silent and
 * Cancel never mutates.
 */
export function DeleteDialog({
  entry,
  onClose,
  onDeleted,
}: {
  entry: EntryDTO;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const client = useWyvernClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ClientError | null>(null);
  const [refusedNonEmpty, setRefusedNonEmpty] = useState(false);

  async function remove(recursive: boolean) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await client.deleteFolder(entry.id, recursive);
      onDeleted();
    } catch (err) {
      const failure = toClientError(err);
      if (!recursive && failure.code === "FOLDER_NOT_EMPTY") {
        setRefusedNonEmpty(true);
      } else {
        setError(failure);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Delete “${entry.name}”?`} onClose={() => !busy && onClose()}>
      {refusedNonEmpty ? (
        <>
          <p className="text-sm">
            “{entry.name}” is not empty. To delete it, everything inside must
            go too.
          </p>
          {error && <FormError code={error.code} message={error.message} />}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="rounded border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-100"
            >
              Cancel
            </button>
            <button
              type="button"
              data-autofocus
              disabled={busy}
              onClick={() => void remove(true)}
              className="rounded bg-red-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              {busy
                ? "Deleting…"
                : "Delete permanently including contents"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm">
            Delete the folder “{entry.name}” permanently? This cannot be
            undone.
          </p>
          {error && <FormError code={error.code} message={error.message} />}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="rounded border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-100"
            >
              Cancel
            </button>
            <button
              type="button"
              data-autofocus
              disabled={busy}
              onClick={() => void remove(false)}
              className="rounded bg-red-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              {busy ? "Deleting…" : "Delete permanently"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
