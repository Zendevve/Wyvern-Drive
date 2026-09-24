import { useState } from "react";
import type { ClientError } from "../api/client";
import { useWyvernClient } from "../api/context";
import { toClientError } from "../api/wails-client";
import type { EntryDTO } from "../types/dto";
import { FormError, Modal } from "./Modal";

export function NewFolderDialog({
  vaultID,
  parentID,
  onClose,
  onCreated,
}: {
  vaultID: string;
  parentID: string | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const client = useWyvernClient();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ClientError | null>(null);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await client.createFolder(vaultID, parentID, name);
      onCreated();
    } catch (err) {
      setError(toClientError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="New folder" onClose={() => !busy && onClose()}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label htmlFor="new-folder-name" className="block text-sm font-medium">
          Folder name
        </label>
        <input
          id="new-folder-name"
          data-autofocus
          type="text"
          value={name}
          disabled={busy}
          onChange={(event) => setName(event.target.value)}
          className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm focus:outline-2"
        />
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
            type="submit"
            disabled={busy}
            className="rounded bg-stone-800 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function RenameDialog({
  entry,
  onClose,
  onRenamed,
}: {
  entry: EntryDTO;
  onClose: () => void;
  onRenamed: () => void;
}) {
  const client = useWyvernClient();
  const [name, setName] = useState(entry.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ClientError | null>(null);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await client.renameEntry(entry.id, name);
      onRenamed();
    } catch (err) {
      setError(toClientError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Rename “${entry.name}”`} onClose={() => !busy && onClose()}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label htmlFor="rename-entry-name" className="block text-sm font-medium">
          New name
        </label>
        <input
          id="rename-entry-name"
          data-autofocus
          type="text"
          value={name}
          disabled={busy}
          onChange={(event) => setName(event.target.value)}
          className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm focus:outline-2"
        />
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
            type="submit"
            disabled={busy}
            className="rounded bg-stone-800 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {busy ? "Renaming…" : "Rename"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
