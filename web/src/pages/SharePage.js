import React, { useEffect, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
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
 * Public share landing page — a recipient-facing poster on the dark canvas.
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
          alignItems: 'center',
          justifyContent: 'center',
          p: 2,
        }}
        data-testid="share-not-found"
      >
        <Box sx={{ width: '100%', maxWidth: 520, textAlign: 'center' }}>
          <Box sx={{ color: 'inkMuted', fontSize: 48, lineHeight: 1 }}>
            <FontAwesomeIcon icon={faFileCircleXmark} aria-hidden="true" />
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
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
      data-testid="share-meta"
    >
      <Box sx={{ width: '100%', maxWidth: 520, textAlign: 'center' }}>
        <BrandLockup align="center" />
        <Box sx={{ mt: 5, color: 'inkMuted', fontSize: 48, lineHeight: 1 }}>
          <FontAwesomeIcon icon={mimeIcon(share.mimeType)} aria-hidden="true" />
        </Box>
        <Typography variant="h2" component="h1" noWrap sx={{ mt: 2, color: 'ink' }}>
          {share.name}
        </Typography>
        <Typography sx={{ mt: 0.5, color: 'inkMuted' }}>
          {formatBytes(share.sizeBytes)}
        </Typography>
        <Typography sx={{ mt: 0.5, color: 'inkMuted' }}>
          {share.mimeType || 'Unknown type'}
        </Typography>
        {share.expiresAt && (
          <Typography sx={{ mt: 0.5, color: 'inkMuted' }}>
            Expires {formatDate(share.expiresAt)}
          </Typography>
        )}
        <Button
          component="a"
          href={shareDownloadUrl(token)}
          download
          variant="contained"
          size="large"
          fullWidth
          startIcon={<FontAwesomeIcon icon={faDownload} />}
          sx={{
            mt: 3,
            bgcolor: 'white',
            color: 'black',
            '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.88)' },
          }}
        >
          Download
        </Button>
      </Box>
    </Box>
  );
}
