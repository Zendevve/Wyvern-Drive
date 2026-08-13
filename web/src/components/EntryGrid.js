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
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 2.5,
        p: 0.5,
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

  // File extension badge text
  const ext = !isFolder && entry.name && entry.name.includes('.')
    ? entry.name.split('.').pop().toUpperCase()
    : isFolder ? 'FOLDER' : 'FILE';

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
        borderRadius: '16px',
        p: 2,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: selected ? 'surface2' : 'surface1',
        borderColor: selected ? 'accentBlue' : 'hairline',
        boxShadow: selected
          ? '0 0 0 1px #0099FF, 0 8px 24px rgba(0,0,0,0.3)'
          : 'inset 0 1px 0 rgba(255,255,255,0.06)',
        transition: 'all 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        '&:hover': {
          bgcolor: 'surface2',
          borderColor: selected ? 'accentBlue' : 'rgba(255,255,255,0.16)',
          transform: 'translateY(-2px)',
          boxShadow: selected
            ? '0 0 0 1px #0099FF, 0 12px 32px rgba(0,0,0,0.4)'
            : 'inset 0 1px 0 rgba(255,255,255,0.10), 0 12px 32px rgba(0,0,0,0.35)',
        },
        '&:hover .row-actions, &:focus-within .row-actions': { opacity: 1 },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Checkbox
          size="small"
          checked={selected}
          onChange={stop(() => onToggleSelect && onToggleSelect(entry.id))}
          onClick={stop()}
          inputProps={{ 'aria-label': `Select ${entry.name}` }}
          sx={{ p: 0.25 }}
        />
        <Typography
          variant="caption"
          sx={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.5px',
            color: 'inkMuted',
            bgcolor: 'rgba(255,255,255,0.05)',
            border: '1px solid hairlineSoft',
            px: 1,
            py: 0.25,
            borderRadius: '6px',
            fontFamily: 'monospace',
          }}
        >
          {ext.length > 6 ? ext.slice(0, 6) : ext}
        </Typography>
      </Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 96,
          bgcolor: 'rgba(255,255,255,0.02)',
          border: '1px solid hairlineSoft',
          borderRadius: '12px',
          my: 1,
        }}
      >
        <FontAwesomeIcon
          icon={icon}
          color={color}
          style={{ fontSize: 38 }}
          aria-hidden="true"
        />
      </Box>
      <Box sx={{ flexGrow: 1, mt: 0.5 }}>
        {isFolder ? (
          <Button
            size="small"
            onClick={stop(() => actions.onOpenFolder(entry))}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              fontSize: 14,
              color: 'ink',
              p: 0,
              minWidth: 0,
              width: '100%',
              justifyContent: 'flex-start',
              textAlign: 'left',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: 1.3,
            }}
          >
            {entry.name}
          </Button>
        ) : (
          <Typography
            variant="body2"
            fontWeight={600}
            sx={{
              color: 'ink',
              fontSize: 14,
              lineHeight: 1.3,
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
          sx={{ color: 'inkMuted', fontSize: 12, mt: 0.5 }}
        >
          {meta}
        </Typography>
      </Box>
      <Box
        className="row-actions"
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 0.25,
          pt: 1,
          mt: 1.5,
          borderTop: '1px solid hairlineSoft',
          opacity: 0,
          transition: 'opacity 150ms ease',
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
