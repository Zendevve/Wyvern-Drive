import React, { useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import QuotaMeter from '../components/QuotaMeter';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthProvider';

export default function SettingsPage() {
  const { user, drive, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await api.logout();
    } catch {
      // Proceed anyway — the session may already be invalid.
    }
    await refresh();
    navigate('/login', { replace: true });
  };

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

  if (!user) {
    return null; // AuthProvider redirects to /login.
  }

  return (
    <AppShell title="Settings">
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
        Settings
      </Typography>
      <Card variant="outlined" elevation={0} sx={{ maxWidth: 560, borderRadius: '20px' }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Avatar
              src={user.avatarUrl || undefined}
              alt={user.username}
              sx={{ width: 56, height: 56 }}
            >
              {user.username ? user.username.charAt(0).toUpperCase() : '?'}
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {user.username}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Discord ID: {user.discordId}
              </Typography>
            </Box>
          </Box>
          <Divider sx={{ my: 2 }} />
          <QuotaMeter drive={drive} />
        </CardContent>
      </Card>
      <Box sx={{ mt: 3 }}>
        <Button
          variant="outlined"
          color="error"
          onClick={handleLogout}
          disabled={loggingOut}
          data-testid="logout-button"
        >
          Log out
        </Button>
      </Box>
    </AppShell>
  );
}
