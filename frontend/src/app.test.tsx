import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClientError, type WyvernClient } from "./api/client";
import { WyvernClientProvider } from "./api/context";
import { Shell } from "./App";
import type { EntryDTO, VaultDTO } from "./types/dto";

const TS = "2026-09-24T12:00:00.000000000Z";

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

/**
 * Behavioral in-memory double behind the single WyvernClient seam.
 * Recording doubles below wrap or replace individual methods.
 */
function makeStore(initial: { vaults?: VaultDTO[]; entries?: EntryDTO[] } = {}) {
  const state = {
    vaults: initial.vaults ?? [],
    entries: initial.entries ?? [],
    vaultSeq: 0,
    entrySeq: 0,
  };
  const client: WyvernClient = {
    createLocalVault: async (name: string) => {
      const v = vault(`vault-${++state.vaultSeq}`, name);
      state.vaults.push(v);
      return v;
    },
    listVaults: async () => [...state.vaults],
    getVault: async (id: string) => {
      const found = state.vaults.find((v) => v.id === id);
      if (!found) throw new ClientError("NOT_FOUND", "vault not found");
      return found;
    },
    listEntries: async (vaultID: string, parentID: string | null) =>
      state.entries.filter(
        (e) => e.vault_id === vaultID && e.parent_id === parentID,
      ),
    createFolder: async (
      vaultID: string,
      parentID: string | null,
      name: string,
    ) => {
      const e = folder(`entry-${++state.entrySeq}`, vaultID, parentID, name);
      state.entries.push(e);
      return e;
    },
    renameEntry: async (entryID: string, name: string) => {
      const found = state.entries.find((e) => e.id === entryID);
      if (!found) throw new ClientError("NOT_FOUND", "entry not found");
      return { ...found, name };
    },
    moveEntry: async (entryID: string, parentID: string | null) => {
      const found = state.entries.find((e) => e.id === entryID);
      if (!found) throw new ClientError("NOT_FOUND", "entry not found");
      return { ...found, parent_id: parentID };
    },
    deleteFolder: async (entryID: string) => {
      state.entries = state.entries.filter((e) => e.id !== entryID);
    },
  };
  return { state, client };
}

function renderApp(client: WyvernClient) {
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

function typeInto(input: HTMLElement, text: string) {
  fireEvent.change(input, { target: { value: text } });
}

describe("create vault then folder", () => {
  it("creates a vault by name, then a folder inside it", async () => {
    const { state, client } = makeStore();
    renderApp(client);

    fireEvent.click(
      await screen.findByRole("button", { name: "Create local vault" }),
    );
    typeInto(screen.getByLabelText("Vault name"), "Personal");
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByRole("button", { name: "Personal" })).toBeVisible();
    expect(state.vaults.map((v) => v.name)).toEqual(["Personal"]);

    fireEvent.click(screen.getByRole("button", { name: "New folder" }));
    typeInto(screen.getByLabelText("Folder name"), "Projects");
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("Projects")).toBeVisible();
    expect(state.entries.map((e) => e.name)).toEqual(["Projects"]);
  });
});

describe("nested navigation and back", () => {
  it("double-clicks into a folder, shows the trail, and goes back", async () => {
    const v = vault("vault-1", "Personal");
    const projects = folder("entry-1", v.id, null, "Projects");
    const docs = folder("entry-2", v.id, projects.id, "Docs");
    const { client } = makeStore({ vaults: [v], entries: [projects, docs] });
    renderApp(client);

    expect(await screen.findByText("Projects")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    expect(await screen.findByText("Docs")).toBeVisible();
    expect(
      screen.getByRole("navigation", { name: "Folder path" }),
    ).toHaveTextContent("Projects");

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByText("Projects")).toBeVisible();
    expect(screen.queryByText("Docs")).not.toBeInTheDocument();
  });
});

describe("conflict rename", () => {
  it("rejected rename keeps the old row and shows the error", async () => {
    const v = vault("vault-1", "Personal");
    const notes = folder("entry-1", v.id, null, "Notes");
    const { client } = makeStore({ vaults: [v], entries: [notes] });
    client.renameEntry = async () => {
      throw new ClientError("FILE_CONFLICT", "entry name already exists");
    };
    renderApp(client);

    fireEvent.click(await screen.findByText("Notes"));
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    typeInto(screen.getByLabelText("New name"), "Projects");
    const renameDialog = await screen.findByRole("dialog");
    fireEvent.click(within(renameDialog).getByRole("button", { name: "Rename" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("FILE_CONFLICT");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Notes")).toBeVisible();
  });
});

describe("move refreshes the tree", () => {
  it("moves a folder to root and the listing updates", async () => {
    const v = vault("vault-1", "Personal");
    const projects = folder("entry-1", v.id, null, "Projects");
    const notes = folder("entry-2", v.id, projects.id, "Notes");
    const store = makeStore({ vaults: [v], entries: [projects, notes] });
    // Double applies moves to its in-memory tree like the service would.
    store.client.moveEntry = async (
      movedID: string,
      parentID: string | null,
    ) => {
      const found = store.state.entries.find((e) => e.id === movedID);
      if (!found) throw new ClientError("NOT_FOUND", "entry not found");
      const next = { ...found, parent_id: parentID };
      store.state.entries = store.state.entries.map((e) =>
        e.id === movedID ? next : e,
      );
      return next;
    };
    renderApp(store.client);

    expect(await screen.findByText("Projects")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    expect(await screen.findByText("Notes")).toBeVisible();

    fireEvent.click(screen.getByText("Notes"));
    fireEvent.click(screen.getByRole("button", { name: "Move" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Root" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Move here" }));

    await waitFor(() =>
      expect(
        store.state.entries.find((e) => e.id === "entry-2")?.parent_id,
      ).toBeNull(),
    );
  });
});

describe("move destination navigation", () => {
  it("opens destinations on single click and hides the source", async () => {
    const v = vault("vault-1", "Personal");
    const projects = folder("entry-1", v.id, null, "Projects");
    const docs = folder("entry-2", v.id, null, "Docs");
    const notes = folder("entry-3", v.id, projects.id, "Notes");
    const { client } = makeStore({ vaults: [v], entries: [projects, docs, notes] });
    renderApp(client);

    fireEvent.click(await screen.findByText("Docs"));
    fireEvent.click(screen.getByRole("button", { name: "Move" }));
    const dialog = await screen.findByRole("dialog");
    // The selected source is hidden from navigable targets.
    expect(
      within(dialog).queryByRole("button", { name: "Docs" }),
    ).not.toBeInTheDocument();
    // A single click (keyboard-equivalent activation) descends.
    fireEvent.click(within(dialog).getByRole("button", { name: "Projects" }));
    expect(await within(dialog).findByText("Notes")).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "Projects" })).toBeVisible();
  });
});

describe("cancel delete makes no mutation", () => {
  it("records zero deleteFolder calls", async () => {
    const v = vault("vault-1", "Personal");
    const projects = folder("entry-1", v.id, null, "Projects");
    const { client } = makeStore({ vaults: [v], entries: [projects] });
    const deleteFolder = vi.fn(client.deleteFolder);
    client.deleteFolder = deleteFolder;
    renderApp(client);

    fireEvent.click(await screen.findByText("Projects"));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(
      await screen.findByText(/Delete the folder “Projects” permanently/),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(deleteFolder).not.toHaveBeenCalled();
    expect(screen.getByText("Projects")).toBeVisible();
  });
});

describe("explicit recursive delete", () => {
  it("offers a second confirmation and calls deleteFolder(id, true) once", async () => {
    const v = vault("vault-1", "Personal");
    const projects = folder("entry-1", v.id, null, "Projects");
    const { client } = makeStore({ vaults: [v], entries: [projects] });
    const deleteFolder = vi.fn(
      async (_entryID: string, recursive: boolean): Promise<void> => {
        if (!recursive) {
          throw new ClientError("FOLDER_NOT_EMPTY", "folder is not empty");
        }
      },
    );
    client.deleteFolder = deleteFolder;
    renderApp(client);

    fireEvent.click(await screen.findByText("Projects"));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Delete permanently" }),
    );

    const second = await screen.findByRole("button", {
      name: "Delete permanently including contents",
    });
    fireEvent.click(second);

    await waitFor(() => expect(deleteFolder).toHaveBeenCalledTimes(2));
    expect(deleteFolder).toHaveBeenNthCalledWith(1, "entry-1", false);
    expect(deleteFolder).toHaveBeenNthCalledWith(2, "entry-1", true);
  });
});
