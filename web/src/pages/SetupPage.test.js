import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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
  it('explains the OAuth2 + per-user webhook architecture', () => {
    renderSetup(STATUS_WITH_DIAGNOSTICS);
    const intro = screen.getByText(
      (_, el) =>
        el.tagName === 'P' &&
        el.textContent.includes('each user connects their own Discord webhook')
    );
    expect(intro).toBeInTheDocument();
    expect(intro.textContent).toMatch(/no bot is involved/i);
    expect(intro.textContent).toMatch(/encrypted server-side/i);
    expect(intro.textContent).toMatch(/OAuth2 application/i);
  });

  it('renders the required-variable checklist steps', () => {
    renderSetup(STATUS_WITH_DIAGNOSTICS);
    expect(screen.getByText('Create a Discord application')).toBeInTheDocument();
    expect(
      screen.getByText(/<APP_ORIGIN>\/api\/auth\/discord\/callback/)
    ).toBeInTheDocument();
    expect(screen.getByText('Point the server at a database')).toBeInTheDocument();
    expect(screen.getByText('Generate the encryption key')).toBeInTheDocument();
    expect(screen.getByText('Fill in server/.env')).toBeInTheDocument();
    expect(screen.getByText('Restart the server')).toBeInTheDocument();
  });

  it('renders missing and invalid variable names without values', () => {
    renderSetup(STATUS_WITH_DIAGNOSTICS);
    expect(screen.getByTestId('missing-var-DISCORD_CLIENT_SECRET')).toHaveTextContent(
      'DISCORD_CLIENT_SECRET'
    );
    expect(screen.getByTestId('missing-var-WYVERN_ENCRYPTION_KEY')).toHaveTextContent(
      'WYVERN_ENCRYPTION_KEY'
    );
    expect(screen.getByTestId('invalid-var-DISCORD_REDIRECT_URI')).toHaveTextContent(
      'must be an absolute http(s) URL'
    );
    // The page renders names and messages, never values.
    expect(screen.queryByText(/top-secret|s3cr3t/i)).not.toBeInTheDocument();
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
