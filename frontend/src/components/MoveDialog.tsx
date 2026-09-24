import { useEffect, useRef, useState } from "react";
import type { ClientError } from "../api/client";
import { useWyvernClient } from "../api/context";
import { toClientError } from "../api/wails-client";
import type { EntryDTO } from "../types/dto";
import { FormError, Modal } from "./Modal";

/**
 * Destination picker for moving one entry. Navigates the same vault with
 * Root/Up/trail controls; the selected source is hidden from navigable
 * targets. The service stays authoritative on cycles and cross-vault rules:
 * this dialog never attempts a cross-vault move and surfaces backend
 * rejections verbatim.
 */
export function MoveDialog({
  vaultID,
  source,
  onClose,
  onMoved,
}: {
  vaultID: string;
  source: EntryDTO;
  onClose: () => void;
  onMoved: () => void;
}) {
  const client = useWyvernClient();
  const [destId, setDestId] = useState<string | null>(null);
  const [trail, setTrail] = useState<{ id: string; name: string }[]>([]);
  const [folders, setFolders] = useState<EntryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ClientError | null>(null);
  const [busy, setBusy] = useState(false);
  const [moveError, setMoveError] = useState<ClientError | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const my = ++seq.current;
    setLoading(true);
    setError(null);
    client.listEntries(vaultID, destId).then(
      (list) => {
        if (seq.current !== my) return;
        setFolders(
          list.filter((e) => e.kind === "folder" && e.id !== source.id),
        );
        setLoading(false);
      },
      (err) => {
        if (seq.current !== my) return;
        setError(toClientError(err));
        setLoading(false);
      },
    );
  }, [client, vaultID, destId, source.id]);

  function openFolder(folder: EntryDTO) {
    setTrail((prev) => [...prev, { id: folder.id, name: folder.name }]);
    setDestId(folder.id);
  }

  function goRoot() {
    setTrail([]);
    setDestId(null);
  }

  function goUp() {
    setTrail((prev) => {
      const next = prev.slice(0, -1);
      setDestId(next.length === 0 ? null : next[next.length - 1].id);
      return next;
    });
  }

  function goTrail(id: string) {
    setTrail((prev) => {
      const index = prev.findIndex((s) => s.id === id);
      const next = index < 0 ? prev : prev.slice(0, index + 1);
      setDestId(next.length === 0 ? null : next[next.length - 1].id);
      return next;
    });
  }

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setMoveError(null);
    try {
      await client.moveEntry(source.id, destId);
      onMoved();
    } catch (err) {
      setMoveError(toClientError(err));
    } finally {
      setBusy(false);
    }
  }

  const destination = trail.length === 0 ? "Root" : trail[trail.length - 1].name;

  return (
    <Modal title={`Move “${source.name}”`} onClose={() => !busy && onClose()}>
      <p className="mb-2 text-sm">
        Destination: <strong>{destination}</strong>
      </p>
      <div className="mb-2 flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={goRoot}
          className="rounded border border-stone-300 px-2 py-1 text-sm hover:bg-stone-100"
        >
          Root
        </button>
        <button
          type="button"
          onClick={goUp}
          disabled={trail.length === 0}
          className="rounded border border-stone-300 px-2 py-1 text-sm hover:bg-stone-100 disabled:opacity-50"
        >
          Up
        </button>
        {trail.map((segment) => (
          <span key={segment.id} className="flex items-center gap-1">
            <span aria-hidden="true" className="text-sm text-stone-400">
              /
            </span>
            <button
              type="button"
              onClick={() => goTrail(segment.id)}
              className="rounded px-2 py-1 text-sm hover:bg-stone-100"
            >
              {segment.name}
            </button>
          </span>
        ))}
      </div>
      {loading ? (
        <p role="status" className="py-4 text-center text-sm text-stone-500">
          Loading folders…
        </p>
      ) : error ? (
        <p role="alert" className="py-2 text-sm text-red-700">
          {error.code}: {error.message}
        </p>
      ) : folders.length === 0 ? (
        <p className="py-4 text-center text-sm text-stone-500">
          No subfolders here.
        </p>
      ) : (
        <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
          {folders.map((folder) => (
            <li key={folder.id}>
              <button
                type="button"
                onClick={() => openFolder(folder)}
                className="w-full rounded px-3 py-1.5 text-left text-sm hover:bg-stone-100"
              >
                {folder.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {moveError && (
        <FormError code={moveError.code} message={moveError.message} />
      )}
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
          disabled={busy || loading || error !== null}
          onClick={() => void confirm()}
          className="rounded bg-stone-800 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {busy ? "Moving…" : "Move here"}
        </button>
      </div>
    </Modal>
  );
}
