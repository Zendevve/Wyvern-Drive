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
 */
export default function EntryCards({ entries, actions, onPreview, onContextMenu }) {
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

        const handleContextMenu = (e) => {
          if (onContextMenu) {
            e.preventDefault();
            e.stopPropagation();
            onContextMenu(e, entry);
          }
        };

        return (
          <ListItem key={entry.id} disableGutters disablePadding sx={{ mb: 1 }}>
            <Card
              variant="outlined"
              onContextMenu={handleContextMenu}
              onDoubleClick={() => {
                if (isFolder) {
                  actions.onOpenFolder(entry);
                } else if (previewable && handlePreview) {
                  handlePreview(entry);
                }
              }}
              sx={{
                width: '100%',
                borderRadius: '16px',
                bgcolor: 'surface1',
                borderColor: 'hairline',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
              }}
            >
              <CardContent
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  py: 1.5,
                  px: 2,
                  '&:last-child': { pb: 1.5 },
                }}
              >
                <Box
                  sx={{
                    width: 34,
                    height: 34,
                    borderRadius: '8px',
                    bgcolor: 'surface2',
                    border: '1px solid hairlineSoft',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <FontAwesomeIcon icon={icon} color={color} aria-hidden="true" style={{ fontSize: 16 }} />
                </Box>
                <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                  {isFolder ? (
                    <Button
                      size="small"
                      onClick={() => actions.onOpenFolder(entry)}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 600,
                        fontSize: 14,
                        color: 'ink',
                        p: 0,
                        minWidth: 0,
                        textAlign: 'left',
                      }}
                    >
                      {entry.name}
                    </Button>
                  ) : (
                    <Typography variant="body2" noWrap sx={{ fontWeight: 600, color: 'ink', fontSize: 14 }}>
                      {entry.name}
                    </Typography>
                  )}
                  <Typography
                    variant="caption"
                    component="p"
                    sx={{ color: 'inkMuted', fontSize: 12, mt: 0.2 }}
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
