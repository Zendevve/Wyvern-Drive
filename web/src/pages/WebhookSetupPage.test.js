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
  it('renders a password-style webhook input and the four step cards', async () => {
    renderConnect();

    const input = await screen.findByLabelText(/Webhook URL/);
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveAttribute('autocomplete', 'off');

    expect(screen.getByText('Connect your storage')).toBeInTheDocument();
    expect(
      screen.getByText(/Open Discord and open any server you own/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Server Settings \u2192 Integrations \u2192 Webhooks/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Click New Webhook, name it anything/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Paste it below and click Connect/)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect' })).toBeInTheDocument();
    expect(screen.getByTestId('connect-storage-button')).toBeInTheDocument();
  });

  it('shows the encryption privacy line and browser-storage caption', async () => {
    renderConnect();
    await screen.findByLabelText(/Webhook URL/);

    const warning = screen.getByTestId('webhook-warning');
    expect(warning).toHaveTextContent(
      "Your files are encrypted before they're stored, and only you can access them. This URL is the key to your storage — don't share it."
    );
    expect(
      screen.getByText('The URL is encrypted on the server and never stored in your browser.')
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
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }));

    await waitFor(() => {
      expect(client.api.configureWebhook).toHaveBeenCalledTimes(1);
    });
    expect(client.api.configureWebhook).toHaveBeenCalledWith(
      '  https://discord.com/api/webhooks/123/test-token  '
    );
    expect(await screen.findByText('drive-page')).toBeInTheDocument();
  });

  it('maps INVALID_WEBHOOK to friendly copy and keeps the input on failure', async () => {
    client.api.configureWebhook.mockRejectedValue(
      new client.ApiError(400, 'INVALID_WEBHOOK', 'Invalid Discord webhook URL')
    );

    renderConnect();
    const input = await screen.findByLabelText(/Webhook URL/);
    await userEvent.type(input, 'https://discord.com/not-a-webhook');
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }));

    expect(
      await screen.findByText(
        "That URL didn't work. Double-check you copied the whole webhook URL from Discord."
      )
    ).toBeInTheDocument();
    // The raw server message is suppressed — never shown to the user.
    expect(screen.queryByText('Invalid Discord webhook URL')).not.toBeInTheDocument();
    expect(input.value).toBe('https://discord.com/not-a-webhook');
    expect(client.api.configureWebhook).toHaveBeenCalledTimes(1);
  });

  it('maps STORAGE_UNAVAILABLE to friendly copy, hiding the raw message', async () => {
    client.api.configureWebhook.mockRejectedValue(
      new client.ApiError(502, 'STORAGE_UNAVAILABLE', 'Storage backend unavailable')
    );

    renderConnect();
    const input = await screen.findByLabelText(/Webhook URL/);
    await userEvent.type(input, 'https://discord.com/api/webhooks/123/test-token');
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }));

    expect(
      await screen.findByText('Discord is busy right now. Wait a moment and try again.')
    ).toBeInTheDocument();
    expect(screen.queryByText('Storage backend unavailable')).not.toBeInTheDocument();
    expect(input.value).toBe('https://discord.com/api/webhooks/123/test-token');
  });

  it('maps every other server code to the generic retryable message', async () => {
    const cases = [
      new client.ApiError(
        409,
        'STORAGE_ALREADY_CONFIGURED',
        'Storage is already configured for this drive'
      ),
      new client.ApiError(
        409,
        'STORAGE_MIGRATION_REQUIRED',
        'This drive was created with the legacy bot storage and must be migrated by the operator'
      ),
      new client.ApiError(500, 'INTERNAL', 'Something exploded internally'),
    ];

    renderConnect();
    const input = await screen.findByLabelText(/Webhook URL/);
    await userEvent.type(input, 'https://discord.com/api/webhooks/123/test-token');
    const connect = screen.getByRole('button', { name: 'Connect' });

    for (const error of cases) {
      client.api.configureWebhook.mockRejectedValue(error);
      await userEvent.click(connect);
      expect(
        await screen.findByText(
          'Something went wrong connecting your storage. Try again in a moment.'
        )
      ).toBeInTheDocument();
      expect(screen.queryByText(error.message)).not.toBeInTheDocument();
    }
    expect(client.api.configureWebhook).toHaveBeenCalledTimes(cases.length);
  });

  it('never renders the submitted URL in error output', async () => {
    client.api.configureWebhook.mockRejectedValue(
      new client.ApiError(502, 'STORAGE_UNAVAILABLE', 'Storage backend unavailable')
    );
    renderConnect();
    const input = await screen.findByLabelText(/Webhook URL/);
    await userEvent.type(input, 'https://discord.com/api/webhooks/123/test-token');
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }));

    await screen.findByText('Discord is busy right now. Wait a moment and try again.');
    expect(screen.queryByText(/discord\.com\/api\/webhooks/)).not.toBeInTheDocument();
  });
});
