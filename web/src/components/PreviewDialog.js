import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronLeft,
  faChevronRight,
  faDownload,
  faPlay,
  faShareNodes,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import {
  downloadUrl,
  isPreviewableMime,
} from '../api/client';
import { formatBytes } from './QuotaMeter';
import DialogTransition from '../motion/DialogTransition';

/**
 * Cloud-Drive QuickLook Previewer Lightbox
 */
export default function PreviewDialog({
  entry,
  allEntries = [],
  onClose,
  onNavigate,
  onPlayTrack,
  onShare,
}) {
  const [textContent, setTextContent] = useState(null);
  const [textError, setTextError] = useState(null);
  const [textLoading, setTextLoading] = useState(false);

  const isAudio =
    entry &&
    entry.kind !== 'folder' &&
    ((entry.mimeType && entry.mimeType.startsWith('audio/')) ||
      (entry.name && entry.name.toLowerCase().endsWith('.m4b')));

  const previewableEntries = allEntries.filter(
    (e) => e.kind !== 'folder' && isPreviewableMime(e.mimeType)
  );
  const currentIndex = entry
    ? previewableEntries.findIndex((e) => e.id === entry.id)
    : -1;

  const handlePrev = useCallback(() => {
    if (currentIndex > 0 && onNavigate) {
      onNavigate(previewableEntries[currentIndex - 1]);
    }
  }, [currentIndex, previewableEntries, onNavigate]);

  const handleNext = useCallback(() => {
    if (
      currentIndex !== -1 &&
      currentIndex < previewableEntries.length - 1 &&
      onNavigate
    ) {
      onNavigate(previewableEntries[currentIndex + 1]);
    }
  }, [currentIndex, previewableEntries, onNavigate]);

  useEffect(() => {
    if (!entry) return;
    const handleKey = (e) => {
      if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [entry, handlePrev, handleNext]);

  const mime = (entry && entry.mimeType ? entry.mimeType : '').toLowerCase();
  const isImage = mime.startsWith('image/');
  const isVideo = mime.startsWith('video/');
  const isPdf = mime === 'application/pdf' || (entry && entry.name && entry.name.endsWith('.pdf'));
  const isText =
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    mime === 'application/javascript' ||
    mime === 'application/x-javascript' ||
    mime === 'application/xml';

  const url = entry ? downloadUrl(entry.id, { inline: true }) : '';

  useEffect(() => {
    if (!entry || !isText) {
      setTextContent(null);
      setTextError(null);
      setTextLoading(false);
      return;
    }
    let cancelled = false;
    setTextLoading(true);
    setTextError(null);
    fetch(url, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error('Failed to load preview');
        }
        return res.text();
      })
      .then((text) => {
        if (!cancelled) {
          setTextContent(text);
          setTextLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setTextError(err.message || 'Failed to load preview');
          setTextLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [entry, isText, url]);

  if (!entry) return null;

  return (
    <Dialog
      open={Boolean(entry)}
      TransitionComponent={DialogTransition}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      aria-labelledby="preview-title"
      PaperProps={{
        sx: {
          bgcolor: 'surfaceElevated',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
          maxHeight: '90vh',
          boxShadow: '0 24px 60px rgba(0,0,0,0.9), 0 0 30px rgba(37, 172, 232, 0.15)',
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        id="preview-title"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
          py: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="subtitle1"
            noWrap
            sx={{
              fontWeight: 600,
              fontSize: 15,
              color: 'text.primary',
            }}
          >
            {entry.name}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 12 }}>
            {formatBytes(entry.sizeBytes)} • {entry.mimeType || 'Unknown type'}
          </Typography>
        </Box>

        <IconButton
          size="small"
          aria-label="Close preview"
          onClick={onClose}
          sx={{ width: 32, height: 32, borderRadius: 1.5 }}
        >
          <FontAwesomeIcon icon={faXmark} size="sm" />
        </IconButton>
      </DialogTitle>

      {/* Content Stage */}
      <DialogContent
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2,
          minHeight: 420,
          maxHeight: '70vh',
          bgcolor: 'rgba(0,0,0,0.3)',
          overflow: 'auto',
          position: 'relative',
        }}
      >
        {/* Previous Arrow */}
        {currentIndex > 0 && (
          <IconButton
            onClick={handlePrev}
            sx={{
              position: 'absolute',
              left: 16,
              top: '50%',
              transform: 'translateY(-50%)',
              bgcolor: 'surface2',
              border: '1px solid',
              borderColor: 'divider',
              zIndex: 10,
              '&:hover': { borderColor: 'primary.main', bgcolor: 'surfaceElevated' },
            }}
          >
            <FontAwesomeIcon icon={faChevronLeft} size="sm" />
          </IconButton>
        )}

        {/* Media Viewers */}
        {isImage && (
          <Box
            component="img"
            src={url}
            alt={entry.name}
            sx={{
              maxWidth: '100%',
              maxHeight: '66vh',
              objectFit: 'contain',
              borderRadius: 1.5,
              border: '1px solid',
              borderColor: 'divider',
            }}
          />
        )}

        {isVideo && (
          <Box
            component="video"
            controls
            autoPlay
            src={url}
            sx={{
              maxWidth: '100%',
              maxHeight: '66vh',
              borderRadius: 1.5,
              border: '1px solid',
              borderColor: 'divider',
            }}
          />
        )}

        {isAudio && (
          <Box
            sx={{
              textAlign: 'center',
              p: 4,
              bgcolor: 'surface1',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2.5,
            }}
          >
            <Typography variant="h6" sx={{ color: 'primary.main', mb: 1, fontWeight: 600 }}>
              Audio Track
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
              {entry.name}
            </Typography>
            <Button
              variant="contained"
              color="primary"
              startIcon={<FontAwesomeIcon icon={faPlay} size="xs" />}
              onClick={() => {
                if (onPlayTrack) onPlayTrack(entry);
                onClose();
              }}
              sx={{ borderRadius: 2 }}
            >
              Play in background player
            </Button>
          </Box>
        )}

        {isPdf && (
          <Box
            component="iframe"
            src={url}
            title={entry.name}
            sx={{
              width: '100%',
              height: '66vh',
              borderRadius: 1.5,
              border: '1px solid',
              borderColor: 'divider',
            }}
          />
        )}

        {isText && (
          <Box sx={{ width: '100%', height: '100%', maxHeight: '66vh', overflow: 'auto', p: 2 }}>
            {textLoading ? (
              <Typography sx={{ color: 'text.secondary' }}>Loading preview...</Typography>
            ) : textError ? (
              <Typography color="error">{textError}</Typography>
            ) : (
              <Box
                component="pre"
                sx={{
                  m: 0,
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 13,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: 'text.primary',
                }}
              >
                {textContent}
              </Box>
            )}
          </Box>
        )}

        {/* Next Arrow */}
        {currentIndex !== -1 && currentIndex < previewableEntries.length - 1 && (
          <IconButton
            onClick={handleNext}
            sx={{
              position: 'absolute',
              right: 16,
              top: '50%',
              transform: 'translateY(-50%)',
              bgcolor: 'surface2',
              border: '1px solid',
              borderColor: 'divider',
              zIndex: 10,
              '&:hover': { borderColor: 'primary.main', bgcolor: 'surfaceElevated' },
            }}
          >
            <FontAwesomeIcon icon={faChevronRight} size="sm" />
          </IconButton>
        )}
      </DialogContent>

      {/* Footer Actions */}
      <DialogActions
        sx={{
          px: 3,
          py: 1.75,
          borderTop: '1px solid',
          borderColor: 'divider',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
          {currentIndex !== -1
            ? `${currentIndex + 1} of ${previewableEntries.length}`
            : ''}
        </Typography>

        <Box sx={{ display: 'flex', gap: 1.5 }}>
          {onShare && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<FontAwesomeIcon icon={faShareNodes} size="xs" />}
              onClick={() => onShare(entry)}
              sx={{ borderRadius: 2 }}
            >
              Share
            </Button>
          )}
          <Button
            variant="contained"
            color="primary"
            size="small"
            startIcon={<FontAwesomeIcon icon={faDownload} size="xs" />}
            onClick={() => {
              window.location.href = downloadUrl(entry.id);
            }}
            sx={{ borderRadius: 2 }}
          >
            Download
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
