import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronLeft,
  faChevronRight,
  faDownload,
  faMusic,
  faShareNodes,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { downloadUrl, isPreviewableMime } from '../api/client';
import DialogTransition from '../motion/DialogTransition';
import { formatBytes } from './QuotaMeter';
import { entryIcon, fileTypeLabel } from './entryIcons';

/**
 * First-Party Full-Screen Lightbox Previewer (Google Drive & Dropbox QuickLook style).
 */
export default function PreviewDialog({
  entry,
  allEntries = [],
  onNavigate,
  onClose,
  onShare,
  onPlayTrack,
}) {
  const open = entry !== null;
  const mime = ((entry && entry.mimeType) || '').toLowerCase();
  const src = entry ? downloadUrl(entry.id, { inline: true }) : '';

  const isImage = mime.startsWith('image/');
  const isVideo = mime.startsWith('video/');
  const isAudio = mime.startsWith('audio/');
  const isPdf = mime === 'application/pdf';
  const isText = mime.startsWith('text/') || mime === 'application/json';

  const [textContent, setTextContent] = useState(null);
  const [textError, setTextError] = useState(null);
  const [textLoading, setTextLoading] = useState(false);

  // Find previewable siblings for next/prev navigation
  const previewableEntries = allEntries.filter(
    (e) => e.kind !== 'folder' && isPreviewableMime(e.mimeType)
  );
  const currentIndex = entry
    ? previewableEntries.findIndex((e) => e.id === entry.id)
    : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < previewableEntries.length - 1;

  const handlePrev = useCallback(() => {
    if (hasPrev && onNavigate) {
      onNavigate(previewableEntries[currentIndex - 1]);
    }
  }, [hasPrev, onNavigate, previewableEntries, currentIndex]);

  const handleNext = useCallback(() => {
    if (hasNext && onNavigate) {
      onNavigate(previewableEntries[currentIndex + 1]);
    }
  }, [hasNext, onNavigate, previewableEntries, currentIndex]);

  // Keyboard navigation inside preview dialog
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handlePrev, handleNext, onClose]);

  useEffect(() => {
    if (!open || !isText) {
      setTextContent(null);
      setTextError(null);
      setTextLoading(false);
      return undefined;
    }
    let cancelled = false;
    setTextContent(null);
    setTextError(null);
    setTextLoading(true);
    fetch(src, { credentials: 'include' })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load preview (status ${response.status})`);
        }
        return response.text();
      })
      .then((text) => {
        if (!cancelled) {
          setTextContent(text);
          setTextLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setTextError(err);
          setTextLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, isText, src]);

  const maxWidth = isImage || isVideo || isPdf ? 'lg' : 'md';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth
      TransitionComponent={DialogTransition}
      slotProps={{
        paper: {
          sx: {
            borderRadius: '16px',
            bgcolor: 'surfaceElevated',
            border: '1px solid hairline',
            boxShadow: '0 24px 64px rgba(0,0,0,0.65)',
            overflow: 'hidden',
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          py: 1.5,
          px: 2.5,
          borderBottom: '1px solid hairlineSoft',
        }}
      >
        {entry && (
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              bgcolor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid hairlineSoft',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: entryIcon(entry).color,
              flexShrink: 0,
            }}
          >
            <FontAwesomeIcon icon={entryIcon(entry).icon} size="sm" />
          </Box>
        )}
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography
            variant="subtitle1"
            noWrap
            sx={{ fontWeight: 600, color: 'ink', fontSize: 14.5 }}
            component="span"
          >
            {entry ? entry.name : ''}
          </Typography>
          {entry && (
            <Typography
              variant="caption"
              sx={{ color: 'inkMuted', display: 'block', fontSize: 11.5, fontFamily: 'monospace' }}
            >
              {formatBytes(entry.sizeBytes)} • {fileTypeLabel(entry)}
            </Typography>
          )}
        </Box>

        {/* Quick actions in header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          {isAudio && onPlayTrack && (
            <Button
              size="small"
              variant="outlined"
              color="primary"
              startIcon={<FontAwesomeIcon icon={faMusic} size="xs" />}
              onClick={() => {
                onPlayTrack(entry);
                onClose();
              }}
              sx={{ height: 30, fontSize: 12 }}
            >
              Play in dock
            </Button>
          )}
          {entry && (
            <Tooltip title="Download">
              <IconButton
                size="small"
                component="a"
                href={downloadUrl(entry.id)}
                aria-label="Download file"
                sx={{ color: 'inkSecondary' }}
              >
                <FontAwesomeIcon icon={faDownload} size="xs" />
              </IconButton>
            </Tooltip>
          )}
          {entry && onShare && (
            <Tooltip title="Share">
              <IconButton
                size="small"
                aria-label="Share file"
                onClick={() => onShare(entry)}
                sx={{ color: 'inkSecondary' }}
              >
                <FontAwesomeIcon icon={faShareNodes} size="xs" />
              </IconButton>
            </Tooltip>
          )}
          <IconButton
            size="small"
            aria-label="Close preview"
            title="Close"
            onClick={onClose}
            sx={{ color: 'inkMuted', ml: 0.5 }}
          >
            <FontAwesomeIcon icon={faXmark} size="sm" />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: { xs: 1.5, sm: 3 }, position: 'relative', bgcolor: '#07080A' }}>
        {/* Previous file button */}
        {hasPrev && (
          <IconButton
            aria-label="Previous file"
            onClick={handlePrev}
            sx={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 10,
              bgcolor: 'rgba(20, 22, 28, 0.85)',
              color: 'ink',
              border: '1px solid hairline',
              backdropFilter: 'blur(8px)',
              '&:hover': { bgcolor: 'surfaceElevated' },
            }}
          >
            <FontAwesomeIcon icon={faChevronLeft} size="sm" />
          </IconButton>
        )}

        {/* Next file button */}
        {hasNext && (
          <IconButton
            aria-label="Next file"
            onClick={handleNext}
            sx={{
              position: 'absolute',
              right: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 10,
              bgcolor: 'rgba(20, 22, 28, 0.85)',
              color: 'ink',
              border: '1px solid hairline',
              backdropFilter: 'blur(8px)',
              '&:hover': { bgcolor: 'surfaceElevated' },
            }}
          >
            <FontAwesomeIcon icon={faChevronRight} size="sm" />
          </IconButton>
        )}

        {isImage && (
          <Box
            component="img"
            src={src}
            alt={entry ? entry.name : ''}
            sx={{
              display: 'block',
              maxWidth: '100%',
              maxHeight: '72vh',
              width: 'auto',
              height: 'auto',
              mx: 'auto',
              borderRadius: '8px',
              boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
            }}
          />
        )}
        {isVideo && (
          <video
            controls
            autoPlay
            src={src}
            style={{
              width: '100%',
              maxHeight: '72vh',
              borderRadius: '8px',
              boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
            }}
          />
        )}
        {isAudio && (
          <Box sx={{ p: 4, textAlign: 'center', bgcolor: 'surface1', borderRadius: '12px' }}>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '14px',
                bgcolor: 'rgba(0, 132, 255, 0.12)',
                color: 'accentBlue',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
                mb: 2,
              }}
            >
              <FontAwesomeIcon icon={faMusic} />
            </Box>
            <Typography variant="h6" sx={{ color: 'ink', fontWeight: 600, mb: 0.5, fontSize: 16 }}>
              {entry.name}
            </Typography>
            <Typography variant="caption" sx={{ color: 'inkMuted', display: 'block', mb: 3 }}>
              Encrypted Stream • AES-256-GCM
            </Typography>
            <audio controls autoPlay src={src} style={{ width: '100%', maxWidth: 480 }} />
          </Box>
        )}
        {isPdf && (
          <iframe
            src={src}
            title={entry ? entry.name : 'PDF preview'}
            style={{
              width: '100%',
              height: 620,
              border: 'none',
              borderRadius: '8px',
              backgroundColor: '#FFFFFF',
            }}
          />
        )}
        {isText && (
          <Box
            sx={{
              bgcolor: 'surface1',
              borderRadius: '8px',
              p: 2.5,
              border: '1px solid hairlineSoft',
            }}
          >
            {textLoading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={26} aria-label="Loading preview" />
              </Box>
            )}
            {textError && (
              <Typography variant="body2" color="error" component="p">
                {textError.message || String(textError)}
              </Typography>
            )}
            {textContent !== null && (
              <Box
                component="pre"
                sx={{
                  m: 0,
                  maxHeight: '70vh',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: 'ink',
                  fontFamily: "'Consolas', 'Fira Code', monospace",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                {textContent}
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 1.25, borderTop: '1px solid hairlineSoft', justifyContent: 'space-between' }}>
        <Typography variant="caption" sx={{ color: 'inkMuted', fontSize: 11.5 }}>
          {currentIndex >= 0 ? `${currentIndex + 1} of ${previewableEntries.length} files • Navigate with ← / → keys` : ''}
        </Typography>
        <Button onClick={onClose} size="small">Close</Button>
      </DialogActions>
    </Dialog>
  );
}
