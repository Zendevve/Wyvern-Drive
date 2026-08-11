import React from 'react';
import {
  Box,
  Button,
  Checkbox,
  IconButton,
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
import {
  faArrowRightArrowLeft,
  faDownload,
  faPen,
  faShareNodes,
  faSortDown,
  faSortUp,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { downloadUrl } from '../api/client';
import { formatBytes } from './QuotaMeter';
import { entryIcon } from './entryIcons';

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
      sx={{ overflow: 'hidden' }}
    >
      <Table aria-label="Files and folders" sx={{ '& .MuiTableCell-root': { py: 2 } }}>
        <TableHead>
          <TableRow>
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
  const { icon, color } = entryIcon(entry);

  // Every interactive control stops propagation so the row's click only
  // toggles selection for clicks on the row surface itself.
  const stop = (fn) => (event) => {
    event.stopPropagation();
    if (fn) {
      fn(event);
    }
  };

  return (
    <TableRow
      hover
      selected={selected}
      onClick={() => onToggleSelect && onToggleSelect(entry.id)}
      sx={{
        cursor: 'pointer',
        bgcolor: 'canvas',
        '&:hover': { bgcolor: 'surface1' },
        '&.Mui-selected': { bgcolor: 'surface2' },
        '&.Mui-selected:hover': { bgcolor: 'surface2' },
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
        <Typography variant="body2" component="span" sx={{ color: 'inkMuted' }}>
          {isFolder ? '—' : formatBytes(entry.sizeBytes)}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" component="span" sx={{ color: 'inkMuted' }}>
          {formatDate(entry.updatedAt)}
        </Typography>
      </TableCell>
      <TableCell
        align="right"
        className="row-actions"
        sx={{
          whiteSpace: 'nowrap',
          opacity: 0,
          color: 'text.secondary',
          transition: 'opacity 120ms ease',
        }}
      >
        {!isFolder && (
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
        )}
        {!isFolder && (
          <IconButton
            size="small"
            aria-label={`Share ${entry.name}`}
            title="Share"
            onClick={stop(() => actions.onShare(entry))}
          >
            <FontAwesomeIcon icon={faShareNodes} />
          </IconButton>
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
      </TableCell>
    </TableRow>
  );
}
