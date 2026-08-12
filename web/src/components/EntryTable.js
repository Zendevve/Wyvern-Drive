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
  return new Date(value).toLocaleString();
}

function SortHeader({ label, field, sort, direction, onSort, align }) {
  const active = sort === field;
  return (
    <TableCell
      align={align}
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <Button
        size="small"
        color="inherit"
        onClick={() => onSort(field)}
        endIcon={
          active ? (
            <FontAwesomeIcon icon={direction === 'asc' ? faSortUp : faSortDown} />
          ) : null
        }
        sx={{
          color: 'inkMuted',
          fontWeight: active ? 600 : 500,
          '&:hover': { color: 'ink' },
        }}
      >
        {label}
      </Button>
    </TableCell>
  );
}

/**
 * Desktop list view — a ruled manifest ledger on a non-card surface.
 * The theme already styles TableCell head as uppercase micro labels; the
 * selected row carries the signal treatment (signalSoft fill + amber left
 * edge), and the action shelf stays hidden until the row is hovered or
 * focused (keyboard-reachable via Tab).
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
}) {
  const allSelected =
    entries.length > 0 && entries.every((entry) => selectedIds.has(entry.id));
  const someSelected = entries.some((entry) => selectedIds.has(entry.id));

  return (
    <TableContainer
      component={Paper}
      data-testid="entry-table"
      variant="outlined"
      sx={{ overflow: 'hidden', bgcolor: 'surface1' }}
    >
      <Table aria-label="Files and folders" sx={{ '& .MuiTableCell-root': { py: 1.5 } }}>
        <TableHead>
          <TableRow
            sx={{
              '& .MuiTableCell-head': {
                color: 'inkMuted',
                borderBottomColor: 'hairline',
              },
            }}
          >
            <TableCell padding="checkbox">
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
            <TableCell align="right">Actions</TableCell>
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
            />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function EntryRow({ entry, actions, selected, onToggleSelect }) {
  const isFolder = entry.kind === 'folder';
  const previewable = !isFolder && isPreviewableMime(entry.mimeType);
  const { icon, color } = entryIcon(entry);

  // Every interactive control stops propagation so the row's click only
  // toggles selection for clicks on the row surface itself.
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
    <TableRow
      hover
      selected={selected}
      onClick={() => onToggleSelect && onToggleSelect(entry.id)}
      onDoubleClick={handleDoubleClick}
      sx={{
        cursor: 'pointer',
        bgcolor: 'canvas',
        '&:hover': { bgcolor: 'surface1' },
        '&.Mui-selected': {
          bgcolor: 'signalSoft',
          '& .MuiTableCell-root:first-of-type': {
            boxShadow: 'inset 3px 0 0 0 rgba(217,164,65,0.9)',
          },
        },
        '&.Mui-selected:hover': { bgcolor: 'rgba(217,164,65,0.22)' },
        '&:hover .row-actions, &:focus-within .row-actions': { opacity: 1 },
      }}
    >
      <TableCell padding="checkbox">
        <Checkbox
          size="small"
          checked={selected}
          onChange={stop(() => onToggleSelect && onToggleSelect(entry.id))}
          onClick={stop()}
          inputProps={{ 'aria-label': `Select ${entry.name}` }}
        />
      </TableCell>
      <TableCell>
        {isFolder ? (
          <Button
            size="small"
            onClick={stop(() => actions.onOpenFolder(entry))}
            startIcon={
              <FontAwesomeIcon icon={icon} color={color} aria-hidden="true" />
            }
            sx={{
              textTransform: 'none',
              fontWeight: 500,
              color: 'ink',
              '&:hover': { color: 'ink' },
            }}
          >
            {entry.name}
          </Button>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <FontAwesomeIcon icon={icon} color={color} aria-hidden="true" />
            <span>{entry.name}</span>
          </Box>
        )}
      </TableCell>
      <TableCell align="right">
        <Typography
          variant="body2"
          component="span"
          sx={{
            color: 'inkMuted',
            fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
          }}
        >
          {isFolder ? '—' : formatBytes(entry.sizeBytes)}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography
          variant="body2"
          component="span"
          sx={{
            color: 'inkMuted',
            fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
          }}
        >
          {formatDate(entry.updatedAt)}
        </Typography>
      </TableCell>
      <TableCell
        align="right"
        className="row-actions"
        sx={{
          whiteSpace: 'nowrap',
          opacity: 0,
          transition: 'opacity 140ms ease',
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
