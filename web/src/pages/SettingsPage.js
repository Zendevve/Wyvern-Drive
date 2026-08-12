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
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 7fr) minmax(0, 5fr)' },
          gap: 2.5,
          alignItems: 'start',
        }}
      >
        {/* Identity / health card */}
        <Box
          sx={{
            gridColumn: '1 / -1',
            bgcolor: 'surface1',
            border: 1,
            borderColor: 'hairline',
            borderRadius: '20px',
            p: 3,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'flex-start', sm: 'center' },
              gap: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
              <Avatar
                src={user.avatarUrl || undefined}
                alt={user.username}
                sx={{ width: 56, height: 56, bgcolor: 'surface2', color: 'ink' }}
              >
                {user.username ? user.username.charAt(0).toUpperCase() : '?'}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                  {user.username}
                </Typography>
                <Typography variant="caption" color="inkMuted" component="p">
                  Discord ID: {user.discordId}
                </Typography>
              </Box>
            </Box>
            <Box
              sx={{
                flexGrow: 1,
                width: { xs: '100%', sm: 'auto' },
                maxWidth: { xs: '100%', sm: 320 },
                ml: { sm: 'auto' },
              }}
            >
              <QuotaMeter drive={drive} />
            </Box>
          </Box>
          <Divider sx={{ my: 2 }} />
          {drive && (
            <Box>
              <Box
                data-testid="storage-connected"
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <FontAwesomeIcon
                  icon={faCircleCheck}
                  aria-hidden="true"
                  sx={{ color: 'success.main', fontSize: 15, flexShrink: 0 }}
                />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Storage connected
                </Typography>
                <Typography variant="caption" color="inkMuted" sx={{ ml: 'auto' }}>
                  {webhooksLoading ? '' : `${webhooks.length} connection(s)`}
                </Typography>
              </Box>
              <Typography variant="caption" color="inkMuted" component="p" sx={{ mt: 0.5 }}>
                Your files are encrypted before they&apos;re stored.
              </Typography>
            </Box>
          )}
        </Box>

        {/* Drive stats — tile grid */}
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
              py: 2,
              bgcolor: 'surface1',
              border: 1,
              borderColor: 'hairline',
              borderRadius: '20px',
            }}
          >
            <CircularProgress size={24} aria-label="Loading drive stats" />
          </Box>
        ) : stats ? (
          <Box
            data-testid="drive-stats"
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' },
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
                  borderRadius: '10px',
                  px: 2,
                  py: 1.5,
                }}
              >
                <Typography variant="caption" color="inkMuted" component="p">
                  {item.label}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'ink' }}>
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
            p: 3,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
            Storage
          </Typography>
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
                borderRadius: '10px',
                p: 1.75,
                mb: 2,
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
                <Typography variant="body2" sx={{ color: 'error.main' }}>
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
            <Typography variant="body2" color="inkMuted">
              No webhooks configured yet. Add one to start storing files.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {webhooks.map((webhook) => (
                <Box
                  key={webhook.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    bgcolor: 'surface2',
                    borderRadius: '10px',
                    px: 2,
                    py: 1,
                  }}
                >
                  <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                    <Typography variant="body2" noWrap>
                      Webhook #{webhook.id}
                    </Typography>
                    <Typography variant="caption" color="inkMuted" component="p">
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
            sx={{ display: 'flex', gap: 1.5, mt: 2.5 }}
          >
            <TextField
              size="small"
              fullWidth
              placeholder="Paste a Discord webhook URL"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              inputProps={{ 'aria-label': 'Webhook URL' }}
            />
            <Button
              type="submit"
              variant="contained"
              disabled={addingWebhook || !webhookUrl.trim()}
              data-testid="add-webhook"
            >
              Add another connection
            </Button>
          </Box>
        </Box>
      </Box>

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
