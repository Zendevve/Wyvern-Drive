import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ClientError, type WyvernClient } from "./api/client";
import { WyvernClientProvider } from "./api/context";
import { toClientError } from "./api/wails-client";
import { BROWSER_DISABLED_MESSAGE } from "./api/native";
import { Shell } from "./App";
import type { EntryDTO, VaultDTO } from "./types/dto";

const TS = "2026-09-24T12:00:00.000000000Z";

function renderShell(client: WyvernClient) {
  Object.assign(window, { chrome: { webview: { postMessage: () => {} } } });
  return render(
    <WyvernClientProvider client={client}>
      <Shell />
    </WyvernClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, "chrome");
});

function vault(id: string, name: string): VaultDTO {
  return {
    id,
    name,
    backend_type: "local-test",
    state: "metadata_only",
    created_at: TS,
    updated_at: TS,
  };
}

function folder(
  id: string,
  vaultID: string,
  parentID: string | null,
  name: string,
): EntryDTO {
  return {
    id,
    vault_id: vaultID,
    parent_id: parentID,
    kind: "folder",
    name,
    status: "available",
    size: "0",
    mime_type: null,
    created_at: TS,
    updated_at: TS,
  };
}

function baseClient(overrides: Partial<WyvernClient> = {}): WyvernClient {
  return {
    createLocalVault: async (name: string) => vault("vault-new", name),
    listVaults: async () => [],
    getVault: async (id: string) => vault(id, "v"),
    listEntries: async () => [],
    createFolder: async (
      folderVaultID: string,
      parentID: string | null,
      name: string,
    ) => folder("entry-new", folderVaultID, parentID, name),
    renameEntry: async (entryID: string, name: string) =>
      folder(entryID, "vault-1", null, name),
    moveEntry: async (entryID: string, parentID: string | null) =>
      folder(entryID, "vault-1", parentID, "moved"),
    deleteFolder: async () => {},
    ...overrides,
  };
}

describe("toClientError", () => {
  it("keeps the envelope code/message and never parses prose", () => {
    const err = new Error("entry name already exists", {
      cause: JSON.stringify({
        code: "FILE_CONFLICT",
        message: "entry name already exists",
        details: {},
      }),
    });
    const converted = toClientError(err);
    expect(converted).toBeInstanceOf(ClientError);
    expect(converted.code).toBe("FILE_CONFLICT");
    expect(converted.message).toBe("entry name already exists");
  });

  it("falls back to DATABASE_UNAVAILABLE on missing cause", () => {
    const converted = toClientError(new Error("boom"));
    expect(converted.code).toBe("DATABASE_UNAVAILABLE");
    expect(converted.message).toBe("database operation failed");
  });

  it("falls back to DATABASE_UNAVAILABLE on malformed cause", () => {
    const converted = toClientError(
      new Error("nope", { cause: "{not json" }),
    );
    expect(converted.code).toBe("DATABASE_UNAVAILABLE");
  });

  it("falls back to DATABASE_UNAVAILABLE on unknown code", () => {
    const converted = toClientError(
      new Error("weird", {
        cause: JSON.stringify({ code: "NOPE", message: "x", details: {} }),
      }),
    );
    expect(converted.code).toBe("DATABASE_UNAVAILABLE");
  });
});

describe("stale listing safety", () => {
  it("a superseded folder response cannot overwrite the current listing", async () => {
    const v = vault("vault-1", "Personal");
    const projects = folder("entry-1", v.id, null, "Projects");
    const docs = folder("entry-2", v.id, projects.id, "Docs");
    let releaseProjects!: (list: EntryDTO[]) => void;
    const projectsCall = new Promise<EntryDTO[]>((resolve) => {
      releaseProjects = resolve;
    });
    let rootCalls = 0;
    const client = baseClient({
      listVaults: async () => [v],
      listEntries: async (_vaultID: string, parentID: string | null) => {
        if (parentID === projects.id) return projectsCall;
        rootCalls++;
        // Second and later root loads resolve at once; the first is instant.
        if (rootCalls === 1) return [projects];
        return [projects];
      },
    });
    renderShell(client);

    expect(await screen.findByText("Projects")).toBeVisible();
    // Open Projects (request pending), then go Back before it resolves:
    // the newer root load must win even when the stale one lands last.
    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByText("Projects")).toBeVisible();
    releaseProjects([docs]);
    await waitFor(() =>
      expect(screen.queryByText("Docs")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Projects")).toBeVisible();
  });
});

describe("operation failures re-enable controls", () => {
  it("a rejected folder create leaves the submit button enabled", async () => {
    const v = vault("vault-1", "Personal");
    const client = baseClient({
      listVaults: async () => [v],
      createFolder: async () => {
        throw new ClientError("INVALID_NAME", "name is not valid");
      },
    });
    renderShell(client);

    await screen.findByRole("button", { name: "New folder" });
    fireEvent.click(screen.getByRole("button", { name: "New folder" }));
    fireEvent.change(screen.getByLabelText("Folder name"), {
      target: { value: "." },
    });
    const submit = screen.getByRole("button", { name: "Create" });
    fireEvent.click(submit);

    expect(await screen.findByRole("alert")).toHaveTextContent("INVALID_NAME");
    await waitFor(() => expect(submit).toBeEnabled());
  });
});

describe("browser-disabled mode", () => {
  it("shows the exact message with metadata controls disabled", async () => {
    const client = baseClient({ listVaults: async () => [] });
    render(
      <WyvernClientProvider client={client}>
        <Shell />
      </WyvernClientProvider>,
    );
    // jsdom has no WebView2/WKWebView/Android channels, so the native
    // runtime is absent and the disabled banner must render verbatim.
    expect(await screen.findByRole("alert")).toHaveTextContent(
      BROWSER_DISABLED_MESSAGE,
    );
    expect(
      screen.getByRole("button", { name: "Create local vault" }),
    ).toBeDisabled();
  });
});

describe("vault retry selection", () => {
  it("retry keeps the selected vault instead of resetting to the oldest", async () => {
    const a = vault("vault-1", "A");
    const b = vault("vault-2", "B");
    Object.assign(window, { chrome: { webview: { postMessage: () => {} } } });
    const view = render(
      <WyvernClientProvider client={baseClient({ listVaults: async () => [a, b] })}>
        <Shell />
      </WyvernClientProvider>,
    );
    expect(await screen.findByRole("button", { name: "A" })).toBeVisible();
    // Select the non-oldest vault, then swap in a flaky client.
    fireEvent.click(screen.getByRole("button", { name: "B" }));
    let fail = true;
    const flaky = baseClient({
      listVaults: async () => {
        if (fail) {
          throw new ClientError("DATABASE_UNAVAILABLE", "database operation failed");
        }
        return [a, b];
      },
    });
    view.rerender(
      <WyvernClientProvider client={flaky}>
        <Shell />
      </WyvernClientProvider>,
    );
    // New client fails: the error with Retry appears; retry still fails.
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "DATABASE_UNAVAILABLE",
    );
    // Retry succeeds: B stays selected even though A is oldest.
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    const bButton = await screen.findByRole("button", { name: "B" });
    expect(bButton).toBeVisible();
    expect(bButton.getAttribute("aria-current")).toBe("true");
    expect(
      screen.getByRole("button", { name: "A" }).getAttribute("aria-current"),
    ).toBe("false");
  });
});
