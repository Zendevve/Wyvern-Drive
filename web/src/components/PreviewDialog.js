import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { downloadUrl } from '../api/client';
import DialogTransition from '../motion/DialogTransition';

/**
 * Inline file preview. Renders by MIME type:
 * - image → full-size <img>
 * - video / audio → native controls (autoPlay)
 * - text / JSON → fetched as text and shown in a scrollable <pre>
 * - pdf → fixed-height <iframe>
 *
 * All media is streamed from the authenticated download route with
 * ?inline=1 so the server serves it as inline content, never as an
 * attachment. Surface-2 dialog styling and ink text come from the theme's
 * MuiDialog overrides.
 */
export default function PreviewDialog({ entry, onClose }) {
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
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Typography
          variant="subtitle1"
          noWrap
          sx={{ flexGrow: 1 }}
          component="span"
        >
          {entry ? entry.name : ''}
        </Typography>
        <IconButton
          size="small"
          aria-label="Close preview"
          title="Close"
          onClick={onClose}
        >
          <FontAwesomeIcon icon={faXmark} />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {isImage && (
          <Box
            component="img"
            src={src}
            alt={entry ? entry.name : ''}
            sx={{
              display: 'block',
              maxWidth: '100%',
              maxHeight: '70vh',
              width: 'auto',
              height: 'auto',
              mx: 'auto',
              borderRadius: '10px',
            }}
          />
        )}
        {isVideo && (
          <video
            controls
            autoPlay
            src={src}
            style={{ width: '100%', maxHeight: '70vh', borderRadius: '10px' }}
          />
        )}
        {isAudio && (
          <audio controls autoPlay src={src} style={{ width: '100%' }} />
        )}
        {isPdf && (
          <iframe
            src={src}
            title={entry ? entry.name : 'PDF preview'}
            style={{
              width: '100%',
              height: 600,
              border: 'none',
              borderRadius: '10px',
              backgroundColor: '#FFFFFF',
            }}
          />
        )}
        {isText && (
          <Box
            sx={{
              bgcolor: 'surface1',
              borderRadius: '10px',
              p: 2,
            }}
          >
            {textLoading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={28} aria-label="Loading preview" />
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
                  fontFamily: "'Consolas', monospace",
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
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
