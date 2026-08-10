import React, { useEffect } from 'react';
import { Alert, Box, Button, CircularProgress, Paper, Typography } from '@mui/material';
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
      <Paper variant="outlined" sx={{ p: 4, maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Wyvern Drive
        </Typography>
        <Typography color="textSecondary" sx={{ mb: 3 }}>
          Your files, encrypted, stored on Discord.
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
      </Paper>
    </Box>
  );
}
