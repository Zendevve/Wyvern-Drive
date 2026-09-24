import { useState } from "react";
import type { ClientError } from "../api/client";
import { useWyvernClient } from "../api/context";
import { toClientError } from "../api/wails-client";
import type { VaultDTO } from "../types/dto";
import { FormError, Modal } from "./Modal";

export function VaultSidebar({
  vaults,
  selectedId,
  onSelect,
  onCreated,
  disabled,
}: {
  vaults: VaultDTO[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreated: (vault: VaultDTO) => void;
  disabled: boolean;
}) {
  const client = useWyvernClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ClientError | null>(null);

  async function submit() {
    if (busy || disabled) return;
    setBusy(true);
    setError(null);
    try {
      const vault = await client.createLocalVault(name);
      setName("");
      setOpen(false);
      onCreated(vault);
    } catch (err) {
      setError(toClientError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside aria-label="Vaults" className="flex w-60 flex-col gap-3">
      <p className="rounded border border-stone-200 bg-stone-50 px-3 py-2 text-xs leading-relaxed text-stone-600">
        Metadata-only development vault — file storage and encryption are not
        implemented yet.
      </p>
      {vaults.length === 0 ? (
        <p className="text-sm text-stone-500">No vaults yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {vaults.map((vault) => (
            <li key={vault.id}>
              <button
                type="button"
                aria-current={vault.id === selectedId}
                disabled={disabled}
                onClick={() => onSelect(vault.id)}
                className={
                  vault.id === selectedId
                    ? "w-full rounded bg-stone-800 px-3 py-1.5 text-left text-sm text-white"
                    : "w-full rounded px-3 py-1.5 text-left text-sm hover:bg-stone-100"
                }
              >
                {vault.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setError(null);
          setName("");
          setOpen(true);
        }}
        className="rounded border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-100 disabled:opacity-50"
      >
        Create local vault
      </button>
      {open && (
        <Modal title="Create local vault" onClose={() => !busy && setOpen(false)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <label htmlFor="create-vault-name" className="block text-sm font-medium">
              Vault name
            </label>
            <input
              id="create-vault-name"
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
                onClick={() => setOpen(false)}
                className="rounded border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || disabled}
                className="rounded bg-stone-800 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                {busy ? "Creating…" : "Create"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </aside>
  );
}
