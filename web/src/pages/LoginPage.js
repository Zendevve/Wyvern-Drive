import React, { useEffect } from 'react';
import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRightToBracket } from '@fortawesome/free-solid-svg-icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

export default function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const error = searchParams.get('error');

  useEffect(() => {
    if (!loading && user) {
      navigate('/drive', { replace: true });
    }
  }, [loading, user, navigate]);

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
        <CircularProgress aria-label="Loading" />
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
      <Box sx={{ width: '100%', maxWidth: 520, textAlign: 'center' }}>
        <Typography
          component="div"
          sx={{
            fontFamily: "'Mona Sans Variable', sans-serif",
            fontWeight: 500,
            fontSize: 15,
            letterSpacing: '-0.5px',
            color: 'ink',
            mb: 2,
          }}
        >
          Wyvern Drive
        </Typography>
        <Typography variant="h1" component="h1" sx={{ mb: 2 }}>
          Your files, encrypted.
        </Typography>
        <Typography variant="h4" sx={{ color: 'inkMuted', mb: 4 }}>
          Stored on Discord, under your control.
        </Typography>
        {error === 'storage_unavailable' && (
          <Alert severity="warning" sx={{ mb: 2 }} data-testid="storage-unavailable">
            Your private storage channel could not be created. This usually means the
            bot cannot manage channels in the storage server. Please try signing in
            again.
          </Alert>
        )}
        <Button
          variant="contained"
          size="large"
          fullWidth
          startIcon={<FontAwesomeIcon icon={faRightToBracket} />}
          onClick={() => {
            window.location = '/api/auth/discord';
          }}
        >
          Sign in with Discord
        </Button>
        <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: 'inkMuted' }}>
          Self-hosted · AES-256-GCM · Discord-backed
        </Typography>
      </Box>
    </Box>
  );
}
