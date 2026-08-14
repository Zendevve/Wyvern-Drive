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
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * First-Party Cloud File Grid View (Finder / Google Drive tile grade).
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
    ? fileTypeLabel(entry)
    : `${formatBytes(entry.sizeBytes)} • ${formatDate(entry.updatedAt)}`;

  const ext = !isFolder && entry.name && entry.name.includes('.')
    ? entry.name.split('.').pop().toUpperCase()
    : isFolder ? 'DIR' : 'FILE';

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
        borderRadius: '12px',
        p: 1.5,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: selected ? 'rgba(0, 132, 255, 0.08)' : 'surface1',
        borderColor: selected ? 'accentBlue' : 'hairlineSoft',
        boxShadow: selected ? '0 0 0 1px #0084FF' : 'none',
        transition: 'all 120ms ease-out',
        '&:hover': {
          bgcolor: selected ? 'rgba(0, 132, 255, 0.12)' : 'surface2',
          borderColor: selected ? 'accentBlue' : 'rgba(255,255,255,0.14)',
          transform: 'translateY(-1px)',
        },
        '&:hover .row-actions, &:focus-within .row-actions': { opacity: 1 },
      }}
    >
      {/* Top row: Checkbox and Extension pill */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
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
            color: 'inkMuted',
            bgcolor: 'rgba(255,255,255,0.04)',
            border: '1px solid hairlineSoft',
            px: 0.75,
            py: 0.2,
            borderRadius: '4px',
            fontFamily: 'monospace',
          }}
        >
          {ext.length > 5 ? ext.slice(0, 5) : ext}
        </Typography>
      </Box>

      {/* Icon Stage */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 84,
          bgcolor: isFolder ? 'rgba(0, 132, 255, 0.04)' : 'rgba(255, 255, 255, 0.02)',
          border: '1px solid hairlineSoft',
          borderRadius: '8px',
          my: 0.75,
        }}
      >
        <FontAwesomeIcon
          icon={icon}
          color={color}
          style={{ fontSize: 32 }}
          aria-hidden="true"
        />
      </Box>

      {/* File Label */}
      <Box sx={{ flexGrow: 1, mt: 0.5 }}>
        {isFolder ? (
          <Button
            size="small"
            onClick={stop(() => actions.onOpenFolder(entry))}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              fontSize: 13,
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
            sx={{
              fontWeight: 500,
              color: 'ink',
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
          sx={{ color: 'inkMuted', fontSize: 11.5, mt: 0.4 }}
        >
          {meta}
        </Typography>
      </Box>

      {/* Row Actions */}
      <Box
        className="row-actions"
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 0.25,
          pt: 0.75,
          mt: 1,
          borderTop: '1px solid hairlineSoft',
          opacity: 0,
          transition: 'opacity 100ms ease-out',
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
