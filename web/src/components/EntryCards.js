import React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  List,
  ListItem,
  Typography,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowRightArrowLeft,
  faDownload,
  faFile,
  faFolder,
  faPen,
  faShareNodes,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { downloadUrl } from '../api/client';
import { formatBytes } from './QuotaMeter';

function formatDate(value) {
  return new Date(value).toLocaleString();
}

/**
 * Stacked accessible cards used below 768px. Receives the exact same
 * row/action model as EntryTable so mobile and desktop behave identically.
 */
export default function EntryCards({ entries, actions }) {
  return (
    <List data-testid="entry-cards" aria-label="Files and folders" disablePadding>
      {entries.map((entry) => {
        const isFolder = entry.kind === 'folder';
        const meta = isFolder
          ? 'Folder'
          : `${formatBytes(entry.sizeBytes)} · ${formatDate(entry.updatedAt)}`;
        return (
          <ListItem key={entry.id} disableGutters disablePadding sx={{ mb: 1 }}>
            <Card variant="outlined" sx={{ width: '100%' }}>
              <CardContent
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  py: 1.5,
                  '&:last-child': { pb: 1.5 },
                }}
              >
                <FontAwesomeIcon icon={isFolder ? faFolder : faFile} aria-hidden="true" />
                <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                  {isFolder ? (
                    <Button
                      size="small"
                      onClick={() => actions.onOpenFolder(entry)}
                      sx={{ textTransform: 'none', fontWeight: 500, p: 0, minWidth: 0 }}
                    >
                      {entry.name}
                    </Button>
                  ) : (
                    <Typography variant="body2" noWrap>
                      {entry.name}
                    </Typography>
                  )}
                  <Typography variant="caption" color="textSecondary" component="p">
                    {meta}
                  </Typography>
                </Box>
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
              </CardContent>
            </Card>
          </ListItem>
        );
      })}
    </List>
  );
}
