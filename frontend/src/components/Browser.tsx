import { useEffect, useRef, useState } from "react";
import type { ClientError } from "../api/client";
import { useWyvernClient } from "../api/context";
import { toClientError } from "../api/wails-client";
import type { EntryDTO, VaultDTO } from "../types/dto";
import { DeleteDialog } from "./DeleteDialog";
import { NewFolderDialog, RenameDialog } from "./EntryDialogs";
import { Breadcrumb, FolderTable, type BreadcrumbSegment } from "./FolderView";
import { MoveDialog } from "./MoveDialog";

type DialogState =
  | { kind: "new-folder" }
  | { kind: "rename"; entry: EntryDTO }
  | { kind: "move"; entry: EntryDTO }
  | { kind: "delete"; entry: EntryDTO }
  | null;

/**
 * Browser view: the current folder of one vault. Stale-guard shape: one
 * monotonically increasing sequence shared by every listing request in this
 * component (root load, navigate, refresh). Each completion checks its
 * sequence against the current value and is dropped when a newer request has
 * started — A→B→A included, since only the newest completion survives.
 * Nothing renders optimistically: mutations refresh only after success.
 */
export function Browser({
  vault,
  disabled,
}: {
  vault: VaultDTO | null;
  disabled: boolean;
}) {
  const client = useWyvernClient();
  const [folderId, setFolderId] = useState<string | null>(null);
  const [trail, setTrail] = useState<BreadcrumbSegment[]>([]);
  const [entries, setEntries] = useState<EntryDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ClientError | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const seq = useRef(0);

  function load(vaultID: string, parentID: string | null) {
    const my = ++seq.current;
    setLoading(true);
    setError(null);
    client.listEntries(vaultID, parentID).then(
      (list) => {
        if (seq.current !== my) return;
        setEntries(list);
        setLoading(false);
      },
      (err) => {
        if (seq.current !== my) return;
        setError(toClientError(err));
        setLoading(false);
      },
    );
  }

  // Vault change (including first selection): reset to the vault root.
  useEffect(() => {
    if (vault === null) {
      seq.current++;
      setFolderId(null);
      setTrail([]);
      setEntries([]);
      setError(null);
      setLoading(false);
      setSelectedEntryId(null);
      return;
    }
    setFolderId(null);
    setTrail([]);
    setSelectedEntryId(null);
    load(vault.id, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, vault?.id]);

  function navigateTo(id: string | null, segment?: BreadcrumbSegment) {
    if (vault === null) return;
    setFolderId(id);
    setSelectedEntryId(null);
    setTrail((prev) => {
      if (id === null) return [];
      if (segment !== undefined) return [...prev, segment];
      const index = prev.findIndex((s) => s.id === id);
      return index < 0 ? prev : prev.slice(0, index + 1);
    });
    load(vault.id, id);
  }

  function goBack() {
    if (trail.length === 0) return;
    const parent = trail.slice(0, -1);
    const target = parent.length === 0 ? null : parent[parent.length - 1].id;
    setTrail(parent);
    if (vault === null) return;
    setFolderId(target);
    setSelectedEntryId(null);
    load(vault.id, target);
  }

  function refresh() {
    if (vault === null) return;
    load(vault.id, folderId);
    setSelectedEntryId(null);
  }

  const selectedEntry = entries.find((e) => e.id === selectedEntryId) ?? null;

  return (
    <section aria-label="Folders" className="flex min-w-0 flex-1 flex-col gap-3">
      <Breadcrumb
        trail={trail}
        disabled={disabled || vault === null}
        onNavigate={(id) => navigateTo(id)}
        onBack={goBack}
      />
      {vault === null ? (
        <p className="py-6 text-center text-sm text-stone-500">
          Select a vault.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => setDialog({ kind: "new-folder" })}
              className="rounded border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-100 disabled:opacity-50"
            >
              New folder
            </button>
            <button
              type="button"
              disabled={disabled || selectedEntry === null}
              onClick={() =>
                selectedEntry && setDialog({ kind: "rename", entry: selectedEntry })
              }
              className="rounded border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-100 disabled:opacity-50"
            >
              Rename
            </button>
            <button
              type="button"
              disabled={
                disabled ||
                selectedEntry === null ||
                selectedEntry.kind !== "folder"
              }
              onClick={() =>
                selectedEntry && setDialog({ kind: "move", entry: selectedEntry })
              }
              className="rounded border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-100 disabled:opacity-50"
            >
              Move
            </button>
            <button
              type="button"
              disabled={
                disabled ||
                selectedEntry === null ||
                selectedEntry.kind !== "folder"
              }
              onClick={() =>
                selectedEntry && setDialog({ kind: "delete", entry: selectedEntry })
              }
              className="rounded border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-100 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
          {loading ? (
            <p role="status" className="py-6 text-center text-sm text-stone-500">
              Loading…
            </p>
          ) : error ? (
            <div>
              <p role="alert" className="py-2 text-sm text-red-700">
                {error.code}: {error.message}
              </p>
              <button
                type="button"
                onClick={refresh}
                className="rounded border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-100"
              >
                Retry
              </button>
            </div>
          ) : (
            <FolderTable
              entries={entries}
              selectedId={selectedEntryId}
              onSelect={setSelectedEntryId}
              onOpenFolder={(entry) =>
                navigateTo(entry.id, { id: entry.id, name: entry.name })
              }
            />
          )}
        </>
      )}
      {dialog?.kind === "new-folder" && vault !== null && (
        <NewFolderDialog
          vaultID={vault.id}
          parentID={folderId}
          onClose={() => setDialog(null)}
          onCreated={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
      {dialog?.kind === "rename" && (
        <RenameDialog
          entry={dialog.entry}
          onClose={() => setDialog(null)}
          onRenamed={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
      {dialog?.kind === "move" && vault !== null && (
        <MoveDialog
          vaultID={vault.id}
          source={dialog.entry}
          onClose={() => setDialog(null)}
          onMoved={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
      {dialog?.kind === "delete" && (
        <DeleteDialog
          entry={dialog.entry}
          onClose={() => setDialog(null)}
          onDeleted={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
    </section>
  );
}
