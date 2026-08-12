import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SettingsPage from './SettingsPage';
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

const user = { id: 1, discordId: '987654321', username: 'wyvern', avatarUrl: null };
const drive = { id: 1, quotaBytes: 10737418240, usedBytes: 1073741824 };

// Mirrors App.js: the AuthProvider redirect from /settings lands on /login.
const renderSettings = () =>
  render(
    <MemoryRouter initialEntries={['/settings']}>
      <AuthProvider>
        <Routes>
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );

beforeEach(() => {
  jest.clearAllMocks();
  client.api.me.mockResolvedValue({ user, drive });
  client.api.logout.mockResolvedValue(null);
  client.api.webhooks.list.mockResolvedValue({ webhooks: [] });
});

it('shows the authenticated Discord identity and quota usage', async () => {
  renderSettings();

  expect(await screen.findByRole('heading', { name: 'wyvern' })).toBeInTheDocument();
  expect(screen.getByText('Discord ID: 987654321')).toBeInTheDocument();
  // Quota appears in both the sidebar and the settings card.
  const quotaTexts = screen.getAllByText('1.0 GiB of 10.0 GiB used');
  expect(quotaTexts.length).toBeGreaterThanOrEqual(1);
});

it('logs out and returns to the login page', async () => {
  client.api.me
    .mockResolvedValueOnce({ user, drive })
    .mockResolvedValue({ user: null });
  renderSettings();

  await screen.findByRole('heading', { name: 'wyvern' });
  userEvent.click(screen.getByTestId('logout-button'));

  await waitFor(() => expect(client.api.logout).toHaveBeenCalledTimes(1));
  expect(
    await screen.findByRole('button', { name: /sign in with discord/i })
  ).toBeInTheDocument();
});

describe('webhook management', () => {
  it('lists the configured webhooks', async () => {
    client.api.webhooks.list.mockResolvedValue({
      webhooks: [
        { id: 1, createdAt: '2026-06-01T00:00:00.000Z' },
        { id: 2, createdAt: '2026-07-01T00:00:00.000Z' },
      ],
    });
    renderSettings();

    expect(await screen.findByText('Webhook #1')).toBeInTheDocument();
    expect(screen.getByText('Webhook #2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove webhook 1/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove webhook 2/i })).toBeInTheDocument();
  });

  it('shows an empty hint when no webhooks are configured', async () => {
    renderSettings();
    expect(
      await screen.findByText(/no webhooks configured yet/i)
    ).toBeInTheDocument();
  });

  it('adds a webhook through the form and reloads the list', async () => {
    client.api.webhooks.list
      .mockResolvedValueOnce({ webhooks: [] })
      .mockResolvedValue({
        webhooks: [{ id: 3, createdAt: '2026-08-01T00:00:00.000Z' }],
      });
    client.api.webhooks.add.mockResolvedValue(null);
    renderSettings();

    await screen.findByText(/no webhooks configured yet/i);
    userEvent.type(
      screen.getByRole('textbox', { name: /webhook url/i }),
      'https://discord.com/api/webhooks/123/token'
    );
    userEvent.click(screen.getByTestId('add-webhook'));

    await waitFor(() =>
      expect(client.api.webhooks.add).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/123/token'
      )
    );
    expect(await screen.findByText('Webhook #3')).toBeInTheDocument();
  });

  it('removes a webhook and reloads the list', async () => {
    client.api.webhooks.list
      .mockResolvedValueOnce({
        webhooks: [{ id: 7, createdAt: '2026-06-01T00:00:00.000Z' }],
      })
      .mockResolvedValue({ webhooks: [] });
    client.api.webhooks.remove.mockResolvedValue(null);
    renderSettings();

    userEvent.click(await screen.findByTestId('remove-webhook-7'));
    await waitFor(() =>
      expect(client.api.webhooks.remove).toHaveBeenCalledWith(7)
    );
    expect(
      await screen.findByText(/no webhooks configured yet/i)
    ).toBeInTheDocument();
  });

  it('surfaces WEBHOOK_IN_USE with guidance when removal is blocked', async () => {
    client.api.webhooks.list.mockResolvedValue({
      webhooks: [{ id: 9, createdAt: '2026-06-01T00:00:00.000Z' }],
    });
    client.api.webhooks.remove.mockRejectedValue(
      new client.ApiError(
        409,
        'WEBHOOK_IN_USE',
        'Webhook is in use by stored content'
      )
    );
    renderSettings();

    userEvent.click(await screen.findByTestId('remove-webhook-9'));
    expect(
      await screen.findByText('Webhook is in use by stored content')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/permanently delete those files first/i)
    ).toBeInTheDocument();
  });
});
