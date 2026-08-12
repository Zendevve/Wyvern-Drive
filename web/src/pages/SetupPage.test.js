import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import SetupPage from './SetupPage';

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
});
