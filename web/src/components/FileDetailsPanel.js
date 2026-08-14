import React from 'react';
import {
  Box,
  Button,
  Divider,
  IconButton,
  Paper,
  Typography,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowRightArrowLeft,
  faCircleCheck,
  faDownload,
  faEye,
  faFolderOpen,
  faHardDrive,
  faLock,
  faPen,
  faPlay,
  faShareNodes,
  faTrash,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { archiveUrl, downloadUrl, isPreviewableMime } from '../api/client';
import { formatBytes } from './QuotaMeter';
import { entryIcon, fileTypeLabel } from './entryIcons';
import QuotaMeter from './QuotaMeter';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

/**
 * First-Party Cloud File Details & Inspector Panel (Finder / Google Drive grade).
 */
export default function FileDetailsPanel({
  open,
  onClose,
  selectedEntries = [],
  currentFolder,
  drive,
  actions = {},
  onPreview,
  onPlayTrack,
}) {
  const isSingle = selectedEntries.length === 1;
  const isMulti = selectedEntries.length > 1;
  const entry = isSingle ? selectedEntries[0] : null;

  const isFolder = entry && entry.kind === 'folder';
  const isAudio = entry && (entry.mimeType || '').startsWith('audio/');
  const previewable = entry && !isFolder && isPreviewableMime(entry.mimeType);

  const { icon, color } = entry ? entryIcon(entry) : { icon: faFolderOpen, color: '#0084FF' };

  const chunkCount = entry && entry.sizeBytes
    ? Math.max(1, Math.ceil(entry.sizeBytes / (8 * 1024 * 1024)))
    : 0;

  const totalSelectedSize = selectedEntries.reduce(
    (acc, curr) => acc + (curr.sizeBytes || 0),
    0
  );

  if (!open) return null;

  return (
    <Box
      data-testid="file-details-panel"
      sx={{
        width: 300,
        flexShrink: 0,
        bgcolor: 'surface1',
        borderLeft: '1px solid hairlineSoft',
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        borderRadius: '12px',
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1.5,
          borderBottom: '1px solid hairlineSoft',
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'ink' }}>
          {isSingle ? 'File Details' : isMulti ? 'Selection Info' : 'Drive Storage'}
        </Typography>
        <IconButton
          size="small"
          aria-label="Close details panel"
          onClick={onClose}
          sx={{ color: 'inkMuted' }}
        >
          <FontAwesomeIcon icon={faXmark} size="sm" />
        </IconButton>
      </Box>

      {/* Body */}
      {isSingle && entry && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
          {/* Preview Stage */}
          <Paper
            variant="outlined"
            sx={{
              p: 2.5,
              borderRadius: '10px',
              bgcolor: 'rgba(255, 255, 255, 0.02)',
              borderColor: 'hairlineSoft',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1.25,
            }}
          >
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: '10px',
                bgcolor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid hairlineSoft',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FontAwesomeIcon icon={icon} color={color} style={{ fontSize: 26 }} />
            </Box>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                color: 'ink',
                textAlign: 'center',
                wordBreak: 'break-word',
                fontSize: 13,
              }}
            >
              {entry.name}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Typography
                variant="caption"
                sx={{
                  bgcolor: 'rgba(0, 132, 255, 0.10)',
                  color: 'accentBlue',
                  px: 0.75,
                  py: 0.2,
                  borderRadius: '4px',
                  fontWeight: 600,
                  fontSize: 10.5,
                }}
              >
                {fileTypeLabel(entry)}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  bgcolor: 'rgba(48, 209, 88, 0.10)',
                  color: 'success.main',
                  px: 0.75,
                  py: 0.2,
                  borderRadius: '4px',
                  fontWeight: 600,
                  fontSize: 10.5,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                <FontAwesomeIcon icon={faLock} size="xs" /> AES-256
              </Typography>
            </Box>
          </Paper>

          {/* Quick Actions */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {previewable && (
              <Button
                variant="contained"
                fullWidth
                size="small"
                startIcon={<FontAwesomeIcon icon={faEye} size="xs" />}
                onClick={() => onPreview && onPreview(entry)}
                sx={{ height: 34, fontSize: 13 }}
              >
                QuickLook
              </Button>
            )}
            {isAudio && onPlayTrack && (
              <Button
                variant="contained"
                fullWidth
                size="small"
                startIcon={<FontAwesomeIcon icon={faPlay} size="xs" />}
                onClick={() => onPlayTrack(entry)}
                sx={{ height: 34, fontSize: 13 }}
              >
                Play in Dock
              </Button>
            )}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75 }}>
              <Button
                variant="outlined"
                component="a"
                size="small"
                href={isFolder ? archiveUrl(entry.id) : downloadUrl(entry.id)}
                startIcon={<FontAwesomeIcon icon={faDownload} size="xs" />}
                sx={{ height: 32, fontSize: 12.5 }}
              >
                Download
              </Button>
              {!isFolder && actions.onShare && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<FontAwesomeIcon icon={faShareNodes} size="xs" />}
                  onClick={() => actions.onShare(entry)}
                  sx={{ height: 32, fontSize: 12.5 }}
                >
                  Share
                </Button>
              )}
            </Box>
          </Box>

          <Divider sx={{ my: 0.5 }} />

          {/* Properties */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <Typography variant="overline" sx={{ color: 'inkMuted', fontSize: 10.5 }}>
              Properties
            </Typography>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" color="inkMuted">Type</Typography>
              <Typography variant="caption" sx={{ color: 'ink', fontWeight: 500 }}>
                {entry.mimeType || (isFolder ? 'Folder' : 'File')}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" color="inkMuted">Size</Typography>
              <Typography variant="caption" sx={{ color: 'ink', fontWeight: 600, fontFamily: 'monospace' }}>
                {isFolder ? '—' : `${formatBytes(entry.sizeBytes)}`}
              </Typography>
            </Box>

            {!isFolder && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" color="inkMuted">Discord Chunks</Typography>
                <Typography variant="caption" sx={{ color: 'accentBlue', fontWeight: 600, fontFamily: 'monospace' }}>
                  {chunkCount}
                </Typography>
              </Box>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" color="inkMuted">Location</Typography>
              <Typography variant="caption" sx={{ color: 'ink', fontWeight: 500, maxWidth: 150 }} noWrap>
                {currentFolder ? currentFolder.name : 'Root'}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" color="inkMuted">Modified</Typography>
              <Typography variant="caption" sx={{ color: 'ink', fontWeight: 500 }}>
                {formatDate(entry.updatedAt)}
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 0.5 }} />

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'space-between' }}>
            {actions.onRename && (
              <Button
                size="small"
                variant="text"
                startIcon={<FontAwesomeIcon icon={faPen} size="xs" />}
                onClick={() => actions.onRename(entry)}
                sx={{ color: 'inkMuted', fontSize: 11.5, p: 0.5 }}
              >
                Rename
              </Button>
            )}
            {actions.onMove && (
              <Button
                size="small"
                variant="text"
                startIcon={<FontAwesomeIcon icon={faArrowRightArrowLeft} size="xs" />}
                onClick={() => actions.onMove(entry)}
                sx={{ color: 'inkMuted', fontSize: 11.5, p: 0.5 }}
              >
                Move
              </Button>
            )}
            {actions.onDelete && (
              <Button
                size="small"
                variant="text"
                color="error"
                startIcon={<FontAwesomeIcon icon={faTrash} size="xs" />}
                onClick={() => actions.onDelete(entry)}
                sx={{ color: 'error.main', fontSize: 11.5, p: 0.5 }}
              >
                Delete
              </Button>
            )}
          </Box>
        </Box>
      )}

      {isMulti && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
          <Paper
            variant="outlined"
            sx={{
              p: 2.5,
              borderRadius: '10px',
              bgcolor: 'rgba(255, 255, 255, 0.02)',
              borderColor: 'hairlineSoft',
              textAlign: 'center',
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600, color: 'ink', fontSize: 18 }}>
              {selectedEntries.length} items
            </Typography>
            <Typography variant="caption" sx={{ color: 'inkMuted', mt: 0.5, display: 'block', fontFamily: 'monospace' }}>
              Total: {formatBytes(totalSelectedSize)}
            </Typography>
          </Paper>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="overline" sx={{ color: 'inkMuted', fontSize: 10.5 }}>
              Selected items
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, maxHeight: 220, overflowY: 'auto' }}>
              {selectedEntries.map((item) => (
                <Box
                  key={item.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    p: 0.75,
                    bgcolor: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '6px',
                  }}
                >
                  <FontAwesomeIcon icon={entryIcon(item).icon} color={entryIcon(item).color} style={{ fontSize: 12 }} />
                  <Typography variant="caption" noWrap sx={{ color: 'ink', flexGrow: 1 }}>
                    {item.name}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      )}

      {!isSingle && !isMulti && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              borderRadius: '10px',
              bgcolor: 'rgba(255, 255, 255, 0.02)',
              borderColor: 'hairlineSoft',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <FontAwesomeIcon icon={faHardDrive} style={{ color: '#0084FF', fontSize: 13 }} />
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'ink', fontSize: 13 }}>
                Cloud Drive
              </Typography>
            </Box>
            <QuotaMeter drive={drive} />
          </Paper>

          <Box sx={{ p: 1.5, bgcolor: 'rgba(48, 209, 88, 0.05)', borderRadius: '8px', border: '1px solid rgba(48, 209, 88, 0.15)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <FontAwesomeIcon icon={faCircleCheck} style={{ color: '#30D158', fontSize: 12 }} />
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'success.main', fontSize: 11.5 }}>
                Discord AES-256 Encryption
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: 'inkMuted', display: 'block', mt: 0.5, fontSize: 10.5 }}>
              Files are split, compressed, and encrypted at rest before Discord storage.
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
}
