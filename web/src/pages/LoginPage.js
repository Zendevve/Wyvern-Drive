import React, { useEffect } from 'react';
import { Alert, Box, Button, Paper, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock, faRightToBracket, faShieldHalved } from '@fortawesome/free-solid-svg-icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import BrandLockup from '../components/BrandLockup';
import ScreenLoader from '../components/ScreenLoader';

/**
 * Cloud-Drive Login Portal
 */
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
        bgcolor: 'canvas',
        p: 3,
        background: 'radial-gradient(ellipse at center top, rgba(37, 172, 232, 0.15) 0%, rgba(12, 14, 18, 1) 70%)',
      }}
    >
      <Paper
        elevation={0}
        variant="outlined"
        sx={{
          width: '100%',
          maxWidth: 440,
          p: 4.5,
          borderRadius: 3.5,
          bgcolor: 'surface1',
          border: '1px solid',
          borderColor: 'rgba(37, 172, 232, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          boxShadow: '0 20px 50px rgba(0,0,0,0.85), 0 0 30px rgba(37, 172, 232, 0.15)',
        }}
      >
        <BrandLockup align="center" />

        <Box sx={{ textAlign: 'center', width: '100%' }}>
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontWeight: 700,
              color: 'text.primary',
              letterSpacing: '-0.02em',
              mb: 1,
            }}
          >
            Your cloud on Discord
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: 'text.secondary', lineHeight: 1.5 }}
          >
            Encrypted with AES-256-GCM at rest. Self-hosted personal storage backed by your own Discord webhooks.
          </Typography>
        </Box>

        {error === 'invalid_state' && (
          <Alert severity="warning" sx={{ width: '100%', borderRadius: 2 }} data-testid="oauth-invalid-state">
            Invalid OAuth state token. Please retry sign in.
          </Alert>
        )}
        {error === 'oauth_failed' && (
          <Alert severity="error" sx={{ width: '100%', borderRadius: 2 }} data-testid="oauth-failed">
            Sign-in didn&apos;t work. The person running this server may need to check their Discord setup.
          </Alert>
        )}

        <Button
          component="a"
          href="/api/auth/discord"
          role="button"
          aria-label="Sign in with Discord"
          variant="contained"
          color="primary"
          fullWidth
          startIcon={<FontAwesomeIcon icon={faRightToBracket} />}
          data-testid="login-button"
          sx={{
            py: 1.5,
            fontSize: 14,
            fontWeight: 600,
            borderRadius: 2.5,
            boxShadow: '0 4px 20px rgba(37, 172, 232, 0.4)',
          }}
        >
          Sign in with Discord
        </Button>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.disabled' }}>
          <FontAwesomeIcon icon={faShieldHalved} size="xs" style={{ color: '#25ACE8' }} />
          <Typography variant="caption" sx={{ fontSize: 12 }}>
            Server-side AES-256 encrypted • Discord backed
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}
