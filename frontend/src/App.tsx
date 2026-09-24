import { useEffect, useMemo, useRef, useState } from "react";
import type { ClientError } from "./api/client";
import { useWyvernClient, WyvernClientProvider } from "./api/context";
import { BROWSER_DISABLED_MESSAGE, isNativeRuntime } from "./api/native";
import { WailsClient, toClientError } from "./api/wails-client";
import { Browser } from "./components/Browser";
import { VaultSidebar } from "./components/VaultSidebar";
import type { VaultDTO } from "./types/dto";

const BROWSER_MESSAGE = BROWSER_DISABLED_MESSAGE;

export function Shell() {
  const client = useWyvernClient();
  const [vaults, setVaults] = useState<VaultDTO[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ClientError | null>(null);
  const seq = useRef(0);
  const native = useMemo(() => isNativeRuntime(), []);

  useEffect(() => {
    const my = ++seq.current;
    setLoading(true);
    setError(null);
    client.listVaults().then(
      (list) => {
        if (seq.current !== my) return;
        setVaults(list);
        setSelectedId((prev) =>
          prev !== null && list.some((v) => v.id === prev)
            ? prev
            : (list[0]?.id ?? null),
        );
        setLoading(false);
      },
      (err) => {
        if (seq.current !== my) return;
        setError(toClientError(err));
        setLoading(false);
      },
    );
  }, [client]);

  const selectedVault = vaults.find((v) => v.id === selectedId) ?? null;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold tracking-tight">Wyvern Drive</h1>
      {!native && (
        <p role="alert" className="rounded border border-stone-300 bg-stone-100 px-3 py-2 text-sm">
          {BROWSER_MESSAGE}
        </p>
      )}
      {loading ? (
        <p role="status" className="text-sm text-stone-500">
          Loading vaults…
        </p>
      ) : error ? (
        <div>
          <p role="alert" className="text-sm text-red-700">
            {error.code}: {error.message}
          </p>
          <button
            type="button"
            onClick={() => {
              const my = ++seq.current;
              setLoading(true);
              setError(null);
              client.listVaults().then(
                (list) => {
                  if (seq.current !== my) return;
                  setVaults(list);
                  setSelectedId((prev) =>
                    prev !== null && list.some((v) => v.id === prev)
                      ? prev
                      : (list[0]?.id ?? null),
                  );
                  setLoading(false);
                },
                (err) => {
                  if (seq.current !== my) return;
                  setError(toClientError(err));
                  setLoading(false);
                },
              );
            }}
            className="mt-2 rounded border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-100"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-6 md:flex-row">
          <VaultSidebar
            vaults={vaults}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onCreated={(vault) => {
              setVaults((prev) => [...prev, vault]);
              setSelectedId(vault.id);
            }}
            disabled={!native}
          />
          <Browser vault={selectedVault} disabled={!native} />
        </div>
      )}
      <p className="border-t border-stone-200 pt-3 text-xs text-stone-500">
        Metadata-only development vault — file storage and encryption are not
        implemented yet.
      </p>
    </main>
  );
}

const productionClient = new WailsClient();

export default function App() {
  return (
    <WyvernClientProvider client={productionClient}>
      <Shell />
    </WyvernClientProvider>
  );
}
