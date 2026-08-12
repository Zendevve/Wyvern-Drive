import React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  List,
  ListItem,
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
 * Stacked accessible cards used below 768px. Receives the exact same
 * row/action model as EntryTable so mobile and desktop behave identically.
 * Action buttons stay always visible here — touch has no hover state, and
 * the cards have no surface onClick (only onDoubleClick), so EntryActions
 * runs with stopPropagation={false} exactly like the previous no-stop
 * handlers.
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
                  <Typography
                    variant="caption"
                    component="p"
                    sx={{ color: 'inkMuted' }}
                  >
                    {meta}
                  </Typography>
                </Box>
                <EntryActions
                  entry={entry}
                  actions={actions}
                  previewable={previewable}
                  size="medium"
                  stopPropagation={false}
                />
              </CardContent>
            </Card>
          </ListItem>
        );
      })}
    </List>
  );
}
