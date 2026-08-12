import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AppShell from './AppShell';
import { AuthProvider } from '../auth/AuthProvider';
import * as client from '../api/client';

jest.mock('../api/client', () => ({
  api: { me: jest.fn(), logout: jest.fn() },
}));

const user = { id: 1, discordId: '123456', username: 'alice', avatarUrl: null };
const drive = { id: 1, quotaBytes: 10737418240, usedBytes: 0 };

const createMatchMedia = (width) => (query) => ({
  matches: query.includes('min-width') ? width >= 768 : width < 768,
  media: query,
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
});

const renderShell = (path = '/drive') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route
            path="/drive"
            element={
              <AppShell title="Drive">
                <div>drive content</div>
              </AppShell>
            }
          />
          <Route
            path="/trash"
            element={
              <AppShell title="Trash">
                <div>trash content</div>
              </AppShell>
            }
          />
          <Route path="/login" element={<div>login stub</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );

beforeEach(() => {
  jest.clearAllMocks();
  window.matchMedia = createMatchMedia(1024);
  // The first me() call (mount) signs the user in; the refresh after logout
  // sees the session cleared, so the route guard does not bounce to /drive.
  client.api.me
    .mockReset()
    .mockResolvedValueOnce({ user, drive })
    .mockResolvedValue({ user: null, drive: null });
  client.api.logout.mockReset().mockResolvedValue(null);
});

describe('AppShell', () => {
  it('renders a skip link to the main content region', async () => {
    renderShell();
    const skip = await screen.findByRole('link', { name: 'Skip to content' });
    expect(skip).toHaveAttribute('href', '#main-content');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });

  it('labels the navigation landmark', async () => {
    renderShell();
    expect(
      await screen.findByRole('navigation', { name: 'Navigation' })
    ).toBeInTheDocument();
  });

  it('marks the active route nav item with aria-current="page"', async () => {
    renderShell('/drive');
    const driveItem = await screen.findByRole('button', { name: 'Drive' });
    expect(driveItem).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Trash' })).not.toHaveAttribute(
      'aria-current'
    );
    expect(
      screen.getByRole('button', { name: 'Settings' })
    ).not.toHaveAttribute('aria-current');
  });

  it('logs out via the sidebar control and navigates to /login', async () => {
    renderShell();
    const logout = await screen.findByTestId('sidebar-logout');
    userEvent.click(logout);
    await waitFor(() => expect(client.api.logout).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('login stub')).toBeInTheDocument();
  });
});
