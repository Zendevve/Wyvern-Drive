import React, { useEffect } from 'react';
import { Alert, Box, Button, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRightToBracket } from '@fortawesome/free-solid-svg-icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import BrandLockup from '../components/BrandLockup';
import ScreenLoader from '../components/ScreenLoader';

const INTER = "'Inter Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

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
    return <ScreenLoader />;
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
        <Box sx={{ mb: 2 }}>
          <BrandLockup align="center" />
        </Box>
        <Typography
          variant="h1"
          component="h1"
          sx={{
            mb: 2,
            fontSize: 62,
            fontFamily: "'Mona Sans Variable', 'Inter Variable', sans-serif",
            fontWeight: 500,
            letterSpacing: '-3.1px',
            lineHeight: 1.0,
          }}
        >
          Your files, encrypted.
        </Typography>
        <Typography variant="h4" sx={{ color: 'inkMuted', mb: 4 }}>
          Stored on Discord, under your control.
        </Typography>
        {error === 'invalid_state' && (
          <Alert severity="warning" sx={{ mb: 2 }} data-testid="oauth-invalid-state">
            Your sign-in session expired or was already used. Please try signing in
            again.
          </Alert>
        )}
        {error === 'oauth_failed' && (
          <Alert severity="warning" sx={{ mb: 2 }} data-testid="oauth-failed">
            Sign-in didn&apos;t work. The person running this server may need to
            check their Discord setup.
          </Alert>
        )}
        <Button
          variant="contained"
          size="large"
          fullWidth
          startIcon={<FontAwesomeIcon icon={faRightToBracket} />}
          sx={{
            bgcolor: 'ink',
            color: 'canvas',
            '&:hover': { bgcolor: 'ink', opacity: 0.92 },
          }}
          onClick={() => {
            window.location = '/api/auth/discord';
          }}
        >
          Sign in with Discord
        </Button>
        <Typography
          variant="caption"
          sx={{ display: 'block', mt: 1.5, color: 'inkMuted', fontFamily: INTER }}
        >
          Self-hosted · AES-256-GCM · Discord-backed
        </Typography>
      </Box>
    </Box>
  );
}
