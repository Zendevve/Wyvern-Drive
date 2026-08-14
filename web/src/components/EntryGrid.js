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
import { entryIcon } from './entryIcons';
import EntryActions from './EntryActions';

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Cloud-Drive Responsive File Grid
 */
export default function EntryGrid({
  entries,
  actions,
  selectedIds = new Set(),
  onToggleSelect,
  onContextMenu,
}) {
  return (
    <Box
      data-testid="entry-grid"
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 2,
      }}
    >
      {entries.map((entry) => (
        <GridCard
          key={entry.id}
          entry={entry}
          actions={actions}
          selected={selectedIds.has(entry.id)}
          onToggleSelect={onToggleSelect}
          onContextMenu={onContextMenu}
        />
      ))}
    </Box>
  );
}

function GridCard({ entry, actions, selected, onToggleSelect, onContextMenu }) {
  const isFolder = entry.kind === 'folder';
  const previewable = !isFolder && isPreviewableMime(entry.mimeType);
  const { icon, color } = entryIcon(entry);
  const meta = isFolder
    ? 'Folder'
    : `${formatBytes(entry.sizeBytes)} • ${formatDate(entry.updatedAt)}`;

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

  const handleContextMenu = (e) => {
    if (onContextMenu) {
      e.preventDefault();
      e.stopPropagation();
      onContextMenu(e, entry);
    }
  };

  return (
    <Paper
      elevation={0}
      variant="outlined"
      onClick={() => onToggleSelect && onToggleSelect(entry.id)}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      sx={{
        position: 'relative',
        borderRadius: 2.5,
        p: 2,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: selected ? 'rgba(37, 172, 232, 0.12)' : 'surface1',
        borderColor: selected ? 'primary.main' : 'divider',
        transition: 'all 120ms ease',
        '&:hover': {
          bgcolor: selected ? 'rgba(37, 172, 232, 0.18)' : 'surface2',
          borderColor: selected ? 'primary.main' : 'rgba(37, 172, 232, 0.3)',
          transform: 'translateY(-2px)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        },
        '&:hover .row-actions, &:focus-within .row-actions': { opacity: 1 },
      }}
    >
      {/* Top Header: Checkbox */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Checkbox
          size="small"
          checked={selected}
          onChange={stop(() => onToggleSelect && onToggleSelect(entry.id))}
          onClick={stop()}
          inputProps={{ 'aria-label': `Select ${entry.name}` }}
          sx={{ p: 0 }}
        />
      </Box>

      {/* Center Icon Thumbnail Stage */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 80,
          borderRadius: 2,
          bgcolor: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid',
          borderColor: 'divider',
          my: 1,
        }}
      >
        <FontAwesomeIcon
          icon={icon}
          color={color}
          style={{ fontSize: 32 }}
          aria-hidden="true"
        />
      </Box>

      {/* Entry Name & Meta */}
      <Box sx={{ flexGrow: 1, mt: 1 }}>
        {isFolder ? (
          <Button
            size="small"
            onClick={stop(() => actions.onOpenFolder(entry))}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              fontSize: 13,
              color: 'text.primary',
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
              '&:hover': { color: 'primary.main' },
            }}
          >
            {entry.name}
          </Button>
        ) : (
          <Typography
            variant="body2"
            sx={{
              fontWeight: 500,
              color: 'text.primary',
              fontSize: 13,
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
          sx={{ color: 'text.disabled', fontSize: 11.5, mt: 0.5 }}
        >
          {meta}
        </Typography>
      </Box>

      {/* Quick Hover Actions */}
      <Box
        className="row-actions"
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 0.5,
          pt: 1,
          mt: 1,
          borderTop: '1px solid',
          borderColor: 'divider',
          opacity: 0,
          transition: 'opacity 100ms ease',
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
