import React from 'react';
import {
  Box,
  Button,
  Checkbox,
  Paper,
  Typography,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { isPreviewableMime } from '../api/client';
import { formatBytes } from './QuotaMeter';
import { entryIcon, fileTypeLabel } from './entryIcons';
import EntryActions from './EntryActions';

function formatDate(value) {
  return new Date(value).toLocaleString();
}

/**
 * Desktop grid view — Framer file tiles. Each tile is an outlined card that
 * lifts to surface2 on hover and selection; clicking the tile surface toggles
 * selection, while the folder name button and the action shelf stop
 * propagation and keep their own behaviour.
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
      <Typography
        variant="caption"
        component="p"
        noWrap
        sx={{ color: 'inkMuted' }}
      >
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
        <EntryActions
          entry={entry}
          actions={actions}
          previewable={previewable}
          size="small"
        />
      </Box>
    </Paper>
  );
}
