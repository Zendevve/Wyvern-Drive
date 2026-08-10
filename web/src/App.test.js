import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';
import * as client from './api/client';

jest.mock('./api/client', () => ({
  ApiError: class ApiError extends Error {},
  api: {
    me: jest.fn(),
    drive: jest.fn(),
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
const drive = { id: 1, quotaBytes: 10737418240, usedBytes: 0 };

beforeEach(() => {
  jest.clearAllMocks();
  // NOTE: implementations are set here, not in the jest.mock factory — the
  // CRA 5 babel-jest hoist transform drops factory-set implementations.
  client.downloadUrl.mockImplementation((id) => `/api/files/${id}/download`);
  client.shareDownloadUrl.mockImplementation((token) => `/s/${token}`);
  window.history.pushState({}, '', '/');
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
