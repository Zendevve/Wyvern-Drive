import React from 'react';
import {
  Box,
  IconButton,
  Paper,
  Typography,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faEllipsisVertical,
  faFolder,
  faPlus,
} from '@fortawesome/free-solid-svg-icons';

/**
 * Pinned / Top Folder Tiles (matching Cloudy reference UI).
 */
export default function FolderCards({
  folders = [],
  onOpenFolder,
  onNewFolder,
  onContextMenu,
}) {
  if (!folders || folders.length === 0) return null;

  return (
    <Box sx={{ mb: 3.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, color: 'ink', fontSize: 15, display: 'flex', alignItems: 'center', gap: 1 }}>
          Folders
          {onNewFolder && (
            <IconButton
              size="small"
              onClick={onNewFolder}
              title="Create new folder"
              sx={{
                width: 24,
                height: 24,
                bgcolor: 'rgba(30, 134, 255, 0.12)',
                color: 'accentBlue',
                '&:hover': { bgcolor: 'rgba(30, 134, 255, 0.24)' },
              }}
            >
              <FontAwesomeIcon icon={faPlus} size="xs" />
            </IconButton>
          )}
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 2,
        }}
      >
        {folders.map((folder) => (
          <Paper
            key={folder.id}
            variant="outlined"
            onClick={() => onOpenFolder(folder)}
            onContextMenu={(e) => onContextMenu && onContextMenu(e, folder)}
            sx={{
              p: 2,
              borderRadius: '14px',
              bgcolor: 'surface1',
              borderColor: 'hairlineSoft',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              position: 'relative',
              transition: 'all 140ms ease-out',
              '&:hover': {
                bgcolor: 'surface2',
                borderColor: 'rgba(255, 176, 32, 0.35)',
                transform: 'translateY(-2px)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: '10px',
                  bgcolor: 'rgba(255, 176, 32, 0.12)',
                  border: '1px solid rgba(255, 176, 32, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFB020',
                }}
              >
                <FontAwesomeIcon icon={faFolder} style={{ fontSize: 18 }} />
              </Box>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onContextMenu) onContextMenu(e, folder);
                }}
                sx={{ color: 'inkMuted', p: 0.5 }}
              >
                <FontAwesomeIcon icon={faEllipsisVertical} size="xs" />
              </IconButton>
            </Box>

            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="body2"
                noWrap
                sx={{ fontWeight: 600, color: 'ink', fontSize: 13.5, mb: 0.25 }}
              >
                {folder.name}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: 'inkMuted', fontSize: 11.5 }}
              >
                Directory
              </Typography>
            </Box>
          </Paper>
        ))}
      </Box>
    </Box>
  );
}
