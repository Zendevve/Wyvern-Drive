import React from 'react';
import {
  Box,
  Button,
  IconButton,
  Paper,
  Typography,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faEllipsisVertical,
  faFolder,
  faFolderPlus,
} from '@fortawesome/free-solid-svg-icons';

/**
 * Cloud-Drive Folders Quick-Access Section
 */
export default function FolderCards({
  folders = [],
  onOpenFolder,
  onNewFolder,
  onContextMenu,
}) {
  if (!folders || folders.length === 0) return null;

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography
          variant="overline"
          sx={{ color: 'text.disabled', fontSize: 11, letterSpacing: '0.06em' }}
        >
          Folders ({folders.length})
        </Typography>
        {onNewFolder && (
          <Button
            size="small"
            onClick={onNewFolder}
            startIcon={<FontAwesomeIcon icon={faFolderPlus} size="xs" />}
            sx={{
              fontSize: 12,
              py: 0.25,
              px: 1,
              color: 'text.secondary',
              textTransform: 'none',
              '&:hover': { color: 'primary.main' },
            }}
          >
            New folder
          </Button>
        )}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 1.5,
        }}
      >
        {folders.map((folder) => (
          <Paper
            key={folder.id}
            variant="outlined"
            onClick={() => onOpenFolder(folder)}
            onContextMenu={(e) => onContextMenu && onContextMenu(e, folder)}
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: 'surface1',
              borderColor: 'divider',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1.5,
              transition: 'all 120ms ease',
              '&:hover': {
                bgcolor: 'surface2',
                borderColor: 'rgba(37, 172, 232, 0.4)',
                transform: 'translateY(-1px)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                '& .folder-title': { color: 'primary.main' },
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
              <FontAwesomeIcon icon={faFolder} style={{ fontSize: 18, color: '#FBBF24', flexShrink: 0 }} />
              <Typography
                variant="body2"
                noWrap
                className="folder-title"
                sx={{
                  fontWeight: 600,
                  color: 'text.primary',
                  fontSize: 13,
                  transition: 'color 100ms ease',
                }}
              >
                {folder.name}
              </Typography>
            </Box>

            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                if (onContextMenu) onContextMenu(e, folder);
              }}
              sx={{ color: 'text.disabled', p: 0.5, flexShrink: 0 }}
            >
              <FontAwesomeIcon icon={faEllipsisVertical} size="xs" />
            </IconButton>
          </Paper>
        ))}
      </Box>
    </Box>
  );
}
