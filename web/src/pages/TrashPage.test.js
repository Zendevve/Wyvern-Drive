import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TrashPage from './TrashPage';
import LoginPage from './LoginPage';
import { AuthProvider } from '../auth/AuthProvider';
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
  shareDownloadUrl: jest.fn(),
}));

const user = { id: 1, discordId: '123456', username: 'alice', avatarUrl: null };
const drive = { id: 1, quotaBytes: 10737418240, usedBytes: 1024 };

const trashedFile = (overrides = {}) => ({
  id: 1,
  parentId: null,
  kind: 'file',
  name: 'old.txt',
  sizeBytes: 2048,
  mimeType: 'text/plain',
  status: 'ready',
  deletedAt: '2026-07-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  ...overrides,
});

const trashedFolder = (overrides = {}) => ({
  id: 2,
  parentId: null,
  kind: 'folder',
  name: 'Old folder',
  sizeBytes: 0,
  mimeType: null,
  status: 'ready',
  deletedAt: '2026-07-02T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

// Mirrors App.js: the AuthProvider redirect from /trash lands on /login.
const renderTrash = () =>
  render(
    <MemoryRouter initialEntries={['/trash']}>
      <AuthProvider>
        <Routes>
          <Route path="/trash" element={<TrashPage />} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );

beforeEach(() => {
  jest.clearAllMocks();
  client.api.me.mockResolvedValue({ user, drive });
  client.api.trash.list.mockResolvedValue({ entries: [] });
});

it('renders the trashed entries with their deleted dates', async () => {
  client.api.trash.list.mockResolvedValue({
    entries: [trashedFile(), trashedFolder()],
  });
  renderTrash();

  expect(await screen.findByText('old.txt')).toBeInTheDocument();
  expect(screen.getByText('Old folder')).toBeInTheDocument();
  expect(screen.getAllByText(/deleted /).length).toBeGreaterThanOrEqual(1);
  expect(
    screen.getByRole('button', { name: /restore old\.txt/i })
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: /delete forever old\.txt/i })
  ).toBeInTheDocument();
});

it('shows the empty state when nothing is trashed', async () => {
  renderTrash();
  expect(await screen.findByTestId('trash-empty')).toBeInTheDocument();
  expect(screen.getByText('Trash is empty')).toBeInTheDocument();
});

it('restores an entry and reloads the list', async () => {
  client.api.trash.list
    .mockResolvedValueOnce({ entries: [trashedFile()] })
    .mockResolvedValue({ entries: [] });
  client.api.trash.restore.mockResolvedValue(trashedFile({ deletedAt: null }));
  renderTrash();

  userEvent.click(
    await screen.findByRole('button', { name: /restore old\.txt/i })
  );
  await waitFor(() => expect(client.api.trash.restore).toHaveBeenCalledWith(1));
  await waitFor(() => expect(client.api.trash.list).toHaveBeenCalledTimes(2));
  expect(await screen.findByTestId('trash-empty')).toBeInTheDocument();
});

it('purges an entry only after confirmation', async () => {
  client.api.trash.list
    .mockResolvedValueOnce({ entries: [trashedFile()] })
    .mockResolvedValue({ entries: [] });
  client.api.trash.purge.mockResolvedValue(null);
  renderTrash();

  userEvent.click(
    await screen.findByRole('button', { name: /delete forever old\.txt/i })
  );
  // The dialog asks before anything is deleted.
  expect(screen.getByText('Delete old.txt forever?')).toBeInTheDocument();
  expect(client.api.trash.purge).not.toHaveBeenCalled();

  userEvent.click(screen.getByTestId('confirm-purge'));
  await waitFor(() => expect(client.api.trash.purge).toHaveBeenCalledWith(1));
  expect(await screen.findByTestId('trash-empty')).toBeInTheDocument();
});

it('empty trash purges only the root entries', async () => {
  client.api.trash.list.mockResolvedValue({
    entries: [
      trashedFile({ id: 1, name: 'root.txt' }),
      trashedFolder({ id: 2, name: 'Root folder' }),
      trashedFile({ id: 3, parentId: 2, name: 'nested.txt' }),
    ],
  });
  client.api.trash.purge.mockResolvedValue(null);
  renderTrash();

  userEvent.click(await screen.findByTestId('empty-trash'));
  await waitFor(() => {
    expect(client.api.trash.purge).toHaveBeenCalledWith(1);
    expect(client.api.trash.purge).toHaveBeenCalledWith(2);
  });
  expect(client.api.trash.purge).not.toHaveBeenCalledWith(3);
});

it('surfaces list failures in the error notice', async () => {
  client.api.trash.list.mockRejectedValue(
    new client.ApiError(502, 'STORAGE_UNAVAILABLE', 'Discord storage is unavailable')
  );
  renderTrash();
  expect(
    await screen.findByText('Discord storage is unavailable')
  ).toBeInTheDocument();
});
