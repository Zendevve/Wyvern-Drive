import React, { useEffect, useState } from 'react';
import { Box, Button, CircularProgress, Paper, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload, faFileCircleXmark } from '@fortawesome/free-solid-svg-icons';
import { useParams } from 'react-router-dom';
import { api, shareDownloadUrl } from '../api/client';
import { formatBytes } from '../components/QuotaMeter';

function formatDate(value) {
  return new Date(value).toLocaleString();
}

/**
 * Public share landing page. Requires no login; missing, revoked, or expired
 * shares render one generic unavailable state.
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
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress aria-label="Loading share" />
      </Box>
    );
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
      >
        <Paper
          variant="outlined"
          sx={{ p: 4, maxWidth: 420, width: '100%', textAlign: 'center' }}
          data-testid="share-not-found"
        >
          <FontAwesomeIcon icon={faFileCircleXmark} size="3x" aria-hidden="true" />
          <Typography variant="h6" sx={{ mt: 2 }}>
            This share is not available
          </Typography>
          <Typography color="textSecondary">
            The link may have been revoked or expired, or it may never have existed.
          </Typography>
        </Paper>
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
    >
      <Paper variant="outlined" sx={{ p: 4, maxWidth: 420, width: '100%' }} data-testid="share-meta">
        <Typography variant="h5" component="h1" noWrap>
          {share.name}
        </Typography>
        <Typography color="textSecondary" sx={{ mt: 1 }}>
          {formatBytes(share.sizeBytes)}
        </Typography>
        <Typography color="textSecondary">{share.mimeType || 'Unknown type'}</Typography>
        {share.expiresAt && (
          <Typography color="textSecondary">Expires {formatDate(share.expiresAt)}</Typography>
        )}
        <Button
          component="a"
          href={shareDownloadUrl(token)}
          download
          variant="contained"
          startIcon={<FontAwesomeIcon icon={faDownload} />}
          sx={{ mt: 3 }}
        >
          Download
        </Button>
      </Paper>
    </Box>
  );
}
