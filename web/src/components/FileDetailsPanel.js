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
  faDownload,
  faEye,
  faPlay,
  faShareNodes,
  faShieldHalved,
  faTrash,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import {
  archiveUrl,
  downloadUrl,
  isPreviewableMime,
} from '../api/client';
import { formatBytes } from './QuotaMeter';
import { entryIcon, fileTypeLabel } from './entryIcons';

function formatTimestamp(value) {
  if (!value) return '—';
  const d = new Date(value);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Cloud-Drive Metadata Inspector Panel
 */
export default function FileDetailsPanel({
  open,
  onClose,
  selectedEntries = [],
  currentFolder,
  actions = {},
  onPreview,
  onPlayTrack,
}) {
  if (!open) return null;

  const single = selectedEntries.length === 1 ? selectedEntries[0] : null;
  const isMulti = selectedEntries.length > 1;
  const isFolder = single && single.kind === 'folder';
  const isAudio =
    single &&
    !isFolder &&
    ((single.mimeType && single.mimeType.startsWith('audio/')) ||
      (single.name && single.name.toLowerCase().endsWith('.m4b')));

  const previewable = single && !isFolder && isPreviewableMime(single.mimeType);

  const totalSelectedBytes = selectedEntries.reduce(
    (sum, e) => sum + (e.sizeBytes || 0),
    0
  );

  return (
    <Paper
      elevation={0}
      variant="outlined"
      data-testid="file-details-panel"
      sx={{
        width: 320,
        flexShrink: 0,
        borderRadius: 2.5,
        bgcolor: 'surface1',
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        height: 'fit-content',
        maxHeight: 'calc(100vh - 120px)',
        overflowY: 'auto',
      }}
    >
      {/* Panel Header */}
      <Box
        sx={{
          px: 2.5,
          py: 1.75,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="subtitle2" sx={{ color: 'text.primary', fontWeight: 600 }}>
          Details
        </Typography>
        <IconButton
          size="small"
          aria-label="Close inspector"
          onClick={onClose}
          sx={{ width: 28, height: 28, borderRadius: 1 }}
        >
          <FontAwesomeIcon icon={faXmark} size="xs" />
        </IconButton>
      </Box>

      {/* Multi-Selection Mode */}
      {isMulti && (
        <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ p: 2, bgcolor: 'surface2', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary' }}>
              {selectedEntries.length} items selected
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 13, mt: 0.5 }}>
              Total size: {formatBytes(totalSelectedBytes)}
            </Typography>
          </Box>

          <Button
            variant="contained"
            color="error"
            size="small"
            startIcon={<FontAwesomeIcon icon={faTrash} size="xs" />}
            onClick={() => actions.onDelete && actions.onDelete(selectedEntries)}
            sx={{ borderRadius: 2 }}
          >
            Delete selected
          </Button>
        </Box>
      )}

      {/* Single Entry Mode */}
      {single && (
        <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {/* File Icon Stage */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 100,
              bgcolor: 'surface2',
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <FontAwesomeIcon
              icon={entryIcon(single).icon}
              color={entryIcon(single).color}
              style={{ fontSize: 40 }}
            />
          </Box>

          {/* Title & Type */}
          <Box>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
                color: 'text.primary',
                fontSize: 14,
                wordBreak: 'break-word',
              }}
            >
              {single.name}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 12 }}>
              {fileTypeLabel(single)}
            </Typography>
          </Box>

          {/* Quick Actions */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {previewable && (
              <Button
                variant="contained"
                color="primary"
                size="small"
                startIcon={<FontAwesomeIcon icon={faEye} size="xs" />}
                onClick={() => onPreview && onPreview(single)}
                sx={{ borderRadius: 2 }}
              >
                Preview
              </Button>
            )}

            {isAudio && (
              <Button
                variant="contained"
                size="small"
                startIcon={<FontAwesomeIcon icon={faPlay} size="xs" />}
                onClick={() => onPlayTrack && onPlayTrack(single)}
                sx={{
                  borderRadius: 2,
                  bgcolor: '#38BDF8',
                  color: '#0C0E12',
                  '&:hover': { bgcolor: '#7DD3FC' },
                }}
              >
                Play Audio
              </Button>
            )}

            <Button
              variant="outlined"
              size="small"
              startIcon={<FontAwesomeIcon icon={faDownload} size="xs" />}
              onClick={() => {
                if (isFolder) {
                  window.location.href = archiveUrl(single.id);
                } else {
                  window.location.href = downloadUrl(single.id);
                }
              }}
              sx={{ borderRadius: 2 }}
            >
              Download
            </Button>

            {!isFolder && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<FontAwesomeIcon icon={faShareNodes} size="xs" />}
                onClick={() => actions.onShare && actions.onShare(single)}
                sx={{ borderRadius: 2 }}
              >
                Share
              </Button>
            )}
          </Box>

          {/* Metadata Key-Value Table */}
          <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant="overline" sx={{ color: 'text.disabled', fontSize: 11, letterSpacing: '0.06em' }}>
              Properties
            </Typography>

            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Size
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 500 }}>
                {isFolder ? '—' : formatBytes(single.sizeBytes)}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Cipher
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <FontAwesomeIcon icon={faShieldHalved} style={{ fontSize: 10, color: '#38BDF8' }} />
                <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600 }}>
                  AES-256-GCM
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Storage
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.primary' }}>
                Discord Webhook
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Modified
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.primary' }}>
                {formatTimestamp(single.updatedAt)}
              </Typography>
            </Box>
          </Box>
        </Box>
      )}

      {/* No Selection (Folder Context) */}
      {!single && !isMulti && (
        <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ p: 2, bgcolor: 'surface2', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block' }}>
              Current folder
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', fontSize: 14, mt: 0.25 }}>
              /{currentFolder ? currentFolder.name : 'root'}
            </Typography>
          </Box>
          <Typography variant="caption" sx={{ color: 'text.disabled', lineHeight: 1.5 }}>
            Select an item to view its details, encryption status, and quick actions.
          </Typography>
        </Box>
      )}
    </Paper>
  );
}
