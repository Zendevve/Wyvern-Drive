import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PreviewDialog from './PreviewDialog';
import * as client from '../api/client';

jest.mock('../api/client', () => ({
  downloadUrl: jest.fn(),
}));

const imageEntry = {
  id: 1,
  parentId: null,
  kind: 'file',
  name: 'photo.png',
  sizeBytes: 2048,
  mimeType: 'image/png',
  status: 'ready',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  client.downloadUrl.mockImplementation((id, opts = {}) =>
    `/api/files/${id}/download${opts.inline ? '?inline=1' : ''}`
  );
});

afterEach(() => {
  delete global.fetch;
});

it('renders previewable media inline from the authenticated download route', () => {
  render(<PreviewDialog entry={imageEntry} onClose={() => {}} />);
  const img = screen.getByRole('img', { name: 'photo.png' });
  expect(img).toHaveAttribute('src', '/api/files/1/download?inline=1');
  expect(screen.getByText('photo.png')).toBeInTheDocument();
});

it('renders nothing when no entry is selected', () => {
  const { container } = render(<PreviewDialog entry={null} onClose={() => {}} />);
  expect(container).toBeTruthy();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('closes via the close button', () => {
  const onClose = jest.fn();
  render(<PreviewDialog entry={imageEntry} onClose={onClose} />);
  userEvent.click(screen.getByRole('button', { name: 'Close preview' }));
  expect(onClose).toHaveBeenCalled();
});

it('fetches and displays text files as plain text', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => 'line one\nline two',
  });
  const textEntry = {
    ...imageEntry,
    id: 2,
    name: 'notes.txt',
    mimeType: 'text/plain',
  };
  render(<PreviewDialog entry={textEntry} onClose={() => {}} />);
  expect(await screen.findByText(/line one/)).toBeInTheDocument();
  expect(screen.getByText(/line two/)).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith(
    '/api/files/2/download?inline=1',
    { credentials: 'include' }
  );
});

it('shows a fetch error instead of crashing for text previews', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 500,
    text: async () => '',
  });
  const textEntry = {
    ...imageEntry,
    id: 3,
    name: 'broken.txt',
    mimeType: 'text/plain',
  };
  render(<PreviewDialog entry={textEntry} onClose={() => {}} />);
  expect(
    await screen.findByText(/failed to load preview/i)
  ).toBeInTheDocument();
});
