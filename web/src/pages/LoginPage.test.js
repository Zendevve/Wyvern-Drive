import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from './LoginPage';
import { AuthProvider } from '../auth/AuthProvider';
import * as client from '../api/client';

jest.mock('../api/client', () => ({
  ApiError: class ApiError extends Error {},
  api: {
    setupStatus: jest.fn(),
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

const renderLogin = (error) =>
  render(
    <MemoryRouter initialEntries={[error ? `/login?error=${error}` : '/login']}>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>
  );

beforeEach(() => {
  jest.clearAllMocks();
  client.api.me.mockResolvedValue({ user: null });
});

describe('LoginPage OAuth errors', () => {
  it('renders the invalid-state alert', async () => {
    renderLogin('invalid_state');
    expect(await screen.findByTestId('oauth-invalid-state')).toBeInTheDocument();
  });

  it('renders the oauth-failed alert with the operator-facing copy', async () => {
    renderLogin('oauth_failed');
    const alert = await screen.findByTestId('oauth-failed');
    expect(alert).toHaveTextContent(
      "Sign-in didn't work. The person running this server may need to check their Discord setup."
    );
  });

  it('keeps the Discord sign-in button alongside error alerts', async () => {
    renderLogin('oauth_failed');
    expect(
      await screen.findByRole('button', { name: /sign in with discord/i })
    ).toBeInTheDocument();
  });
});
