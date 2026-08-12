import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';
import * as client from './api/client';

jest.mock('./api/client', () => ({
  ApiError: class ApiError extends Error {},
  api: {
    setupStatus: jest.fn(),
    me: jest.fn(),
    drive: jest.fn(),
    configureWebhook: jest.fn(),
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
  shareDownloadUrl: jest.fn(),
}));

const user = { id: 1, discordId: '123456', username: 'alice', avatarUrl: null };
const drive = { id: 1, quotaBytes: 10737418240, usedBytes: 0 };

const COMPLETE_STATUS = {
  setupRequired: false,
  usesWebhooks: true,
  storageMode: 'discord-webhooks-per-user',
  missing: [],
  invalid: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  // NOTE: implementations are set here, not in the jest.mock factory — the
  // CRA 5 babel-jest hoist transform drops factory-set implementations.
  client.downloadUrl.mockImplementation((id) => `/api/files/${id}/download`);
  client.shareDownloadUrl.mockImplementation((token) => `/s/${token}`);
  window.history.pushState({}, '', '/');
  client.api.setupStatus.mockResolvedValue(COMPLETE_STATUS);
  client.api.me.mockResolvedValue({ user: null });
  client.api.entries.mockResolvedValue({ entries: [] });
});

describe('auth gating', () => {
  it('redirects unauthenticated users from /drive to the login page', async () => {
    window.history.pushState({}, '', '/drive');
    render(<App />);
    expect(
      await screen.findByRole('button', { name: /sign in with discord/i })
    ).toBeInTheDocument();
  });

  it('redirects unauthenticated users from /settings to the login page', async () => {
    window.history.pushState({}, '', '/settings');
    render(<App />);
    expect(
      await screen.findByRole('button', { name: /sign in with discord/i })
    ).toBeInTheDocument();
  });

  it('redirects authenticated users from /login to the drive', async () => {
    client.api.me.mockResolvedValue({ user, drive });
    client.api.entries.mockResolvedValue({ entries: [] });
    window.history.pushState({}, '', '/login');
    render(<App />);
    expect(await screen.findByText('This folder is empty')).toBeInTheDocument();
  });

  it('renders the trash page at /trash for authenticated users', async () => {
    client.api.me.mockResolvedValue({ user, drive });
    client.api.trash.list.mockResolvedValue({ entries: [] });
    window.history.pushState({}, '', '/trash');
    render(<App />);
    expect(await screen.findByTestId('trash-page')).toBeInTheDocument();
  });

  it('sends a signed-in user with no storage to /connect from protected routes', async () => {
    client.api.me.mockResolvedValue({ user, drive: null });
    window.history.pushState({}, '', '/drive');
    render(<App />);
    expect(await screen.findByTestId('webhook-setup-page')).toBeInTheDocument();
  });

  it('sends an anonymous user away from /connect to /login', async () => {
    window.history.pushState({}, '', '/connect');
    render(<App />);
    expect(
      await screen.findByRole('button', { name: /sign in with discord/i })
    ).toBeInTheDocument();
  });

  it('sends a configured user from /connect to the drive', async () => {
    client.api.me.mockResolvedValue({ user, drive });
    client.api.entries.mockResolvedValue({ entries: [] });
    window.history.pushState({}, '', '/connect');
    render(<App />);
    expect(await screen.findByText('This folder is empty')).toBeInTheDocument();
  });

  it('renders the public share page without a session', async () => {
    client.api.publicShare.mockResolvedValue({
      name: 'photo.png',
      sizeBytes: 1024,
      mimeType: 'image/png',
      expiresAt: null,
    });
    window.history.pushState({}, '', '/share/abc123');
    render(<App />);
    expect(await screen.findByText('photo.png')).toBeInTheDocument();
    // MUI renders component="a" controls as links once href is present.
    const download = screen.getByRole('link', { name: /download/i });
    expect(download).toHaveAttribute('download');
    expect(download.href).toBe('http://localhost/s/abc123');
  });
});

describe('setup gating', () => {
  it('redirects every route to the setup page while setup is required', async () => {
    client.api.setupStatus.mockResolvedValue({
      setupRequired: true,
      usesWebhooks: true,
      storageMode: 'discord-webhooks-per-user',
      missing: ['DISCORD_CLIENT_SECRET'],
      invalid: [],
    });
    window.history.pushState({}, '', '/drive');
    render(<App />);
    expect(await screen.findByTestId('setup-page')).toBeInTheDocument();
    expect(
      await screen.findByTestId('missing-var-DISCORD_CLIENT_SECRET')
    ).toBeInTheDocument();
    // The login surface must not be reachable while setup is pending.
    expect(
      screen.queryByRole('button', { name: /sign in with discord/i })
    ).not.toBeInTheDocument();
  });

  it('passes through to the normal app when setup is complete', async () => {
    window.history.pushState({}, '', '/drive');
    render(<App />);
    expect(
      await screen.findByRole('button', { name: /sign in with discord/i })
    ).toBeInTheDocument();
    expect(screen.queryByTestId('setup-page')).not.toBeInTheDocument();
  });

  it('shows a server-unavailable error on the setup page and retries', async () => {
    client.api.setupStatus
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({
        setupRequired: true,
        usesWebhooks: true,
        storageMode: 'discord-webhooks-per-user',
        missing: ['WYVERN_ENCRYPTION_KEY'],
        invalid: [],
      });
    window.history.pushState({}, '', '/setup');
    render(<App />);
    expect(await screen.findByTestId('setup-error')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('setup-retry'));
    expect(
      await screen.findByTestId('missing-var-WYVERN_ENCRYPTION_KEY')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('setup-error')).not.toBeInTheDocument();
  });
});
