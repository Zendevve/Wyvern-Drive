import React from 'react';
import { IconButton } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowRightArrowLeft,
  faCopy,
  faDownload,
  faEye,
  faPen,
  faShareNodes,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { archiveUrl, downloadUrl } from '../api/client';

// Shared destructive hover treatment for the Delete action. Lives here and
// nowhere else so every view that uses EntryActions stays in sync.
const destructiveSx = {
  color: 'error.main',
  '&:hover': {
    color: '#FF7575',
    backgroundColor: 'rgba(255,92,92,0.08)',
  },
};

/**
 * Per-entry icon action set shared by EntryTable, EntryGrid, and EntryCards.
 * Folders get the archive download link; files get Preview (when previewable),
 * download link, and Share; every kind gets Rename/Move/Copy/Delete.
 *
 * Callbacks (`actions.onPreview/onShare/onRename/onMove/onCopy/onDelete`) may
 * be undefined and are guarded; each is invoked with `(entry)`.
 *
 * `stopPropagation` mirrors the host view: rows/cards with a surface onClick
 * (table rows, grid tiles) pass true so every click stops bubbling; cards with
 * only onDoubleClick pass false, matching the previous no-stop behavior.
 */
export default function EntryActions({
  entry,
  actions = {},
  previewable,
  size = 'small',
  stopPropagation = true,
}) {
  const isFolder = entry.kind === 'folder';

  const handle = (callback) => (event) => {
    if (stopPropagation) {
      event.stopPropagation();
    }
    if (callback) {
      callback(entry);
    }
  };

  return (
    <>
      {isFolder ? (
        <IconButton
          component="a"
          href={archiveUrl(entry.id)}
          size={size}
          aria-label={`Download ${entry.name}`}
          title={`Download ${entry.name}`}
          onClick={handle()}
        >
          <FontAwesomeIcon icon={faDownload} />
        </IconButton>
      ) : (
        <>
          {previewable && (
            <IconButton
              size={size}
              aria-label={`Preview ${entry.name}`}
              title={`Preview ${entry.name}`}
              onClick={handle(actions.onPreview)}
            >
              <FontAwesomeIcon icon={faEye} />
            </IconButton>
          )}
          <IconButton
            component="a"
            href={downloadUrl(entry.id)}
            size={size}
            aria-label={`Download ${entry.name}`}
            title={`Download ${entry.name}`}
            onClick={handle()}
          >
            <FontAwesomeIcon icon={faDownload} />
          </IconButton>
          <IconButton
            size={size}
            aria-label={`Share ${entry.name}`}
            title={`Share ${entry.name}`}
            onClick={handle(actions.onShare)}
          >
            <FontAwesomeIcon icon={faShareNodes} />
          </IconButton>
        </>
      )}
      <IconButton
        size={size}
        aria-label={`Rename ${entry.name}`}
        title={`Rename ${entry.name}`}
        onClick={handle(actions.onRename)}
      >
        <FontAwesomeIcon icon={faPen} />
      </IconButton>
      <IconButton
        size={size}
        aria-label={`Move ${entry.name}`}
        title={`Move ${entry.name}`}
        onClick={handle(actions.onMove)}
      >
        <FontAwesomeIcon icon={faArrowRightArrowLeft} />
      </IconButton>
      <IconButton
        size={size}
        aria-label={`Copy ${entry.name}`}
        title={`Copy ${entry.name}`}
        onClick={handle(actions.onCopy)}
      >
        <FontAwesomeIcon icon={faCopy} />
      </IconButton>
      <IconButton
        size={size}
        aria-label={`Delete ${entry.name}`}
        title={`Delete ${entry.name}`}
        color="error"
        onClick={handle(actions.onDelete)}
        sx={destructiveSx}
      >
        <FontAwesomeIcon icon={faTrash} />
      </IconButton>
    </>
  );
}
