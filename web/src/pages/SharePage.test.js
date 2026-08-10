import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SharePage from './SharePage';
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
    publicShare: jest.fn(),
  },
  shareDownloadUrl: jest.fn(),
}));
const renderShare = (token) =>
  render(
    <MemoryRouter initialEntries={[`/share/${token}`]}>
      <Routes>
        <Route path="/share/:token" element={<SharePage />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  jest.clearAllMocks();
  // NOTE: implementations are set here, not in the jest.mock factory — the
  // CRA 5 babel-jest hoist transform drops factory-set implementations.
  client.shareDownloadUrl.mockImplementation((token) => `/s/${token}`);
});

it('renders shared file metadata and a download link without login', async () => {
  client.api.publicShare.mockResolvedValue({
    name: 'report.pdf',
    sizeBytes: 2048,
    mimeType: 'application/pdf',
    expiresAt: null,
  });
  renderShare('abc123');

  expect(await screen.findByText('report.pdf')).toBeInTheDocument();
  expect(screen.getByText('2.0 KiB')).toBeInTheDocument();
  expect(screen.getByText('application/pdf')).toBeInTheDocument();
  // MUI renders component="a" controls as links once href is present.
  const download = screen.getByRole('link', { name: /download/i });
  expect(download).toHaveAttribute('download');
  expect(download.href).toBe('http://localhost/s/abc123');
});

it('shows the generic not-found state for missing, revoked, or expired shares', async () => {
  client.api.publicShare.mockRejectedValue(
    new client.ApiError(404, 'SHARE_NOT_FOUND', 'Share not found')
  );
  renderShare('missing');

  expect(await screen.findByTestId('share-not-found')).toBeInTheDocument();
  expect(screen.getByText(/not available/i)).toBeInTheDocument();
});

it('shows the expiration date for expiring shares', async () => {
  client.api.publicShare.mockResolvedValue({
    name: 'video.mp4',
    sizeBytes: 100,
    mimeType: 'video/mp4',
    expiresAt: '2026-12-31T00:00:00.000Z',
  });
  renderShare('abc123');

  expect(await screen.findByText(/expires/i)).toBeInTheDocument();
});
