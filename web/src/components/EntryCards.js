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
 * Stacked accessible cards used below 768px. Receives the exact same
 * row/action model as EntryTable so mobile and desktop behave identically.
 * Action buttons stay always visible here — touch has no hover state.
 */
export default function EntryCards({ entries, actions, onPreview }) {
  const handlePreview = onPreview || (actions && actions.onPreview);
  return (
    <List data-testid="entry-cards" aria-label="Files and folders" disablePadding>
      {entries.map((entry) => {
        const isFolder = entry.kind === 'folder';
        const previewable = !isFolder && isPreviewableMime(entry.mimeType);
        const { icon, color } = entryIcon(entry);
        const meta = isFolder
          ? fileTypeLabel(entry)
          : `${formatBytes(entry.sizeBytes)} · ${formatDate(entry.updatedAt)}`;
        return (
          <ListItem key={entry.id} disableGutters disablePadding sx={{ mb: 1 }}>
            <Card
              variant="outlined"
              onDoubleClick={() => {
                if (isFolder) {
                  actions.onOpenFolder(entry);
                } else if (previewable && handlePreview) {
                  handlePreview(entry);
                }
              }}
              sx={{ width: '100%', borderRadius: '15px', bgcolor: 'surface1' }}
            >
              <CardContent
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  py: 1.5,
                  '&:last-child': { pb: 1.5 },
                }}
              >
                <FontAwesomeIcon icon={icon} color={color} aria-hidden="true" />
                <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                  {isFolder ? (
                    <Button
                      size="small"
                      onClick={() => actions.onOpenFolder(entry)}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 500,
                        color: 'ink',
                        p: 0,
                        minWidth: 0,
                      }}
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
                {isFolder ? (
                  <IconButton
                    component="a"
                    href={archiveUrl(entry.id)}
                    aria-label={`Download ${entry.name}`}
                    title="Download"
                  >
                    <FontAwesomeIcon icon={faDownload} />
                  </IconButton>
                ) : (
                  <>
                    {previewable && (
                      <IconButton
                        aria-label={`Preview ${entry.name}`}
                        title="Preview"
                        onClick={() => handlePreview && handlePreview(entry)}
                      >
                        <FontAwesomeIcon icon={faEye} />
                      </IconButton>
                    )}
                    <IconButton
                      component="a"
                      href={downloadUrl(entry.id)}
                      aria-label={`Download ${entry.name}`}
                      title="Download"
                    >
                      <FontAwesomeIcon icon={faDownload} />
                    </IconButton>
                    <IconButton
                      aria-label={`Share ${entry.name}`}
                      title="Share"
                      onClick={() => actions.onShare(entry)}
                    >
                      <FontAwesomeIcon icon={faShareNodes} />
                    </IconButton>
                  </>
                )}
                <IconButton
                  aria-label={`Rename ${entry.name}`}
                  title="Rename"
                  onClick={() => actions.onRename(entry)}
                >
                  <FontAwesomeIcon icon={faPen} />
                </IconButton>
                <IconButton
                  aria-label={`Move ${entry.name}`}
                  title="Move"
                  onClick={() => actions.onMove(entry)}
                >
                  <FontAwesomeIcon icon={faArrowRightArrowLeft} />
                </IconButton>
                <IconButton
                  aria-label={`Copy ${entry.name}`}
                  title="Copy"
                  onClick={() => actions.onCopy(entry)}
                >
                  <FontAwesomeIcon icon={faCopy} />
                </IconButton>
                <IconButton
                  aria-label={`Delete ${entry.name}`}
                  title="Delete"
                  color="error"
                  onClick={() => actions.onDelete(entry)}
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
              </CardContent>
            </Card>
          </ListItem>
        );
      })}
    </List>
  );
}
