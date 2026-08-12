import React from 'react';
import {
  Box,
  Button,
  Checkbox,
  IconButton,
  Paper,
  Typography,
} from '@mui/material';
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
import {
  archiveUrl,
  downloadUrl,
  isPreviewableMime,
} from '../api/client';
import { formatBytes } from './QuotaMeter';
import { entryIcon, fileTypeLabel } from './entryIcons';

function formatDate(value) {
  return new Date(value).toLocaleString();
}

/**
 * Desktop grid view (Google Drive "grid" style). Each entry is a card;
 * clicking the card surface toggles selection, while the folder name button
 * and the action row stop propagation and keep their own behaviour.
 */
export default function EntryGrid({
  entries,
  actions,
  selectedIds = new Set(),
  onToggleSelect,
}) {
  return (
    <Box
      data-testid="entry-grid"
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
        gap: 2,
        p: 2,
      }}
    >
      {entries.map((entry) => (
        <GridCard
          key={entry.id}
          entry={entry}
          actions={actions}
          selected={selectedIds.has(entry.id)}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </Box>
  );
}

function GridCard({ entry, actions, selected, onToggleSelect }) {
  const isFolder = entry.kind === 'folder';
  const previewable = !isFolder && isPreviewableMime(entry.mimeType);
  const { icon, color } = entryIcon(entry);
  const meta = isFolder
    ? fileTypeLabel(entry)
    : `${formatBytes(entry.sizeBytes)} · ${formatDate(entry.updatedAt)}`;

  const stop = (fn) => (event) => {
    event.stopPropagation();
    if (fn) {
      fn(event);
    }
  };

  const handleDoubleClick = () => {
    if (isFolder) {
      actions.onOpenFolder(entry);
    } else if (previewable && actions.onPreview) {
      actions.onPreview(entry);
    }
  };

  return (
    <Paper
      elevation={0}
      variant="outlined"
      onClick={() => onToggleSelect && onToggleSelect(entry.id)}
      onDoubleClick={handleDoubleClick}
      sx={{
        position: 'relative',
        borderRadius: '15px',
        p: 1.5,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        bgcolor: selected ? 'surface2' : 'surface1',
        transition: 'background-color 150ms ease, box-shadow 150ms ease',
        '&:hover': {
          bgcolor: 'surface2',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10), 0 10px 30px rgba(0,0,0,0.25)',
        },
        '&:hover .row-actions, &:focus-within .row-actions': { opacity: 1 },
      }}
    >
      <Checkbox
        size="small"
        checked={selected}
        onChange={stop(() => onToggleSelect && onToggleSelect(entry.id))}
        onClick={stop()}
        inputProps={{ 'aria-label': `Select ${entry.name}` }}
        sx={{ position: 'absolute', top: 4, left: 4, zIndex: 1, p: 0.5 }}
      />
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 0.5 }}>
        <FontAwesomeIcon
          icon={icon}
          color={color}
          style={{ fontSize: 40 }}
          aria-hidden="true"
        />
      </Box>
      {isFolder ? (
        <Button
          size="small"
          onClick={stop(() => actions.onOpenFolder(entry))}
          sx={{
            textTransform: 'none',
            fontWeight: 500,
            color: 'ink',
            p: 0,
            minWidth: 0,
            width: '100%',
            justifyContent: 'flex-start',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {entry.name}
        </Button>
      ) : (
        <Typography
          variant="body1"
          fontWeight={500}
          sx={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {entry.name}
        </Typography>
      )}
      <Typography variant="caption" color="textSecondary" noWrap>
        {meta}
      </Typography>
      <Box
        className="row-actions"
        sx={{
          display: 'flex',
          justifyContent: 'center',
          gap: 0.5,
          mt: 0.5,
          opacity: 0,
          transition: 'opacity 120ms ease',
        }}
      >
        {isFolder ? (
          <IconButton
            component="a"
            href={archiveUrl(entry.id)}
            size="small"
            aria-label={`Download ${entry.name}`}
            title="Download"
            onClick={stop()}
          >
            <FontAwesomeIcon icon={faDownload} />
          </IconButton>
        ) : (
          <>
            {previewable && (
              <IconButton
                size="small"
                aria-label={`Preview ${entry.name}`}
                title="Preview"
                onClick={stop(() => actions.onPreview && actions.onPreview(entry))}
              >
                <FontAwesomeIcon icon={faEye} />
              </IconButton>
            )}
            <IconButton
              component="a"
              href={downloadUrl(entry.id)}
              size="small"
              aria-label={`Download ${entry.name}`}
              title="Download"
              onClick={stop()}
            >
              <FontAwesomeIcon icon={faDownload} />
            </IconButton>
            <IconButton
              size="small"
              aria-label={`Share ${entry.name}`}
              title="Share"
              onClick={stop(() => actions.onShare(entry))}
            >
              <FontAwesomeIcon icon={faShareNodes} />
            </IconButton>
          </>
        )}
        <IconButton
          size="small"
          aria-label={`Rename ${entry.name}`}
          title="Rename"
          onClick={stop(() => actions.onRename(entry))}
        >
          <FontAwesomeIcon icon={faPen} />
        </IconButton>
        <IconButton
          size="small"
          aria-label={`Move ${entry.name}`}
          title="Move"
          onClick={stop(() => actions.onMove(entry))}
        >
          <FontAwesomeIcon icon={faArrowRightArrowLeft} />
        </IconButton>
        <IconButton
          size="small"
          aria-label={`Copy ${entry.name}`}
          title="Copy"
          onClick={stop(() => actions.onCopy(entry))}
        >
          <FontAwesomeIcon icon={faCopy} />
        </IconButton>
        <IconButton
          size="small"
          aria-label={`Delete ${entry.name}`}
          title="Delete"
          color="error"
          onClick={stop(() => actions.onDelete(entry))}
          sx={{
            color: 'error.main',
            '&:hover': {
              color: '#FF7575',
              backgroundColor: 'rgba(255,92,92,0.08)',
            },
          }}
        >
          <FontAwesomeIcon icon={faTrash} />
        </IconButton>
      </Box>
    </Paper>
  );
}
