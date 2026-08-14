import React from 'react';
import {
  Box,
  Button,
  Checkbox,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSortDown, faSortUp } from '@fortawesome/free-solid-svg-icons';
import { isPreviewableMime } from '../api/client';
import { formatBytes } from './QuotaMeter';
import { entryIcon } from './entryIcons';
import EntryActions from './EntryActions';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function SortHeader({ label, field, sort, direction, onSort, align }) {
  const active = sort === field;
  return (
    <TableCell
      align={align}
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      sx={{ py: 1 }}
    >
      <Button
        size="small"
        color="inherit"
        onClick={() => onSort(field)}
        endIcon={
          active ? (
            <FontAwesomeIcon icon={direction === 'asc' ? faSortUp : faSortDown} style={{ fontSize: 11 }} />
          ) : null
        }
        sx={{
          color: active ? 'ink' : 'inkMuted',
          fontWeight: 600,
          fontSize: 11.5,
          p: 0,
          minWidth: 0,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          '&:hover': { color: 'ink', bgcolor: 'transparent' },
        }}
      >
        {label}
      </Button>
    </TableCell>
  );
}

/**
 * First-Party Cloud File Ledger / Table View (Finder / Google Drive grade).
 */
export default function EntryTable({
  entries,
  sort,
  direction,
  onSort,
  actions,
  selectedIds = new Set(),
  onToggleSelect,
  onToggleSelectAll,
  onContextMenu,
}) {
  const allSelected =
    entries.length > 0 && entries.every((entry) => selectedIds.has(entry.id));
  const someSelected = entries.some((entry) => selectedIds.has(entry.id));

  return (
    <TableContainer
      component={Paper}
      data-testid="entry-table"
      variant="outlined"
      sx={{
        overflow: 'hidden',
        bgcolor: 'surface1',
        borderRadius: '12px',
        border: '1px solid hairlineSoft',
      }}
    >
      <Table aria-label="Files and folders" size="small" sx={{ '& .MuiTableCell-root': { py: 1.25 } }}>
        <TableHead>
          <TableRow
            sx={{
              bgcolor: 'rgba(255, 255, 255, 0.02)',
              '& .MuiTableCell-head': {
                color: 'inkMuted',
                borderBottom: '1px solid hairlineSoft',
                py: 1,
              },
            }}
          >
            <TableCell padding="checkbox" sx={{ pl: 2, width: 44 }}>
              <Checkbox
                size="small"
                checked={allSelected}
                indeterminate={someSelected && !allSelected}
                onChange={() =>
                  onToggleSelectAll &&
                  onToggleSelectAll(
                    entries.map((entry) => entry.id),
                    !allSelected
                  )
                }
                inputProps={{ 'aria-label': 'Select all' }}
                sx={{ p: 0.5 }}
              />
            </TableCell>
            <SortHeader
              label="Name"
              field="name"
              sort={sort}
              direction={direction}
              onSort={onSort}
            />
            <SortHeader
              label="Size"
              field="size"
              sort={sort}
              direction={direction}
              onSort={onSort}
              align="right"
            />
            <SortHeader
              label="Modified"
              field="updatedAt"
              sort={sort}
              direction={direction}
              onSort={onSort}
            />
            <TableCell align="right" sx={{ pr: 2, width: 140 }}>
              Actions
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {entries.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              actions={actions}
              selected={selectedIds.has(entry.id)}
              onToggleSelect={onToggleSelect}
              onContextMenu={onContextMenu}
            />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function EntryRow({ entry, actions, selected, onToggleSelect, onContextMenu }) {
  const isFolder = entry.kind === 'folder';
  const previewable = !isFolder && isPreviewableMime(entry.mimeType);
  const { icon, color } = entryIcon(entry);

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
    <TableRow
      hover
      selected={selected}
      onClick={() => onToggleSelect && onToggleSelect(entry.id)}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      sx={{
        cursor: 'pointer',
        bgcolor: selected ? 'rgba(0, 132, 255, 0.08)' : 'transparent',
        transition: 'background-color 100ms ease-out',
        '&:hover': {
          bgcolor: selected ? 'rgba(0, 132, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)',
        },
        '&.Mui-selected': {
          bgcolor: 'rgba(0, 132, 255, 0.08)',
        },
        '&.Mui-selected:hover': {
          bgcolor: 'rgba(0, 132, 255, 0.12)',
        },
        '&:hover .row-actions, &:focus-within .row-actions': { opacity: 1 },
      }}
    >
      <TableCell padding="checkbox" sx={{ pl: 2 }}>
        <Checkbox
          size="small"
          checked={selected}
          onChange={stop(() => onToggleSelect && onToggleSelect(entry.id))}
          onClick={stop()}
          inputProps={{ 'aria-label': `Select ${entry.name}` }}
          sx={{ p: 0.5 }}
        />
      </TableCell>
      <TableCell>
        {isFolder ? (
          <Button
            size="small"
            onClick={stop(() => actions.onOpenFolder(entry))}
            startIcon={
              <Box
                sx={{
                  width: 26,
                  height: 26,
                  borderRadius: '6px',
                  bgcolor: 'rgba(0, 132, 255, 0.10)',
                  border: '1px solid rgba(0, 132, 255, 0.20)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mr: 0.5,
                }}
              >
                <FontAwesomeIcon icon={icon} color={color} aria-hidden="true" style={{ fontSize: 13 }} />
              </Box>
            }
            sx={{
              textTransform: 'none',
              fontWeight: 500,
              fontSize: 13.5,
              color: 'ink',
              p: 0,
              '&:hover': { color: 'accentBlue', bgcolor: 'transparent' },
            }}
          >
            {entry.name}
          </Button>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box
              sx={{
                width: 26,
                height: 26,
                borderRadius: '6px',
                bgcolor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid hairlineSoft',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <FontAwesomeIcon icon={icon} color={color} aria-hidden="true" style={{ fontSize: 13 }} />
            </Box>
            <Typography
              variant="body2"
              sx={{ fontWeight: 500, color: 'ink', fontSize: 13.5 }}
            >
              {entry.name}
            </Typography>
          </Box>
        )}
      </TableCell>
      <TableCell align="right">
        <Typography
          variant="body2"
          component="span"
          sx={{ color: 'inkMuted', fontFamily: 'monospace', fontSize: 12.5 }}
        >
          {isFolder ? '—' : formatBytes(entry.sizeBytes)}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography
          variant="body2"
          component="span"
          sx={{ color: 'inkMuted', fontSize: 12.5 }}
        >
          {formatDate(entry.updatedAt)}
        </Typography>
      </TableCell>
      <TableCell
        align="right"
        className="row-actions"
        sx={{
          pr: 2,
          whiteSpace: 'nowrap',
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
      </TableCell>
    </TableRow>
  );
}
