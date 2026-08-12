import React, { useEffect } from 'react';
import { Alert, Box, Button, Paper, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRightToBracket } from '@fortawesome/free-solid-svg-icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import BrandLockup from '../components/BrandLockup';
import ScreenLoader from '../components/ScreenLoader';

const MONO = 'ui-monospace, SFMono-Regular, Consolas, monospace';

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
        px: { xs: 2, md: 6 },
        py: { xs: 4, md: 6 },
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 1080,
          mx: 'auto',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: { xs: 5, md: 8 },
          alignItems: 'center',
        }}
      >
        {/* Brand + security statement */}
        <Box sx={{ minWidth: 0 }}>
          <BrandLockup align="left" />
          <Typography
            variant="h1"
            component="h1"
            sx={{ mt: 4, mb: 2, maxWidth: 420 }}
          >
            Your files, encrypted.
          </Typography>
          <Typography
            variant="h4"
            sx={{ color: 'inkMuted', mb: 4, maxWidth: 380 }}
          >
            Stored on Discord, under your control.
          </Typography>
          <Typography
            variant="overline"
            component="p"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              color: 'steel',
              fontFamily: MONO,
              textTransform: 'none',
              letterSpacing: '0.12em',
              '&::before': {
                content: '""',
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: 'signal',
                flexShrink: 0,
              },
            }}
          >
            Self-hosted · AES-256-GCM · Discord-backed
          </Typography>
        </Box>

        {/* Sign-in control panel */}
        <Box sx={{ minWidth: 0 }}>
          <Paper
            elevation={0}
            sx={{
              bgcolor: 'surface1',
              border: 1,
              borderColor: 'hairline',
              borderRadius: '12px',
              p: { xs: 3, md: 4 },
            }}
          >
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
              onClick={() => {
                window.location = '/api/auth/discord';
              }}
            >
              Sign in with Discord
            </Button>
            <Typography
              variant="overline"
              component="p"
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                mt: 2.5,
                color: 'steel',
                fontFamily: MONO,
                letterSpacing: '0.12em',
                '&::before': {
                  content: '""',
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: 'signal',
                  flexShrink: 0,
                },
              }}
            >
              Sign-in ready
            </Typography>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}
