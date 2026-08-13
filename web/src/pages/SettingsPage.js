import React, { useCallback, useEffect, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleCheck, faTriangleExclamation, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import ErrorNotice from '../components/ErrorNotice';
import QuotaMeter, { formatBytes } from '../components/QuotaMeter';
import ScreenLoader from '../components/ScreenLoader';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthProvider';

function formatDate(value) {
  return new Date(value).toLocaleString();
}

export default function SettingsPage() {
  const { user, drive, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const [webhooks, setWebhooks] = useState([]);
  const [webhooksLoading, setWebhooksLoading] = useState(true);
  const [webhookError, setWebhookError] = useState(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [addingWebhook, setAddingWebhook] = useState(false);
  const [removingWebhookId, setRemovingWebhookId] = useState(null);

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(null);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const data = await api.driveStats();
      setStats(data || null);
    } catch (err) {
      setStatsError(err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const loadWebhooks = useCallback(async () => {
    setWebhooksLoading(true);
    setWebhookError(null);
    try {
      const data = await api.webhooks.list();
      setWebhooks((data && data.webhooks) || []);
    } catch (err) {
      setWebhookError(err);
    } finally {
      setWebhooksLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWebhooks();
  }, [loadWebhooks]);

  const handleAddWebhook = useCallback(
    async (event) => {
      event.preventDefault();
      const url = webhookUrl.trim();
      if (!url) {
        return;
      }
      setAddingWebhook(true);
      setWebhookError(null);
      try {
        await api.webhooks.add(url);
        setWebhookUrl('');
        await loadWebhooks();
      } catch (err) {
        setWebhookError(err);
      } finally {
        setAddingWebhook(false);
      }
    },
    [webhookUrl, loadWebhooks]
  );

  const handleRemoveWebhook = useCallback(
    async (webhook) => {
      setRemovingWebhookId(webhook.id);
      setWebhookError(null);
      try {
        await api.webhooks.remove(webhook.id);
        await loadWebhooks();
      } catch (err) {
        setWebhookError(err);
      } finally {
        setRemovingWebhookId(null);
      }
    },
    [loadWebhooks]
  );

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
    return <ScreenLoader />;
  }

  if (!user) {
    return null; // AuthProvider redirects to /login.
  }

  return (
    <AppShell title="Settings">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          maxWidth: 1000,
        }}
      >
        {/* Identity / Health card */}
        <Box
          sx={{
            bgcolor: 'surface1',
            border: 1,
            borderColor: 'hairline',
            borderRadius: '20px',
            p: 3.5,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              alignItems: { xs: 'flex-start', md: 'center' },
              justifyContent: 'space-between',
              gap: 3,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, minWidth: 0 }}>
              <Avatar
                src={user.avatarUrl || undefined}
                alt={user.username}
                sx={{
                  width: 64,
                  height: 64,
                  bgcolor: 'surface2',
                  color: 'ink',
                  border: '1px solid hairline',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                }}
              >
                {user.username ? user.username.charAt(0).toUpperCase() : '?'}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, fontSize: 20, lineHeight: 1.2, color: 'ink' }}>
                  {user.username}
                </Typography>
                <Typography variant="caption" color="inkMuted" component="p" sx={{ mt: 0.5, fontFamily: 'monospace' }}>
                  Discord ID: {user.discordId}
                </Typography>
                {drive && (
                  <Box
                    data-testid="storage-connected"
                    sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, mt: 1 }}
                  >
                    <FontAwesomeIcon
                      icon={faCircleCheck}
                      aria-hidden="true"
                      style={{ color: '#3AC36F', fontSize: 14 }}
                    />
                    <Typography variant="caption" sx={{ fontWeight: 600, color: 'success.main' }}>
                      Storage connected
                    </Typography>
                    <Typography variant="caption" color="inkMuted" sx={{ ml: 0.5 }}>
                      ({webhooksLoading ? '...' : `${webhooks.length} connection(s)`})
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
            <Box
              sx={{
                width: { xs: '100%', md: 280 },
                bgcolor: 'surface2',
                border: '1px solid hairlineSoft',
                borderRadius: '16px',
                p: 2,
              }}
            >
              <QuotaMeter drive={drive} />
            </Box>
          </Box>

          <Divider sx={{ my: 2.5 }} />

          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'flex-start', sm: 'center' },
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <Typography variant="caption" color="inkMuted" component="p">
              Your files are encrypted with AES-256-GCM before being stored on Discord.
            </Typography>
            <Button
              variant="outlined"
              color="error"
              onClick={handleLogout}
              disabled={loggingOut}
              data-testid="logout-button"
              sx={{ height: 36, px: 2, borderRadius: '100px', flexShrink: 0 }}
            >
              Log out
            </Button>
          </Box>
        </Box>

        {/* Drive stats — Bento tile grid */}
        {statsError ? (
          <Box
            sx={{
              bgcolor: 'surface1',
              border: 1,
              borderColor: 'hairline',
              borderRadius: '20px',
              p: 3,
            }}
          >
            <ErrorNotice error={statsError} onRetry={loadStats} />
          </Box>
        ) : statsLoading ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              py: 4,
              bgcolor: 'surface1',
              border: 1,
              borderColor: 'hairline',
              borderRadius: '20px',
            }}
          >
            <CircularProgress size={28} aria-label="Loading drive stats" />
          </Box>
        ) : stats ? (
          <Box
            data-testid="drive-stats"
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(6, 1fr)' },
              gap: 1.5,
            }}
          >
            {[
              { label: 'Files', value: stats.files },
              { label: 'Folders', value: stats.folders },
              { label: 'Space used', value: formatBytes(stats.sizeBytes) },
              {
                label: 'Stored on Discord',
                value: formatBytes(stats.storedBytes),
              },
              ...(stats.compressionRatio != null
                ? [
                    {
                      label: 'Saved space',
                      value: `${stats.compressionRatio.toFixed(2)}×`,
                    },
                  ]
                : []),
              { label: 'Webhooks', value: stats.webhooks },
            ].map((item) => (
              <Box
                key={item.label}
                sx={{
                  bgcolor: 'surface1',
                  border: '1px solid hairline',
                  borderRadius: '16px',
                  p: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'all 150ms ease',
                  '&:hover': {
                    bgcolor: 'surface2',
                    transform: 'translateY(-2px)',
                    borderColor: 'rgba(255,255,255,0.14)',
                  },
                }}
              >
                <Typography
                  variant="caption"
                  color="inkMuted"
                  component="p"
                  noWrap
                  sx={{ fontSize: 11, fontWeight: 500 }}
                >
                  {item.label}
                </Typography>
                <Typography
                  variant="body1"
                  sx={{
                    fontWeight: 600,
                    color: 'ink',
                    fontSize: 18,
                    mt: 1,
                    fontFamily: 'monospace',
                  }}
                >
                  {item.value}
                </Typography>
              </Box>
            ))}
          </Box>
        ) : null}

        {/* Storage — webhook ledger card */}
        <Box
          sx={{
            bgcolor: 'surface1',
            border: 1,
            borderColor: 'hairline',
            borderRadius: '20px',
            p: 3.5,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: 18, color: 'ink' }}>
              Discord Webhooks
            </Typography>
            <Typography variant="caption" color="inkMuted" component="p" sx={{ mt: 0.5 }}>
              Discord webhooks act as encrypted blob storage targets for your drive.
            </Typography>
          </Box>

          {webhookError && (
            <Box
              role="alert"
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1.25,
                bgcolor: 'rgba(255,92,92,0.10)',
                border: 1,
                borderColor: 'error.main',
                borderRadius: '12px',
                p: 2,
                mb: 2.5,
              }}
            >
              <Box
                component="span"
                sx={{
                  display: 'inline-flex',
                  color: 'error.main',
                  fontSize: 16,
                  mt: 0.25,
                  flexShrink: 0,
                }}
              >
                <FontAwesomeIcon icon={faTriangleExclamation} aria-hidden="true" />
              </Box>
              <Box>
                <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 500 }}>
                  {webhookError.message}
                </Typography>
                {webhookError.code === 'WEBHOOK_IN_USE' && (
                  <Typography variant="caption" color="inkMuted" component="p" sx={{ mt: 0.5 }}>
                    This webhook still stores files in your drive or trash. Permanently
                    delete those files first, then remove it.
                  </Typography>
                )}
              </Box>
            </Box>
          )}

          {webhooksLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={28} aria-label="Loading webhooks" />
            </Box>
          ) : webhooks.length === 0 ? (
            <Box
              sx={{
                p: 3,
                textAlign: 'center',
                bgcolor: 'surface2',
                borderRadius: '14px',
                border: '1px dashed hairline',
                mb: 2.5,
              }}
            >
              <Typography variant="body2" color="inkMuted">
                No webhooks configured yet. Add one below to start storing files.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mb: 2.5 }}>
              {webhooks.map((webhook) => (
                <Box
                  key={webhook.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 2,
                    bgcolor: 'surface2',
                    border: '1px solid hairlineSoft',
                    borderRadius: '14px',
                    px: 2.25,
                    py: 1.5,
                  }}
                >
                  <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 600, color: 'ink' }}>
                      Webhook #{webhook.id}
                    </Typography>
                    <Typography variant="caption" color="inkMuted" component="p" sx={{ mt: 0.2 }}>
                      Added {formatDate(webhook.createdAt)}
                    </Typography>
                  </Box>
                  <IconButton
                    aria-label={`Remove webhook ${webhook.id}`}
                    title="Remove"
                    color="error"
                    onClick={() => handleRemoveWebhook(webhook)}
                    disabled={removingWebhookId === webhook.id}
                    data-testid={`remove-webhook-${webhook.id}`}
                    sx={{
                      color: 'error.main',
                      '&:hover': {
                        color: '#FF7575',
                        backgroundColor: 'rgba(255,92,92,0.10)',
                      },
                    }}
                  >
                    <FontAwesomeIcon icon={faTrashCan} />
                  </IconButton>
                </Box>
              ))}
            </Box>
          )}

          <Box
            component="form"
            onSubmit={handleAddWebhook}
            sx={{ display: 'flex', gap: 1.5, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}
          >
            <TextField
              size="small"
              fullWidth
              placeholder="Paste a Discord webhook URL (e.g. https://discord.com/api/webhooks/...)"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              inputProps={{ 'aria-label': 'Webhook URL' }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                },
              }}
            />
            <Button
              type="submit"
              variant="contained"
              disabled={addingWebhook || !webhookUrl.trim()}
              data-testid="add-webhook"
              sx={{ height: 40, px: 3, borderRadius: '100px', whiteSpace: 'nowrap' }}
            >
              Add connection
            </Button>
          </Box>
        </Box>
      </Box>
    </AppShell>
  );
}
