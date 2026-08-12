import React, { useEffect, useState } from 'react';
import { Box, Button, Paper, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faDownload,
  faFile,
  faFileAudio,
  faFileCircleXmark,
  faFileImage,
  faFilePdf,
  faFileVideo,
} from '@fortawesome/free-solid-svg-icons';
import { useParams } from 'react-router-dom';
import { api, shareDownloadUrl } from '../api/client';
import { formatBytes } from '../components/QuotaMeter';
import BrandLockup from '../components/BrandLockup';
import ScreenLoader from '../components/ScreenLoader';

// Measurement/data role — sizes, types, dates (Signal Deck mono stack).
const MONO = 'ui-monospace, SFMono-Regular, Consolas, monospace';

function formatDate(value) {
  return new Date(value).toLocaleString();
}

function mimeIcon(mimeType) {
  if (!mimeType) {
    return faFile;
  }
  if (mimeType.startsWith('image/')) {
    return faFileImage;
  }
  if (mimeType.startsWith('video/')) {
    return faFileVideo;
  }
  if (mimeType.startsWith('audio/')) {
    return faFileAudio;
  }
  if (mimeType === 'application/pdf') {
    return faFilePdf;
  }
  return faFile;
}

/**
 * Public share landing page — a recipient-facing transfer manifest.
 * Requires no login; missing, revoked, or expired shares render one
 * generic unavailable state.
 */
export default function SharePage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [share, setShare] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setShare(null);
    api
      .publicShare(token)
      .then((data) => {
        if (!cancelled) setShare(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setNotFound(err.status === 404 || err.code === 'SHARE_NOT_FOUND');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return <ScreenLoader />;
  }

  if (notFound || !share) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          px: 2,
          py: 6,
        }}
        data-testid="share-not-found"
      >
        <BrandLockup align="center" />
        <Box
          sx={{
            width: '100%',
            maxWidth: 520,
            mt: 8,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}
        >
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'surface2',
              border: 1,
              borderColor: 'hairline',
              borderRadius: '8px',
              p: 3,
              color: 'inkMuted',
            }}
          >
            <FontAwesomeIcon icon={faFileCircleXmark} aria-hidden="true" size="3x" />
          </Box>
          <Typography variant="h3" component="h1" sx={{ mt: 3, color: 'ink' }}>
            This share is not available
          </Typography>
          <Typography sx={{ mt: 1, color: 'inkMuted' }}>
            It may have been revoked or expired.
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        px: 2,
        py: 6,
      }}
      data-testid="share-meta"
    >
      <BrandLockup align="center" />
      <Box
        sx={{
          width: '100%',
          maxWidth: 980,
          mt: 5,
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) 340px' },
          gap: 3,
          alignItems: 'start',
        }}
      >
        {/* Left: file-type signal tile + name + mono meta */}
        <Box sx={{ minWidth: 0 }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'surface2',
              border: 1,
              borderColor: 'hairline',
              borderRadius: '8px',
              p: 3,
              color: 'ink',
            }}
          >
            <FontAwesomeIcon icon={mimeIcon(share.mimeType)} aria-hidden="true" size="4x" />
          </Box>
          <Typography variant="h2" component="h1" noWrap sx={{ mt: 2.5, color: 'ink' }}>
            {share.name}
          </Typography>
          <Box sx={{ mt: 2.5, borderTop: 1, borderColor: 'hairlineSoft' }}>
            <Typography sx={{ mt: 1.5, color: 'inkMuted', fontFamily: MONO, fontSize: 13 }}>
              {formatBytes(share.sizeBytes)}
            </Typography>
            <Typography sx={{ mt: 1, color: 'inkMuted', fontFamily: MONO, fontSize: 13 }}>
              {share.mimeType || 'Unknown type'}
            </Typography>
            {share.expiresAt && (
              <Typography sx={{ mt: 1, color: 'inkMuted', fontFamily: MONO, fontSize: 13 }}>
                Expires {formatDate(share.expiresAt)}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Right: download action panel */}
        <Paper
          variant="outlined"
          sx={{
            bgcolor: 'surface1',
            borderColor: 'hairline',
            borderRadius: '8px',
            p: 3,
          }}
        >
          <Button
            component="a"
            href={shareDownloadUrl(token)}
            download
            variant="contained"
            size="large"
            fullWidth
            startIcon={<FontAwesomeIcon icon={faDownload} />}
          >
            Download
          </Button>
        </Paper>
      </Box>
    </Box>
  );
}
