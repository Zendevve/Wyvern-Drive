import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import DrivePage from './DrivePage';
import { AuthProvider } from '../auth/AuthProvider';
import UploadProvider from '../upload/UploadProvider';
import * as client from '../api/client';

jest.mock('../api/client', () => ({
  ApiError: class ApiError extends Error {
    constructor(status, code, message) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
  api: {
    me: jest.fn(),
    drive: jest.fn(),
    driveStats: jest.fn(),
    uploadCancel: jest.fn(),
    webhooks: {
      list: jest.fn(),
      add: jest.fn(),
      remove: jest.fn(),
    },
    trash: {
      list: jest.fn(),
      restore: jest.fn(),
      purge: jest.fn(),
    },
    copyEntry: jest.fn(),
    entries: jest.fn(),
    createFolder: jest.fn(),
    updateEntry: jest.fn(),
    deleteEntry: jest.fn(),
    createShare: jest.fn(),
    listShares: jest.fn(),
    revokeShare: jest.fn(),
    publicShare: jest.fn(),
    logout: jest.fn(),
  },
  uploadFile: jest.fn(),
  downloadUrl: jest.fn(),
  archiveUrl: jest.fn(),
  uploadProgress: jest.fn(),
  isPreviewableMime: jest.fn(),
}));

const user = { id: 1, discordId: '123456', username: 'alice', avatarUrl: null };
const drive = { id: 1, quotaBytes: 10737418240, usedBytes: 1073741824 };

const fileEntry = (overrides = {}) => ({
  id: 1,
  parentId: null,
  kind: 'file',
  name: 'notes.txt',
  sizeBytes: 2048,
  mimeType: 'text/plain',
  status: 'ready',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  ...overrides,
});

const folderEntry = (overrides = {}) => ({
  id: 2,
  parentId: null,
  kind: 'folder',
  name: 'Documents',
  sizeBytes: 0,
  mimeType: null,
  status: 'ready',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const createMatchMedia = (width) => (query) => ({
  matches: query.includes('min-width') ? width >= 768 : width < 768,
  media: query,
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
});

const renderDrive = () =>
  render(
    <MemoryRouter initialEntries={['/drive']}>
      <AuthProvider>
        <UploadProvider>
          <DrivePage />
        </UploadProvider>
      </AuthProvider>
    </MemoryRouter>
  );

// Holds the provider above the page so a DrivePage unmount/remount (the
// /drive -> /trash -> /drive navigation shape) must not lose the queue.
function NavigationHost() {
  const [onDrive, setOnDrive] = React.useState(true);
  return (
    <MemoryRouter initialEntries={['/drive']}>
      <AuthProvider>
        <UploadProvider>
          {onDrive ? <DrivePage /> : <div data-testid="away-page">Trash</div>}
          <button type="button" onClick={() => setOnDrive((v) => !v)}>
            toggle-page
          </button>
        </UploadProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  // The one-time drag hint and view mode persist in localStorage; reset it so
  // tests render a fresh drive (hint visible, list view).
  localStorage.clear();
  // NOTE: implementations are set here, not in the jest.mock factory — the
  // CRA 5 babel-jest hoist transform drops factory-set implementations.
  client.downloadUrl.mockImplementation((id, opts = {}) =>
    `/api/files/${id}/download${opts.inline ? '?inline=1' : ''}`
  );
  client.archiveUrl.mockImplementation((id) => `/api/entries/${id}/archive`);
  client.uploadProgress.mockResolvedValue({
    status: 'uploading',
    postedBytes: 0,
    expectedBytes: 100,
  });
  client.isPreviewableMime.mockImplementation((mime) => {
    if (!mime) {
      return false;
    }
    const type = String(mime).toLowerCase();
    return (
      type.startsWith('image/') ||
      type.startsWith('video/') ||
      type.startsWith('audio/') ||
      type.startsWith('text/') ||
      type === 'application/json' ||
      type === 'application/pdf'
    );
  });
  window.matchMedia = createMatchMedia(1024);
  client.api.me.mockResolvedValue({ user, drive });
  client.api.entries.mockResolvedValue({ entries: [] });
  client.api.uploadCancel.mockResolvedValue(null);
});

describe('loading and empty states', () => {
  it('shows a loading skeleton while entries are fetched', async () => {
    client.api.entries.mockReturnValue(new Promise(() => {}));
    renderDrive();
    expect(await screen.findByTestId('entries-loading')).toBeInTheDocument();
  });

  it('shows the ready spotlight card when the drive is empty', async () => {
    renderDrive();
    const empty = await screen.findByTestId('empty-state');
    expect(within(empty).getByText('Your space is ready')).toBeInTheDocument();
    expect(
      within(empty).getByText(
        /Your files are encrypted before they're stored — only you can see them/
      )
    ).toBeInTheDocument();
    expect(
      within(empty).getByRole('button', { name: /upload your first file/i })
    ).toBeInTheDocument();
  });

  it('shows an error notice with retry when listing fails', async () => {
    client.api.entries.mockRejectedValueOnce(
      new client.ApiError(502, 'STORAGE_UNAVAILABLE', 'Discord storage is unavailable')
    );
    renderDrive();
    expect(
      await screen.findByText('Discord storage is unavailable')
    ).toBeInTheDocument();
    userEvent.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(client.api.entries).toHaveBeenCalledTimes(2));
  });
});

describe('navigation and breadcrumbs', () => {
  it('navigates into folders and back via breadcrumbs', async () => {
    const docs = folderEntry({ id: 2, name: 'Documents' });
    const report = fileEntry({ id: 3, parentId: 2, name: 'report.pdf', sizeBytes: 4096 });
    client.api.entries.mockImplementation((params) => {
      if (params.parentId === 2) {
        return Promise.resolve({ entries: [report] });
      }
      return Promise.resolve({ entries: [docs] });
    });
    renderDrive();

    const folderButton = await screen.findByRole('button', { name: 'Documents' });
    userEvent.click(folderButton);
    await waitFor(() =>
      expect(client.api.entries).toHaveBeenCalledWith(
        expect.objectContaining({ parentId: 2 })
      )
    );
    expect(await screen.findByText('report.pdf')).toBeInTheDocument();

    userEvent.click(screen.getByRole('button', { name: 'My drive' }));
    await waitFor(() =>
      expect(client.api.entries).toHaveBeenCalledWith(
        expect.objectContaining({ parentId: null })
      )
    );
    expect(await screen.findByRole('button', { name: 'Documents' })).toBeInTheDocument();
  }, 20000);

  it('sorts by clicking column headers, toggling direction', async () => {
    client.api.entries.mockResolvedValue({ entries: [fileEntry()] });
    renderDrive();
    await screen.findByText('notes.txt');

    userEvent.click(screen.getByRole('button', { name: /size/i }));
    await waitFor(() =>
      expect(client.api.entries).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: 'size', direction: 'asc' })
      )
    );
    userEvent.click(screen.getByRole('button', { name: /size/i }));
    await waitFor(() =>
      expect(client.api.entries).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: 'size', direction: 'desc' })
      )
    );
  }, 20000);

  it('searches with a debounced query', async () => {
    renderDrive();
    await screen.findByTestId('empty-state');
    userEvent.type(screen.getByRole('textbox', { name: /search/i }), 'hello');
    await waitFor(
      () =>
        expect(client.api.entries).toHaveBeenLastCalledWith(
          expect.objectContaining({ query: 'hello' })
        ),
      { timeout: 1500 }
    );
  });

  it('shows a search-results header while a search is active', async () => {
    client.api.entries.mockResolvedValue({ entries: [fileEntry()] });
    renderDrive();
    await screen.findByText('notes.txt');
    expect(screen.queryByTestId('search-results-header')).not.toBeInTheDocument();

    userEvent.type(
      screen.getByRole('textbox', { name: /search files and folders/i }),
      'note'
    );
    expect(await screen.findByTestId('search-results-header')).toBeInTheDocument();
    expect(
      screen.getByText('Search results for "note"')
    ).toBeInTheDocument();
  });
});

describe('uploads', () => {
  it('shows progress and completes with the server-returned name', async () => {
    let resolveUpload;
    client.uploadFile.mockImplementation(
      ({ onProgress }) =>
        new Promise((resolve) => {
          resolveUpload = resolve;
          onProgress(50, 100);
        })
    );
    renderDrive();
    await screen.findByTestId('empty-state');

    const file = new File(['hello world'], 'hello.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByTestId('file-input'), { target: { files: [file] } });

    expect(await screen.findByText('Uploading 50%')).toBeInTheDocument();
    resolveUpload(fileEntry({ id: 9, name: 'hello.txt', sizeBytes: 11 }));
    expect(await screen.findByText('Uploaded')).toBeInTheDocument();
    expect(screen.getByText('hello.txt')).toBeInTheDocument();
  });

  it('shows a failed upload job and retries it', async () => {
    client.uploadFile
      .mockRejectedValueOnce(
        new client.ApiError(502, 'UPLOAD_FAILED', 'Discord rejected the chunk')
      )
      .mockResolvedValueOnce(fileEntry({ id: 9, name: 'hello.txt', sizeBytes: 11 }));
    renderDrive();
    await screen.findByTestId('empty-state');

    const file = new File(['hello world'], 'hello.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByTestId('file-input'), { target: { files: [file] } });

    expect(await screen.findByText('Discord rejected the chunk')).toBeInTheDocument();
    userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByText('Uploaded')).toBeInTheDocument();
    expect(client.uploadFile).toHaveBeenCalledTimes(2);
  });

  it('links downloads to the authenticated download route', async () => {
    client.api.entries.mockResolvedValue({ entries: [fileEntry()] });
    renderDrive();
    // MUI renders component="a" controls as links once href is present.
    const link = await screen.findByRole('link', { name: /download notes\.txt/i });
    expect(link.href).toBe('http://localhost/api/files/1/download');
  });

  it('cancels an uploading job: aborts the XHR, purges server-side, removes the job', async () => {
    const abort = jest.fn();
    const pending = new Promise(() => {});
    pending.abort = abort;
    client.uploadFile.mockImplementation(() => pending);
    renderDrive();
    await screen.findByTestId('empty-state');

    const file = new File(['hello world'], 'hello.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByTestId('file-input'), { target: { files: [file] } });

    const cancelButton = await screen.findByRole('button', {
      name: /cancel upload hello\.txt/i,
    });
    userEvent.click(cancelButton);

    await waitFor(() => expect(abort).toHaveBeenCalledTimes(1));
    expect(client.api.uploadCancel).toHaveBeenCalledWith(expect.any(String));
    // The job is removed from the queue after the exit transition.
    await waitFor(() =>
      expect(screen.queryByText('hello.txt')).not.toBeInTheDocument()
    );
  });

  it('keeps the transfer console across page navigation', async () => {
    let resolveUpload;
    client.uploadFile.mockImplementation(
      ({ onProgress }) =>
        new Promise((resolve) => {
          resolveUpload = resolve;
          onProgress(50, 100);
        })
    );
    render(<NavigationHost />);
    await screen.findByTestId('empty-state');

    const file = new File(['hello world'], 'hello.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByTestId('file-input'), {
      target: { files: [file] },
    });

    expect(await screen.findByText('Uploading 50%')).toBeInTheDocument();

    // Navigate away: DrivePage unmounts but the provider-owned queue survives.
    userEvent.click(screen.getByRole('button', { name: /toggle-page/i }));
    expect(screen.getByTestId('away-page')).toBeInTheDocument();
    expect(screen.getByText('Uploading 50%')).toBeInTheDocument();

    // Navigate back: a fresh DrivePage mounts and the same job is still there.
    userEvent.click(screen.getByRole('button', { name: /toggle-page/i }));
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText('Uploading 50%')).toBeInTheDocument();

    resolveUpload(fileEntry({ id: 9, name: 'hello.txt', sizeBytes: 11 }));
    expect(await screen.findByText('Uploaded')).toBeInTheDocument();
    expect(screen.getByText('hello.txt')).toBeInTheDocument();
  });
});

describe('entry mutations', () => {
  it('renames an entry through the rename dialog', async () => {
    client.api.entries.mockResolvedValue({ entries: [fileEntry()] });
    client.api.updateEntry.mockResolvedValue(fileEntry({ name: 'renamed.txt' }));
    renderDrive();
    await screen.findByText('notes.txt');

    userEvent.click(screen.getByRole('button', { name: /rename notes\.txt/i }));
    const dialog = screen.getByRole('dialog');
    const input = within(dialog).getByRole('textbox', { name: /name/i });
    userEvent.clear(input);
    userEvent.type(input, 'renamed.txt');
    userEvent.click(within(dialog).getByRole('button', { name: /rename/i }));

    await waitFor(() =>
      expect(client.api.updateEntry).toHaveBeenCalledWith(1, { name: 'renamed.txt' })
    );
  });

  it('moves an entry to a chosen folder', async () => {
    const notes = fileEntry();
    client.api.entries.mockImplementation((params) => {
      if (params.kind === 'folder') {
        return Promise.resolve({ entries: [folderEntry({ id: 5, name: 'Projects' })] });
      }
      return Promise.resolve({ entries: [notes] });
    });
    client.api.updateEntry.mockResolvedValue(notes);
    renderDrive();
    await screen.findByText('notes.txt');

    userEvent.click(screen.getByRole('button', { name: /move notes\.txt/i }));
    const target = await screen.findByRole('button', { name: 'Projects' });
    userEvent.click(target);
    userEvent.click(screen.getByTestId('move-here'));

    await waitFor(() =>
      expect(client.api.updateEntry).toHaveBeenCalledWith(1, { parentId: 5 })
    );
  });

  it('deletes an entry after confirmation', async () => {
    client.api.entries.mockResolvedValue({ entries: [fileEntry()] });
    client.api.deleteEntry.mockResolvedValue(null);
    renderDrive();
    await screen.findByText('notes.txt');

    userEvent.click(screen.getByRole('button', { name: /delete notes\.txt/i }));
    userEvent.click(screen.getByTestId('confirm-delete'));

    await waitFor(() => expect(client.api.deleteEntry).toHaveBeenCalledWith(1));
    await waitFor(() => expect(client.api.entries).toHaveBeenCalledTimes(2));
  });

  it('offers undo after deleting and restores the entry', async () => {
    const notes = fileEntry();
    client.api.entries.mockResolvedValue({ entries: [notes] });
    client.api.deleteEntry.mockResolvedValue(null);
    client.api.trash.restore.mockResolvedValue(notes);
    renderDrive();
    await screen.findByText('notes.txt');

    userEvent.click(screen.getByRole('button', { name: /delete notes\.txt/i }));
    userEvent.click(screen.getByTestId('confirm-delete'));

    // Snackbar copy varies with the queue length ("Moved to Trash" /
    // "Moved 1 item to Trash"), so match the shape, not the exact wording.
    expect(await screen.findByText(/Moved .* to Trash/)).toBeInTheDocument();
    userEvent.click(screen.getByTestId('undo-delete'));

    await waitFor(() =>
      expect(client.api.trash.restore).toHaveBeenCalledWith(1)
    );
    // initial list + reload after delete + reload after restore
    await waitFor(() => expect(client.api.entries).toHaveBeenCalledTimes(3));
  });

  it('shows an actionable error when creating a conflicting folder', async () => {
    client.api.createFolder.mockRejectedValue(
      new client.ApiError(409, 'NAME_CONFLICT', 'A folder named "docs" already exists.')
    );
    renderDrive();
    await screen.findByTestId('empty-state');

    userEvent.click(screen.getByRole('button', { name: /new folder/i }));
    userEvent.type(screen.getByRole('textbox', { name: /folder name/i }), 'docs');
    userEvent.click(screen.getByRole('button', { name: /create folder/i }));

    const messages = await screen.findAllByText(
      'A folder named "docs" already exists.'
    );
    expect(messages.length).toBeGreaterThanOrEqual(1);
  });
});

describe('sharing', () => {
  it('creates and revokes share links', async () => {
    client.api.entries.mockResolvedValue({ entries: [fileEntry()] });
    const activeShare = {
      id: 11,
      token: 'tok123',
      url: 'http://localhost/share/tok123',
      expiresAt: null,
      revokedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const revokedShare = { ...activeShare, revokedAt: '2026-02-01T00:00:00.000Z' };
    client.api.listShares
      .mockResolvedValueOnce({ shares: [activeShare] })
      .mockResolvedValueOnce({ shares: [activeShare] })
      .mockResolvedValueOnce({ shares: [revokedShare] });
    client.api.createShare.mockResolvedValue({
      ...activeShare,
      id: 12,
      token: 'tok456',
      url: 'http://localhost/share/tok456',
    });
    client.api.revokeShare.mockResolvedValue(null);
    renderDrive();
    await screen.findByText('notes.txt');

    userEvent.click(screen.getByRole('button', { name: /share notes\.txt/i }));

    expect(await screen.findByText('http://localhost/share/tok123')).toBeInTheDocument();
    userEvent.click(screen.getByTestId('create-share'));
    expect(await screen.findByText('http://localhost/share/tok456')).toBeInTheDocument();

    userEvent.click(screen.getAllByRole('button', { name: /revoke/i })[0]);
    expect(await screen.findByText('Revoked')).toBeInTheDocument();
    expect(client.api.revokeShare).toHaveBeenCalledWith(11);
  });
});

describe('quota and responsiveness', () => {
  it('shows quota usage in the sidebar', async () => {
    renderDrive();
    expect(
      await screen.findByText('1.0 GiB of 10.0 GiB used')
    ).toBeInTheDocument();
  });

  it('renders stacked cards below 768px and a table on desktop', async () => {
    window.matchMedia = createMatchMedia(500);
    client.api.entries.mockResolvedValue({
      entries: [fileEntry(), folderEntry()],
    });
    renderDrive();
    expect(await screen.findByTestId('entry-cards')).toBeInTheDocument();
    expect(screen.queryByTestId('entry-table')).not.toBeInTheDocument();
    expect(screen.getByText('notes.txt')).toBeInTheDocument();
  });

  it('renders the table on desktop and keeps the same actions', async () => {
    client.api.entries.mockResolvedValue({ entries: [fileEntry()] });
    renderDrive();
    expect(await screen.findByTestId('entry-table')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /delete notes\.txt/i })
    ).toBeInTheDocument();
  });
});

describe('archive and preview actions', () => {
  it('links folder downloads to the archive route', async () => {
    client.api.entries.mockResolvedValue({
      entries: [folderEntry({ id: 2, name: 'Documents' })],
    });
    renderDrive();
    const link = await screen.findByRole('link', {
      name: /download documents/i,
    });
    expect(link.href).toBe('http://localhost/api/entries/2/archive');
  });

  it('opens the preview dialog for previewable files and closes it', async () => {
    client.api.entries.mockResolvedValue({
      entries: [fileEntry({ id: 3, name: 'report.pdf', mimeType: 'application/pdf' })],
    });
    renderDrive();
    await screen.findByText('report.pdf');

    userEvent.click(
      screen.getByRole('button', { name: /preview report\.pdf/i })
    );
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByText('report.pdf').length).toBeGreaterThanOrEqual(2);

    userEvent.click(screen.getByRole('button', { name: 'Close preview' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
  });

  it('does not offer preview for non-previewable files', async () => {
    client.api.entries.mockResolvedValue({
      entries: [
        fileEntry({ id: 7, name: 'archive.tar.gz', mimeType: 'application/gzip' }),
      ],
    });
    renderDrive();
    await screen.findByText('archive.tar.gz');
    expect(
      screen.queryByRole('button', { name: /preview archive\.tar\.gz/i })
    ).not.toBeInTheDocument();
    // The download link is still there.
    expect(
      screen.getByRole('link', { name: /download archive\.tar\.gz/i })
    ).toBeInTheDocument();
  });
});

describe('copy and folder upload', () => {
  it('copies an entry into the current folder', async () => {
    client.api.entries.mockResolvedValue({ entries: [fileEntry()] });
    client.api.copyEntry.mockResolvedValue(
      fileEntry({ id: 10, name: 'notes (1).txt' })
    );
    renderDrive();
    await screen.findByText('notes.txt');

    // The copy action now opens the copy dialog with the current parent
    // pre-selected; confirming via copy-here performs the duplicate.
    userEvent.click(screen.getByRole('button', { name: /copy notes\.txt/i }));
    await screen.findByRole('dialog');
    userEvent.click(screen.getByTestId('copy-here'));

    await waitFor(() =>
      expect(client.api.copyEntry).toHaveBeenCalledWith(1, null)
    );
    await waitFor(() => expect(client.api.entries).toHaveBeenCalledTimes(3));
  });

  it('copies into the open folder, not the root', async () => {
    const docs = folderEntry({ id: 2, name: 'Documents' });
    const report = fileEntry({ id: 3, parentId: 2, name: 'report.pdf' });
    client.api.entries.mockImplementation((params) => {
      if (params.parentId === 2) {
        return Promise.resolve({ entries: [report] });
      }
      return Promise.resolve({ entries: [docs] });
    });
    client.api.copyEntry.mockResolvedValue(report);
    renderDrive();

    userEvent.click(await screen.findByRole('button', { name: 'Documents' }));
    await screen.findByText('report.pdf');
    userEvent.click(screen.getByRole('button', { name: /copy report\.pdf/i }));

    // The open folder (report's parent) is pre-selected in the dialog.
    await screen.findByRole('dialog');
    userEvent.click(screen.getByTestId('copy-here'));

    await waitFor(() =>
      expect(client.api.copyEntry).toHaveBeenCalledWith(3, 2)
    );
  });

  it('copies into a folder picked in the dialog, not just the current parent', async () => {
    const projects = folderEntry({ id: 6, name: 'Projects', parentId: null });
    const notes = fileEntry({ id: 1, parentId: null, name: 'notes.txt' });
    // The dialog's folder fetch passes kind: 'folder'; the main list does
    // not, so the dialog tree is the only place 'Projects' appears.
    client.api.entries.mockImplementation((params) => {
      if (params.kind === 'folder') {
        return Promise.resolve({ entries: [projects] });
      }
      return Promise.resolve({ entries: [notes] });
    });
    client.api.copyEntry.mockResolvedValue(
      fileEntry({ id: 10, name: 'notes (1).txt' })
    );
    renderDrive();
    await screen.findByText('notes.txt');

    userEvent.click(screen.getByRole('button', { name: /copy notes\.txt/i }));
    const target = await screen.findByRole('button', { name: 'Projects' });
    userEvent.click(target);
    userEvent.click(screen.getByTestId('copy-here'));

    await waitFor(() =>
      expect(client.api.copyEntry).toHaveBeenCalledWith(1, 6)
    );
  });

  it('renders the folder-upload input with webkitdirectory', async () => {
    renderDrive();
    await screen.findByTestId('empty-state');
    const input = screen.getByTestId('folder-input');
    expect(input).toHaveAttribute('webkitdirectory');
    expect(input).toHaveAttribute('directory');
  });

  it('shows the folder upload button', async () => {
    renderDrive();
    await screen.findByTestId('empty-state');
    expect(
      screen.getByRole('button', { name: /upload folder/i })
    ).toBeInTheDocument();
  });
});

describe('one-time drag-and-drop hint', () => {
  it('shows the hint on an empty drive root', async () => {
    renderDrive();
    const hint = await screen.findByTestId('drag-drop-hint');
    expect(
      hint
    ).toHaveTextContent('Tip: drag files anywhere on the page to upload');
  });

  it('hides the hint once entries exist', async () => {
    client.api.entries.mockResolvedValue({ entries: [fileEntry()] });
    renderDrive();
    await screen.findByText('notes.txt');
    expect(screen.queryByTestId('drag-drop-hint')).not.toBeInTheDocument();
  });

  it('dismisses the hint, persists the flag, and keeps it hidden after re-render', async () => {
    const { unmount } = renderDrive();
    await screen.findByTestId('drag-drop-hint');

    userEvent.click(screen.getByRole('button', { name: /dismiss tip/i }));
    await waitFor(() =>
      expect(localStorage.getItem('wyvern-drag-hint-dismissed')).toBe('1')
    );
    expect(screen.queryByTestId('drag-drop-hint')).not.toBeInTheDocument();

    unmount();
    renderDrive();
    await screen.findByTestId('empty-state');
    expect(screen.queryByTestId('drag-drop-hint')).not.toBeInTheDocument();
  });

  it('respects a pre-existing dismissal flag', async () => {
    localStorage.setItem('wyvern-drag-hint-dismissed', '1');
    renderDrive();
    await screen.findByTestId('empty-state');
    expect(screen.queryByTestId('drag-drop-hint')).not.toBeInTheDocument();
  });
});

describe('Signal Deck responsive proof', () => {
  it('at 1024px renders the manifest table with working list/grid view controls', async () => {
    window.matchMedia = createMatchMedia(1024);
    client.api.entries.mockResolvedValue({ entries: [fileEntry()] });
    renderDrive();
    await screen.findByText('notes.txt');

    expect(screen.getByTestId('entry-table')).toBeInTheDocument();
    const listToggle = screen.getByRole('button', { name: 'List view' });
    const gridToggle = screen.getByRole('button', { name: 'Grid view' });
    expect(listToggle).toHaveAttribute('aria-pressed', 'true');
    expect(gridToggle).toHaveAttribute('aria-pressed', 'false');

    userEvent.click(gridToggle);
    expect(await screen.findByTestId('entry-grid')).toBeInTheDocument();
    expect(screen.queryByTestId('entry-table')).not.toBeInTheDocument();
    expect(listToggle).toHaveAttribute('aria-pressed', 'false');
    expect(gridToggle).toHaveAttribute('aria-pressed', 'true');
  });

  it('at 1024px shows the selection bar with a count and a delete action after selecting a row', async () => {
    window.matchMedia = createMatchMedia(1024);
    client.api.entries.mockResolvedValue({ entries: [fileEntry()] });
    renderDrive();
    await screen.findByText('notes.txt');
    expect(screen.queryByTestId('selection-bar')).not.toBeInTheDocument();

    userEvent.click(screen.getByRole('checkbox', { name: 'Select notes.txt' }));
    const bar = await screen.findByTestId('selection-bar');
    expect(within(bar).getByText('1 selected')).toBeInTheDocument();
    expect(within(bar).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('at 500px renders touch cards with always-visible actions and no fixed-width overflow source', async () => {
    window.matchMedia = createMatchMedia(500);
    client.api.entries.mockResolvedValue({
      entries: [fileEntry(), folderEntry()],
    });
    renderDrive();
    await screen.findByText('notes.txt');

    const cards = screen.getByTestId('entry-cards');
    expect(cards).toBeInTheDocument();
    expect(screen.queryByTestId('entry-table')).not.toBeInTheDocument();

    // Cards have no hover-only .row-actions reveal: every action is visible
    // on touch without any hover state.
    const deleteButton = screen.getByRole('button', { name: 'Delete notes.txt' });
    expect(deleteButton.closest('.row-actions')).toBeNull();

    // No fixed pixel width anywhere in the cards chain: the list carries no
    // inline style and each card surface is 100% of its parent, so nothing
    // can exceed the viewport width.
    expect(cards).not.toHaveAttribute('style');
    const card = deleteButton.closest('.MuiCard-root');
    expect(card).toHaveStyle({ width: '100%' });

    // jsdom does not compute layout, so this is a canary only; the
    // structural guarantees above are the real assertions.
    expect(document.body.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  });

  it('at 500px keeps the transfer console inside the viewport', async () => {
    window.matchMedia = createMatchMedia(500);
    client.uploadFile.mockImplementation(
      ({ onProgress }) =>
        new Promise((resolve) => {
          onProgress(50, 100);
        })
    );
    renderDrive();
    await screen.findByTestId('empty-state');

    const file = new File(['hello world'], 'hello.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByTestId('file-input'), {
      target: { files: [file] },
    });

    const queue = await screen.findByTestId('upload-queue');
    // The console is clamped to the viewport edge on narrow screens; sx is
    // injected as a class rule, so assert through the computed style.
    expect(queue).toHaveStyle({ maxWidth: 'calc(100vw - 16px)' });
  });

  it('empty state: the primary CTA is the amber contained action', async () => {
    window.matchMedia = createMatchMedia(1024);
    renderDrive();
    const empty = await screen.findByTestId('empty-state');
    expect(
      within(empty).getByRole('heading', { name: 'Your space is ready' })
    ).toBeInTheDocument();
    expect(
      within(empty).getByText(
        /Your files are encrypted before they're stored — only you can see them/
      )
    ).toBeInTheDocument();
    const cta = within(empty).getByRole('button', {
      name: /upload your first file/i,
    });
    expect(cta.className).toContain('MuiButton-contained');
  });
});
