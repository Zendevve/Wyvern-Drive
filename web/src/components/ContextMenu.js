import React from 'react';
import {
  Box,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowRightArrowLeft,
  faCloudArrowUp,
  faCopy,
  faDownload,
  faEye,
  faFileCirclePlus,
  faFolderOpen,
  faFolderPlus,
  faInfoCircle,
  faPen,
  faPlay,
  faShareNodes,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { archiveUrl, downloadUrl, isPreviewableMime } from '../api/client';

/**
 * Flagship Context Menu for files, folders, and empty canvas.
 * Appears seamlessly on right-click.
 */
export default function ContextMenu({
  contextMenu, // { mouseX, mouseY, entry, isCanvas }
  onClose,
  actions = {},
  onPreview,
  onPlayTrack,
  onInspect,
  onUploadFile,
  onUploadFolder,
  onNewFolder,
  onOpenFolder,
}) {
  const open = contextMenu !== null;
  const entry = contextMenu && contextMenu.entry;
  const isCanvas = contextMenu && contextMenu.isCanvas;

  const isFolder = entry && entry.kind === 'folder';
  const isAudio = entry && (entry.mimeType || '').startsWith('audio/');
  const previewable = entry && !isFolder && isPreviewableMime(entry.mimeType);

  const handleAction = (cb) => {
    onClose();
    if (cb) cb();
  };

  return (
    <Menu
      open={open}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={
        contextMenu !== null
          ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
          : undefined
      }
      slotProps={{
        paper: {
          'data-testid': 'drive-context-menu',
          sx: {
            bgcolor: 'surface2',
            border: '1px solid hairline',
            borderRadius: '14px',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 16px 36px rgba(0,0,0,0.5)',
            py: 0.75,
            minWidth: 200,
            backdropFilter: 'blur(16px)',
          },
        },
      }}
    >
      {/* File or Folder Actions */}
      {!isCanvas && entry && (
        <Box>
          {/* Top Primary Action */}
          {isFolder ? (
            <MenuItem
              onClick={() => handleAction(() => onOpenFolder && onOpenFolder(entry))}
              sx={{ py: 1, px: 2, gap: 1 }}
            >
              <ListItemIcon sx={{ minWidth: 24, color: 'accentBlue' }}>
                <FontAwesomeIcon icon={faFolderOpen} />
              </ListItemIcon>
              <ListItemText primary="Open folder" primaryTypographyProps={{ fontSize: 13, fontWeight: 600, color: 'ink' }} />
            </MenuItem>
          ) : (
            <>
              {previewable && (
                <MenuItem
                  onClick={() => handleAction(() => onPreview && onPreview(entry))}
                  sx={{ py: 1, px: 2, gap: 1 }}
                >
                  <ListItemIcon sx={{ minWidth: 24, color: 'accentBlue' }}>
                    <FontAwesomeIcon icon={faEye} />
                  </ListItemIcon>
                  <ListItemText primary="Preview" secondary="Space" primaryTypographyProps={{ fontSize: 13, fontWeight: 600, color: 'ink' }} secondaryTypographyProps={{ fontSize: 11, color: 'inkMuted' }} />
                </MenuItem>
              )}
              {isAudio && (
                <MenuItem
                  onClick={() => handleAction(() => onPlayTrack && onPlayTrack(entry))}
                  sx={{ py: 1, px: 2, gap: 1 }}
                >
                  <ListItemIcon sx={{ minWidth: 24, color: 'accentBlue' }}>
                    <FontAwesomeIcon icon={faPlay} />
                  </ListItemIcon>
                  <ListItemText primary="Play in dock" primaryTypographyProps={{ fontSize: 13, fontWeight: 600, color: 'ink' }} />
                </MenuItem>
              )}
            </>
          )}

          <Divider sx={{ my: 0.5 }} />

          {/* Download & Share */}
          <MenuItem
            component="a"
            href={isFolder ? archiveUrl(entry.id) : downloadUrl(entry.id)}
            onClick={onClose}
            sx={{ py: 0.75, px: 2, gap: 1 }}
          >
            <ListItemIcon sx={{ minWidth: 24, color: 'inkMuted' }}>
              <FontAwesomeIcon icon={faDownload} />
            </ListItemIcon>
            <ListItemText primary={isFolder ? "Download as ZIP" : "Download"} primaryTypographyProps={{ fontSize: 13, color: 'ink' }} />
          </MenuItem>

          {!isFolder && actions.onShare && (
            <MenuItem
              onClick={() => handleAction(() => actions.onShare(entry))}
              sx={{ py: 0.75, px: 2, gap: 1 }}
            >
              <ListItemIcon sx={{ minWidth: 24, color: 'inkMuted' }}>
                <FontAwesomeIcon icon={faShareNodes} />
              </ListItemIcon>
              <ListItemText primary="Share link" primaryTypographyProps={{ fontSize: 13, color: 'ink' }} />
            </MenuItem>
          )}

          <MenuItem
            onClick={() => handleAction(() => onInspect && onInspect(entry))}
            sx={{ py: 0.75, px: 2, gap: 1 }}
          >
            <ListItemIcon sx={{ minWidth: 24, color: 'inkMuted' }}>
              <FontAwesomeIcon icon={faInfoCircle} />
            </ListItemIcon>
            <ListItemText primary="File details" secondary="Alt+I" primaryTypographyProps={{ fontSize: 13, color: 'ink' }} secondaryTypographyProps={{ fontSize: 11, color: 'inkMuted' }} />
          </MenuItem>

          <Divider sx={{ my: 0.5 }} />

          {/* Edit Operations */}
          {actions.onRename && (
            <MenuItem
              onClick={() => handleAction(() => actions.onRename(entry))}
              sx={{ py: 0.75, px: 2, gap: 1 }}
            >
              <ListItemIcon sx={{ minWidth: 24, color: 'inkMuted' }}>
                <FontAwesomeIcon icon={faPen} />
              </ListItemIcon>
              <ListItemText primary="Rename" secondary="F2" primaryTypographyProps={{ fontSize: 13, color: 'ink' }} secondaryTypographyProps={{ fontSize: 11, color: 'inkMuted' }} />
            </MenuItem>
          )}

          {actions.onMove && (
            <MenuItem
              onClick={() => handleAction(() => actions.onMove(entry))}
              sx={{ py: 0.75, px: 2, gap: 1 }}
            >
              <ListItemIcon sx={{ minWidth: 24, color: 'inkMuted' }}>
                <FontAwesomeIcon icon={faArrowRightArrowLeft} />
              </ListItemIcon>
              <ListItemText primary="Move to..." primaryTypographyProps={{ fontSize: 13, color: 'ink' }} />
            </MenuItem>
          )}

          {actions.onCopy && !isFolder && (
            <MenuItem
              onClick={() => handleAction(() => actions.onCopy(entry))}
              sx={{ py: 0.75, px: 2, gap: 1 }}
            >
              <ListItemIcon sx={{ minWidth: 24, color: 'inkMuted' }}>
                <FontAwesomeIcon icon={faCopy} />
              </ListItemIcon>
              <ListItemText primary="Make a copy" primaryTypographyProps={{ fontSize: 13, color: 'ink' }} />
            </MenuItem>
          )}

          <Divider sx={{ my: 0.5 }} />

          {/* Destructive Delete */}
          {actions.onDelete && (
            <MenuItem
              onClick={() => handleAction(() => actions.onDelete(entry))}
              sx={{
                py: 0.75,
                px: 2,
                gap: 1,
                color: 'error.main',
                '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.12)' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 24, color: 'error.main' }}>
                <FontAwesomeIcon icon={faTrash} />
              </ListItemIcon>
              <ListItemText primary="Move to trash" secondary="Del" primaryTypographyProps={{ fontSize: 13, color: 'error.main', fontWeight: 600 }} secondaryTypographyProps={{ fontSize: 11, color: 'error.light' }} />
            </MenuItem>
          )}
        </Box>
      )}

      {/* Canvas Blank Space Actions */}
      {isCanvas && (
        <Box>
          <MenuItem
            onClick={() => handleAction(onUploadFile)}
            sx={{ py: 1, px: 2, gap: 1 }}
          >
            <ListItemIcon sx={{ minWidth: 24, color: 'accentBlue' }}>
              <FontAwesomeIcon icon={faFileCirclePlus} />
            </ListItemIcon>
            <ListItemText primary="Upload files" primaryTypographyProps={{ fontSize: 13, fontWeight: 600, color: 'ink' }} />
          </MenuItem>

          <MenuItem
            onClick={() => handleAction(onUploadFolder)}
            sx={{ py: 0.75, px: 2, gap: 1 }}
          >
            <ListItemIcon sx={{ minWidth: 24, color: 'inkMuted' }}>
              <FontAwesomeIcon icon={faCloudArrowUp} />
            </ListItemIcon>
            <ListItemText primary="Upload folder" primaryTypographyProps={{ fontSize: 13, color: 'ink' }} />
          </MenuItem>

          <Divider sx={{ my: 0.5 }} />

          <MenuItem
            onClick={() => handleAction(onNewFolder)}
            sx={{ py: 0.75, px: 2, gap: 1 }}
          >
            <ListItemIcon sx={{ minWidth: 24, color: 'inkMuted' }}>
              <FontAwesomeIcon icon={faFolderPlus} />
            </ListItemIcon>
            <ListItemText primary="New folder" primaryTypographyProps={{ fontSize: 13, color: 'ink' }} />
          </MenuItem>
        </Box>
      )}
    </Menu>
  );
}
