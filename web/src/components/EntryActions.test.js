import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import EntryActions from './EntryActions';
import * as client from '../api/client';

jest.mock('../api/client', () => ({
  downloadUrl: jest.fn(),
  archiveUrl: jest.fn(),
}));

const fileEntry = (overrides = {}) => ({
  id: 1,
  parentId: null,
  kind: 'file',
  name: 'notes.txt',
  sizeBytes: 2048,
  mimeType: 'text/plain',
  status: 'ready',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  ...overrides,
});

const folderEntry = (overrides = {}) => ({
  id: 2,
  parentId: null,
  kind: 'folder',
  name: 'Documents',
  sizeBytes: 0,
  mimeType: null,
  status: 'ready',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  // Implementations are set here, not in the factory — the CRA 5 babel-jest
  // hoist transform drops factory-set implementations.
  client.downloadUrl.mockImplementation((id) => `/api/files/${id}/download`);
  client.archiveUrl.mockImplementation((id) => `/api/entries/${id}/archive`);
});

describe('EntryActions', () => {
  it('renders the full action set for a previewable file', () => {
    render(<EntryActions entry={fileEntry()} previewable />);
    expect(
      screen.getByRole('button', { name: 'Preview notes.txt' })
    ).toBeInTheDocument();
    const download = screen.getByRole('link', { name: 'Download notes.txt' });
    expect(download).toHaveAttribute('href', '/api/files/1/download');
    expect(
      screen.getByRole('button', { name: 'Share notes.txt' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Rename notes.txt' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Move notes.txt' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Copy notes.txt' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Delete notes.txt' })
    ).toBeInTheDocument();
  });

  it('renders a download link and no preview/share for a folder', () => {
    render(<EntryActions entry={folderEntry()} previewable />);
    const download = screen.getByRole('link', { name: 'Download Documents' });
    expect(download).toHaveAttribute('href', '/api/entries/2/archive');
    expect(
      screen.queryByRole('button', { name: 'Preview Documents' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Share Documents' })
    ).not.toBeInTheDocument();
  });

  it('omits the preview action for non-previewable files', () => {
    render(<EntryActions entry={fileEntry()} previewable={false} />);
    expect(
      screen.queryByRole('button', { name: 'Preview notes.txt' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Download notes.txt' })
    ).toBeInTheDocument();
  });

  it('gives the Delete action the shared destructive treatment', () => {
    render(<EntryActions entry={fileEntry()} previewable />);
    const deleteButton = screen.getByRole('button', { name: 'Delete notes.txt' });
    expect(deleteButton.className).toContain('MuiIconButton-colorError');
  });

  it('stops propagation by default and lets clicks bubble when disabled', () => {
    const onWrapperClick = jest.fn();
    render(
      <div onClick={onWrapperClick}>
        <EntryActions entry={fileEntry({ name: 'a.txt' })} previewable />
      </div>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Rename a.txt' }));
    expect(onWrapperClick).not.toHaveBeenCalled();

    render(
      <div onClick={onWrapperClick}>
        <EntryActions
          entry={fileEntry({ id: 3, name: 'b.txt' })}
          previewable
          stopPropagation={false}
        />
      </div>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Rename b.txt' }));
    expect(onWrapperClick).toHaveBeenCalledTimes(1);
  });

  it('invokes callbacks with the entry and tolerates missing callbacks', () => {
    const entry = fileEntry();
    const actions = {
      onPreview: jest.fn(),
      onShare: jest.fn(),
      onRename: jest.fn(),
      onMove: jest.fn(),
      onCopy: jest.fn(),
      onDelete: jest.fn(),
    };
    render(<EntryActions entry={entry} previewable actions={actions} />);
    fireEvent.click(screen.getByRole('button', { name: 'Preview notes.txt' }));
    fireEvent.click(screen.getByRole('button', { name: 'Share notes.txt' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rename notes.txt' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move notes.txt' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy notes.txt' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete notes.txt' }));
    expect(actions.onPreview).toHaveBeenCalledWith(entry);
    expect(actions.onShare).toHaveBeenCalledWith(entry);
    expect(actions.onRename).toHaveBeenCalledWith(entry);
    expect(actions.onMove).toHaveBeenCalledWith(entry);
    expect(actions.onCopy).toHaveBeenCalledWith(entry);
    expect(actions.onDelete).toHaveBeenCalledWith(entry);

    // Undefined callbacks (actions = {}) are guarded: clicking still works.
    render(<EntryActions entry={fileEntry({ id: 9, name: 'other.txt' })} previewable />);
    fireEvent.click(screen.getByRole('button', { name: 'Preview other.txt' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete other.txt' }));
  });
});
