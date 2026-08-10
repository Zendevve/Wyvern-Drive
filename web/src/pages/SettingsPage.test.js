import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SettingsPage from './SettingsPage';
import LoginPage from './LoginPage';
import { AuthProvider } from '../auth/AuthProvider';
import * as client from '../api/client';

jest.mock('../api/client', () => ({
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
