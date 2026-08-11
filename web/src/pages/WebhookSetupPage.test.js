import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import WebhookSetupPage from './WebhookSetupPage';
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
    configureWebhook: jest.fn(),
  },
  uploadFile: jest.fn(),
  downloadUrl: jest.fn(),
  shareDownloadUrl: jest.fn(),
}));

const user = { id: 1, discordId: '123456', username: 'alice', avatarUrl: null };
const drive = { id: 1, quotaBytes: 10737418240, usedBytes: 0 };

const renderConnect = () =>
  render(
    <MemoryRouter initialEntries={['/connect']}>
      <AuthProvider>
        <Routes>
          <Route path="/connect" element={<WebhookSetupPage />} />
          <Route path="/drive" element={<div>drive-page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );

beforeEach(() => {
  jest.clearAllMocks();
  // Signed in, but no storage connected yet.
  client.api.me.mockResolvedValue({ user, drive: null });
});

describe('WebhookSetupPage', () => {
  it('renders a password-style webhook input and the exact setup instructions', async () => {
    renderConnect();

    const input = await screen.findByLabelText(/Webhook URL/);
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveAttribute('autocomplete', 'off');

    expect(screen.getByText('Open a private Discord server you control (create one if needed).')).toBeInTheDocument();
    expect(screen.getByText('Open Server Settings from the server name menu.')).toBeInTheDocument();
    expect(screen.getByText('Select Integrations, then click Create Webhook.')).toBeInTheDocument();
    expect(screen.getByText('Copy the webhook URL, paste it below, and click Connect storage.')).toBeInTheDocument();
    expect(
      screen.getByText(/full-access credential/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /connect storage/i })
    ).toBeInTheDocument();
  });

  it('submits the webhook, clears the input, refreshes auth, and navigates to /drive', async () => {
    client.api.configureWebhook.mockResolvedValue(drive);
    client.api.me
      .mockResolvedValueOnce({ user, drive: null })
      .mockResolvedValue({ user, drive });

    renderConnect();
    const input = await screen.findByLabelText(/Webhook URL/);
    await userEvent.type(input, '  https://discord.com/api/webhooks/123/test-token  ');
    await userEvent.click(screen.getByRole('button', { name: /connect storage/i }));

    await waitFor(() => {
      expect(client.api.configureWebhook).toHaveBeenCalledTimes(1);
    });
    expect(client.api.configureWebhook).toHaveBeenCalledWith(
      '  https://discord.com/api/webhooks/123/test-token  '
    );
    expect(await screen.findByText('drive-page')).toBeInTheDocument();
  });

  it('renders the server error message and keeps the input on failure', async () => {
    client.api.configureWebhook.mockRejectedValue(
      new client.ApiError(400, 'INVALID_WEBHOOK', 'Invalid Discord webhook URL')
    );

    renderConnect();
    const input = await screen.findByLabelText(/Webhook URL/);
    await userEvent.type(input, 'https://discord.com/not-a-webhook');
    await userEvent.click(screen.getByRole('button', { name: /connect storage/i }));

    expect(
      await screen.findByText('Invalid Discord webhook URL')
    ).toBeInTheDocument();
    expect(input.value).toBe('https://discord.com/not-a-webhook');
    expect(client.api.configureWebhook).toHaveBeenCalledTimes(1);
  });

  it('surfaces the configured and legacy storage errors through the notice', async () => {
    client.api.configureWebhook.mockRejectedValue(
      new client.ApiError(409, 'STORAGE_ALREADY_CONFIGURED', 'Storage is already configured for this drive')
    );
    renderConnect();
    const input = await screen.findByLabelText(/Webhook URL/);
    await userEvent.type(input, 'https://discord.com/api/webhooks/123/test-token');
    await userEvent.click(screen.getByRole('button', { name: /connect storage/i }));
    expect(
      await screen.findByText('Storage is already configured for this drive')
    ).toBeInTheDocument();

    client.api.configureWebhook.mockRejectedValue(
      new client.ApiError(409, 'STORAGE_MIGRATION_REQUIRED', 'This drive was created with the legacy bot storage and must be migrated by the operator')
    );
    await userEvent.click(screen.getByRole('button', { name: /connect storage/i }));
    expect(
      await screen.findByText(/legacy bot storage/)
    ).toBeInTheDocument();

    client.api.configureWebhook.mockRejectedValue(
      new client.ApiError(502, 'STORAGE_UNAVAILABLE', 'Storage backend unavailable')
    );
    await userEvent.click(screen.getByRole('button', { name: /connect storage/i }));
    expect(
      await screen.findByText('Storage backend unavailable')
    ).toBeInTheDocument();
  });

  it('never renders the submitted URL in error output', async () => {
    client.api.configureWebhook.mockRejectedValue(
      new client.ApiError(502, 'STORAGE_UNAVAILABLE', 'Storage backend unavailable')
    );
    renderConnect();
    const input = await screen.findByLabelText(/Webhook URL/);
    await userEvent.type(input, 'https://discord.com/api/webhooks/123/test-token');
    await userEvent.click(screen.getByRole('button', { name: /connect storage/i }));

    await screen.findByText('Storage backend unavailable');
    expect(screen.queryByText(/discord\.com\/api\/webhooks/)).not.toBeInTheDocument();
  });
});
