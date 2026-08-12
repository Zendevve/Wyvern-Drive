import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import SetupPage from './SetupPage';
import { api } from '../api/client';

jest.mock('../api/client', () => ({
  api: {
    setupMeta: jest.fn(),
    saveSetupCredentials: jest.fn(),
  },
}));

const LOOPBACK_META = {
  writesSupported: true,
  tokenRequired: false,
  clientIdConfigured: false,
  clientSecretConfigured: false,
};

const SAVE_SUCCESS = {
  ok: true,
  restartRequired: true,
  saved: ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET'],
  generated: ['WYVERN_ENCRYPTION_KEY'],
  remainingMissing: [],
  remainingInvalid: [],
};

const STATUS_WITH_DIAGNOSTICS = {
  setupRequired: true,
  usesWebhooks: true,
  storageMode: 'discord-webhooks-per-user',
  missing: ['DISCORD_CLIENT_SECRET', 'WYVERN_ENCRYPTION_KEY'],
  invalid: [{ key: 'DISCORD_REDIRECT_URI', message: 'must be an absolute http(s) URL' }],
};

const renderSetup = (status, onRetry = jest.fn()) =>
  render(
    <MemoryRouter initialEntries={['/setup']}>
      <Routes>
        <Route path="/setup" element={<SetupPage status={status} onRetry={onRetry} />} />
        <Route path="/login" element={<div>login-page</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('SetupPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.setupMeta.mockResolvedValue(LOOPBACK_META);
    api.saveSetupCredentials.mockResolvedValue(SAVE_SUCCESS);
    localStorage.clear();
  });

  afterEach(() => {
    // The clipboard override from the copy test must not leak into other tests.
    delete navigator.clipboard;
    localStorage.clear();
  });

  it('introduces the guided sign-in setup', () => {
    renderSetup(STATUS_WITH_DIAGNOSTICS);
    expect(
      screen.getByText(
        'Wyvern is ready for users as soon as sign-in is connected. This takes a few minutes.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /connect discord sign-in/i })
    ).toBeInTheDocument();
  });

  it('renders the stage-1 steps: Discord application link, redirect-URI chip, and env guidance', () => {
    renderSetup(STATUS_WITH_DIAGNOSTICS);

    // External link to the Discord developer portal, opened in a new tab.
    const appLink = screen.getByRole('link', {
      name: /discord\.com\/developers\/applications/i,
    });
    expect(appLink).toHaveAttribute('href', 'https://discord.com/developers/applications');
    expect(appLink).toHaveAttribute('target', '_blank');

    // The chip shows the concrete same-origin redirect URI, ready to copy.
    expect(screen.getByText('http://localhost/api/auth/discord/callback')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();

    // OAuth2 Redirects + Client ID/Secret into server/.env guidance.
    expect(
      screen.getByText(/add that address to OAuth2 \u2192 Redirects/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Client ID and Client Secret into your server.s environment \(server\/\.env\)/i)
    ).toBeInTheDocument();
  });

  it('renders the restart card with a recheck button that triggers onRetry', () => {
    const onRetry = jest.fn();
    renderSetup(STATUS_WITH_DIAGNOSTICS, onRetry);

    expect(screen.getByRole('heading', { name: /restart & check/i })).toBeInTheDocument();
    expect(
      screen.getByText('Restart the server, then come back here.')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('setup-recheck'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('copies the redirect URI to the clipboard with Copy/Copied states', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    renderSetup(STATUS_WITH_DIAGNOSTICS);

    await userEvent.click(screen.getByRole('button', { name: /copy/i }));
    expect(writeText).toHaveBeenCalledWith(
      'http://localhost/api/auth/discord/callback'
    );
    expect(
      await screen.findByRole('button', { name: /copied/i })
    ).toBeInTheDocument();
  });

  it('renders missing and invalid variable names without values', () => {
    renderSetup(STATUS_WITH_DIAGNOSTICS);
    expect(screen.getByRole('heading', { name: /what.s left/i })).toBeInTheDocument();
    expect(screen.getByTestId('missing-var-DISCORD_CLIENT_SECRET')).toHaveTextContent(
      'DISCORD_CLIENT_SECRET'
    );
    expect(screen.getByTestId('missing-var-WYVERN_ENCRYPTION_KEY')).toHaveTextContent(
      'WYVERN_ENCRYPTION_KEY'
    );
    expect(screen.getByTestId('invalid-var-DISCORD_REDIRECT_URI')).toHaveTextContent(
      'DISCORD_REDIRECT_URI'
    );
    expect(screen.getByTestId('invalid-var-DISCORD_REDIRECT_URI')).toHaveTextContent(
      'must be an absolute http(s) URL'
    );
    // The page renders names and messages, never values.
    expect(screen.queryByText(/top-secret|s3cr3t/i)).not.toBeInTheDocument();
  });

  it('explains what users experience once sign-in works', () => {
    renderSetup(STATUS_WITH_DIAGNOSTICS);
    expect(
      screen.getByRole('heading', { name: /for your users/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/people sign in with Discord and connect their own storage in about a minute/i)
    ).toBeInTheDocument();
  });

  it('redirects to /login when the server reports setup complete', () => {
    renderSetup({
      setupRequired: false,
      usesWebhooks: true,
      storageMode: 'discord-webhooks-per-user',
      missing: [],
      invalid: [],
    });
    expect(screen.getByText('login-page')).toBeInTheDocument();
  });

  it('shows a server-unavailable error with a working retry when status is missing', () => {
    const onRetry = jest.fn();
    renderSetup(null, onRetry);
    expect(screen.getByTestId('setup-error')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('setup-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders only the credential fields the diagnostics say are missing or invalid', async () => {
    renderSetup({
      setupRequired: true,
      usesWebhooks: true,
      storageMode: 'discord-webhooks-per-user',
      missing: ['DISCORD_CLIENT_SECRET'],
      invalid: [{ key: 'DISCORD_REDIRECT_URI', message: 'must be an absolute http(s) URL' }],
    });

    await screen.findByTestId('setup-credentials-form');

    // Client Secret is missing -> its field renders.
    expect(screen.getByTestId('setup-client-secret')).toBeInTheDocument();
    // Client ID is configured -> no field.
    expect(screen.queryByTestId('setup-client-id')).not.toBeInTheDocument();
    // The redirect URI is invalid -> the origin field renders, prefilled
    // with the browser origin (jsdom: http://localhost).
    expect(screen.getByTestId('setup-app-origin')).toBeInTheDocument();
    expect(screen.getByLabelText('Website address')).toHaveValue('http://localhost');
    // Loopback meta -> no one-time setup code field.
    expect(screen.queryByTestId('setup-token')).not.toBeInTheDocument();
  });

  it('shows the one-time setup code field when the meta requires a token and sends the typed value', async () => {
    api.setupMeta.mockResolvedValue({
      writesSupported: true,
      tokenRequired: true,
      clientIdConfigured: false,
      clientSecretConfigured: false,
    });
    renderSetup(STATUS_WITH_DIAGNOSTICS);

    await screen.findByTestId('setup-credentials-form');
    const tokenField = screen.getByLabelText('One-time setup code');
    expect(screen.getByTestId('setup-token')).toBeInTheDocument();

    await userEvent.type(tokenField, 'one-time-code-123');
    await userEvent.click(screen.getByTestId('setup-save'));

    // STATUS_WITH_DIAGNOSTICS also implies an origin (redirect URI invalid),
    // so the payload carries the prefilled origin plus the typed token.
    expect(api.saveSetupCredentials).toHaveBeenCalledWith({
      appOrigin: 'http://localhost',
      setupToken: 'one-time-code-123',
    });
  });

  it('saves client credentials, clears the secret fields, and shows restart guidance without echoing secrets', async () => {
    const SECRET = 'my-test-client-secret-0123456789';
    renderSetup({
      setupRequired: true,
      usesWebhooks: true,
      storageMode: 'discord-webhooks-per-user',
      missing: ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET'],
      invalid: [],
    });

    await screen.findByTestId('setup-credentials-form');

    await userEvent.type(
      screen.getByLabelText('Discord Client ID'),
      '123456789012345678'
    );
    await userEvent.type(screen.getByLabelText('Discord Client Secret'), SECRET);
    await userEvent.click(screen.getByTestId('setup-save'));

    // The values travel only in the API call.
    expect(api.saveSetupCredentials).toHaveBeenCalledWith({
      clientId: '123456789012345678',
      clientSecret: SECRET,
      appOrigin: 'http://localhost',
    });

    const saved = await screen.findByTestId('setup-saved');
    expect(saved).toHaveTextContent(
      'Saved on this server. Restart Wyvern, then choose Recheck.'
    );
    expect(saved).toHaveTextContent(
      'Generated on the server: WYVERN_ENCRYPTION_KEY'
    );
    expect(screen.getByTestId('setup-backup-warning')).toBeInTheDocument();

    // Both credential fields are cleared after a successful save.
    expect(screen.getByLabelText('Discord Client ID')).toHaveValue('');
    expect(screen.getByLabelText('Discord Client Secret')).toHaveValue('');

    // The secret never renders as text and the browser never persists it.
    expect(screen.queryByText(SECRET)).not.toBeInTheDocument();
    expect(localStorage.length).toBe(0);
  });

  it('maps save errors to friendly copy and never renders the raw server message', async () => {
    api.saveSetupCredentials.mockRejectedValue({
      code: 'SETUP_ORIGIN_INVALID',
      message: 'secret in message',
    });
    renderSetup(STATUS_WITH_DIAGNOSTICS);

    await screen.findByTestId('setup-credentials-form');
    await userEvent.type(
      screen.getByLabelText('Discord Client Secret'),
      's3cr3t-value-123'
    );
    await userEvent.click(screen.getByTestId('setup-save'));

    expect(await screen.findByTestId('setup-save-error')).toHaveTextContent(
      'This address is not allowed to save configuration. Open the setup page from the exact address the server is configured for, then try again.'
    );
    // The raw server message (which could echo a submitted value) is
    // suppressed, and the typed secret is still only in the input, never text.
    expect(screen.queryByText('secret in message')).not.toBeInTheDocument();
    expect(screen.queryByText('s3cr3t-value-123')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Discord Client Secret').value).toBe(
      's3cr3t-value-123'
    );
  });

  it('warns when the encryption key is invalid and disables saving', async () => {
    renderSetup({
      setupRequired: true,
      usesWebhooks: true,
      storageMode: 'discord-webhooks-per-user',
      missing: [],
      invalid: [
        { key: 'WYVERN_ENCRYPTION_KEY', message: 'must be a valid key' },
      ],
    });

    await screen.findByTestId('setup-credentials-form');
    expect(screen.getByTestId('setup-key-invalid')).toHaveTextContent(
      /restore or fix the server.s existing configuration/i
    );
    expect(screen.getByTestId('setup-save')).toBeDisabled();
  });
});
