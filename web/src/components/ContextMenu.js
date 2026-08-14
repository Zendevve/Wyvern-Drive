import React from 'react';
import {
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowRightArrowLeft,
  faCircleInfo,
  faCopy,
  faDownload,
  faEye,
  faFolderOpen,
  faFolderPlus,
  faFolderTree,
  faPen,
  faPlay,
  faShareNodes,
  faTrash,
  faUpload,
} from '@fortawesome/free-solid-svg-icons';
import {
  archiveUrl,
  downloadUrl,
  isPreviewableMime,
} from '../api/client';

/**
 * Cloud-Drive Context Menu
 */
export default function ContextMenu({
  contextMenu,
  onClose,
  onUploadFiles,
  onUploadFolder,
  onNewFolder,
  onOpenFolder,
  onPreview,
  onPlayTrack,
  onShare,
  onRename,
  onMove,
  onCopy,
  onDelete,
  onShowDetails,
}) {
  if (!contextMenu) return null;

  const { mouseX, mouseY, entry, isCanvas } = contextMenu;
  const isFolder = entry && entry.kind === 'folder';
  const isAudio =
    entry &&
    !isFolder &&
    ((entry.mimeType && entry.mimeType.startsWith('audio/')) ||
      (entry.name && entry.name.toLowerCase().endsWith('.m4b')));
  const previewable = entry && !isFolder && isPreviewableMime(entry.mimeType);

  const handleAction = (fn) => {
    onClose();
    if (fn) fn();
  };

  return (
    <Menu
      open={contextMenu !== null}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={
        mouseX !== null && mouseY !== null
          ? { top: mouseY, left: mouseX }
          : undefined
      }
      slotProps={{
        paper: {
          sx: {
            minWidth: 200,
            borderRadius: 2,
            bgcolor: 'surfaceElevated',
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 12px 36px rgba(0,0,0,0.85), 0 0 16px rgba(37, 172, 232, 0.1)',
            py: 0.5,
          },
        },
      }}
    >
      {isCanvas ? (
        [
          <MenuItem
            key="upload"
            onClick={() => handleAction(onUploadFiles)}
          >
            <ListItemIcon sx={{ color: 'text.secondary', minWidth: 28 }}>
              <FontAwesomeIcon icon={faUpload} size="sm" />
            </ListItemIcon>
            <ListItemText primary="Upload files" />
          </MenuItem>,
          <MenuItem
            key="folder-upload"
            onClick={() => handleAction(onUploadFolder)}
          >
            <ListItemIcon sx={{ color: 'text.secondary', minWidth: 28 }}>
              <FontAwesomeIcon icon={faFolderTree} size="sm" />
            </ListItemIcon>
            <ListItemText primary="Upload folder" />
          </MenuItem>,
          <MenuItem
            key="new-folder"
            onClick={() => handleAction(onNewFolder)}
          >
            <ListItemIcon sx={{ color: 'text.secondary', minWidth: 28 }}>
              <FontAwesomeIcon icon={faFolderPlus} size="sm" />
            </ListItemIcon>
            <ListItemText primary="New folder" />
          </MenuItem>,
        ]
      ) : (
        [
          <MenuItem
            key="header"
            disabled
            sx={{
              opacity: '1 !important',
              borderBottom: '1px solid',
              borderColor: 'divider',
              py: 0.75,
              mb: 0.5,
            }}
          >
            <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600, fontSize: 11 }}>
              {entry && (entry.name.length > 22 ? `${entry.name.slice(0, 22)}…` : entry.name)}
            </Typography>
          </MenuItem>,
          isFolder && (
            <MenuItem
              key="open"
              onClick={() => handleAction(() => onOpenFolder(entry))}
            >
              <ListItemIcon sx={{ color: 'warning.main', minWidth: 28 }}>
                <FontAwesomeIcon icon={faFolderOpen} size="sm" />
              </ListItemIcon>
              <ListItemText primary="Open" />
            </MenuItem>
          ),
          previewable && (
            <MenuItem
              key="preview"
              onClick={() => handleAction(() => onPreview(entry))}
            >
              <ListItemIcon sx={{ color: 'primary.main', minWidth: 28 }}>
                <FontAwesomeIcon icon={faEye} size="sm" />
              </ListItemIcon>
              <ListItemText primary="Preview" secondary="Space" />
            </MenuItem>
          ),
          isAudio && (
            <MenuItem
              key="play"
              onClick={() => handleAction(() => onPlayTrack(entry))}
            >
              <ListItemIcon sx={{ color: 'info.main', minWidth: 28 }}>
                <FontAwesomeIcon icon={faPlay} size="sm" />
              </ListItemIcon>
              <ListItemText primary="Play audio" />
            </MenuItem>
          ),
          <MenuItem
            key="download"
            onClick={() =>
              handleAction(() => {
                if (isFolder) {
                  window.location.href = archiveUrl(entry.id);
                } else {
                  window.location.href = downloadUrl(entry.id);
                }
              })
            }
          >
            <ListItemIcon sx={{ color: 'text.secondary', minWidth: 28 }}>
              <FontAwesomeIcon icon={faDownload} size="sm" />
            </ListItemIcon>
            <ListItemText primary="Download" />
          </MenuItem>,
          !isFolder && (
            <MenuItem
              key="share"
              onClick={() => handleAction(() => onShare(entry))}
            >
              <ListItemIcon sx={{ color: 'text.secondary', minWidth: 28 }}>
                <FontAwesomeIcon icon={faShareNodes} size="sm" />
              </ListItemIcon>
              <ListItemText primary="Share" />
            </MenuItem>
          ),
          <MenuItem
            key="rename"
            onClick={() => handleAction(() => onRename(entry))}
          >
            <ListItemIcon sx={{ color: 'text.secondary', minWidth: 28 }}>
              <FontAwesomeIcon icon={faPen} size="sm" />
            </ListItemIcon>
            <ListItemText primary="Rename" secondary="F2" />
          </MenuItem>,
          <MenuItem
            key="move"
            onClick={() => handleAction(() => onMove(entry))}
          >
            <ListItemIcon sx={{ color: 'text.secondary', minWidth: 28 }}>
              <FontAwesomeIcon icon={faArrowRightArrowLeft} size="sm" />
            </ListItemIcon>
            <ListItemText primary="Move" />
          </MenuItem>,
          <MenuItem
            key="copy"
            onClick={() => handleAction(() => onCopy(entry))}
          >
            <ListItemIcon sx={{ color: 'text.secondary', minWidth: 28 }}>
              <FontAwesomeIcon icon={faCopy} size="sm" />
            </ListItemIcon>
            <ListItemText primary="Make a copy" />
          </MenuItem>,
          <MenuItem
            key="details"
            onClick={() => handleAction(onShowDetails)}
          >
            <ListItemIcon sx={{ color: 'text.secondary', minWidth: 28 }}>
              <FontAwesomeIcon icon={faCircleInfo} size="sm" />
            </ListItemIcon>
            <ListItemText primary="File details" secondary="Alt+I" />
          </MenuItem>,
          <MenuItem
            key="delete"
            onClick={() => handleAction(() => onDelete(entry))}
            sx={{ color: 'error.main', '&:hover': { bgcolor: 'rgba(248, 113, 113, 0.15)' } }}
          >
            <ListItemIcon sx={{ color: 'error.main', minWidth: 28 }}>
              <FontAwesomeIcon icon={faTrash} size="sm" />
            </ListItemIcon>
            <ListItemText primary="Delete" secondary="Del" />
          </MenuItem>,
        ]
      )}
    </Menu>
  );
}
