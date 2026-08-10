import React from 'react';
import {
  Box,
  Button,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowRightArrowLeft,
  faDownload,
  faFile,
  faFolder,
  faPen,
  faShareNodes,
  faSortDown,
  faSortUp,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { downloadUrl } from '../api/client';
import { formatBytes } from './QuotaMeter';

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
        color={active ? 'primary' : 'inherit'}
        onClick={() => onSort(field)}
        endIcon={
          active ? (
            <FontAwesomeIcon icon={direction === 'asc' ? faSortUp : faSortDown} />
          ) : null
        }
      >
        {label}
      </Button>
    </TableCell>
  );
}

export default function EntryTable({ entries, sort, direction, onSort, actions }) {
  return (
    <TableContainer component={Paper} variant="outlined" data-testid="entry-table">
      <Table aria-label="Files and folders">
        <TableHead>
          <TableRow>
            <SortHeader label="Name" field="name" sort={sort} direction={direction} onSort={onSort} />
            <SortHeader label="Size" field="size" sort={sort} direction={direction} onSort={onSort} align="right" />
            <SortHeader label="Modified" field="updatedAt" sort={sort} direction={direction} onSort={onSort} />
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {entries.map((entry) => (
            <EntryRow key={entry.id} entry={entry} actions={actions} />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function EntryRow({ entry, actions }) {
  const isFolder = entry.kind === 'folder';
  return (
    <TableRow hover>
      <TableCell>
        {isFolder ? (
          <Button
            size="small"
            onClick={() => actions.onOpenFolder(entry)}
            startIcon={<FontAwesomeIcon icon={faFolder} />}
            sx={{ textTransform: 'none', fontWeight: 500 }}
          >
            {entry.name}
          </Button>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <FontAwesomeIcon icon={faFile} aria-hidden="true" />
            <span>{entry.name}</span>
          </Box>
        )}
      </TableCell>
      <TableCell align="right">{isFolder ? '—' : formatBytes(entry.sizeBytes)}</TableCell>
      <TableCell>{formatDate(entry.updatedAt)}</TableCell>
      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
        {!isFolder && (
          <IconButton
            component="a"
            href={downloadUrl(entry.id)}
            size="small"
            aria-label={`Download ${entry.name}`}
            title="Download"
          >
            <FontAwesomeIcon icon={faDownload} />
          </IconButton>
        )}
        {!isFolder && (
          <IconButton
            size="small"
            aria-label={`Share ${entry.name}`}
            title="Share"
            onClick={() => actions.onShare(entry)}
          >
            <FontAwesomeIcon icon={faShareNodes} />
          </IconButton>
        )}
        <IconButton
          size="small"
          aria-label={`Rename ${entry.name}`}
          title="Rename"
          onClick={() => actions.onRename(entry)}
        >
          <FontAwesomeIcon icon={faPen} />
        </IconButton>
        <IconButton
          size="small"
          aria-label={`Move ${entry.name}`}
          title="Move"
          onClick={() => actions.onMove(entry)}
        >
          <FontAwesomeIcon icon={faArrowRightArrowLeft} />
        </IconButton>
        <IconButton
          size="small"
          aria-label={`Delete ${entry.name}`}
          title="Delete"
          onClick={() => actions.onDelete(entry)}
        >
          <FontAwesomeIcon icon={faTrash} />
        </IconButton>
      </TableCell>
    </TableRow>
  );
}
