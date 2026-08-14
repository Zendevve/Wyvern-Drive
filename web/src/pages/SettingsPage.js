import React, { useCallback, useEffect, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faShieldHalved, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import ErrorNotice from '../components/ErrorNotice';
import QuotaMeter, { formatBytes } from '../components/QuotaMeter';
import ScreenLoader from '../components/ScreenLoader';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthProvider';

/**
 * Cloud-Drive Settings & Diagnostics Page
 */
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

  const handleAddWebhook = async (e) => {
    e.preventDefault();
    const url = webhookUrl.trim();
    if (!url) return;
    setAddingWebhook(true);
    setWebhookError(null);
    try {
      await api.webhooks.add(url);
      setWebhookUrl('');
      await loadWebhooks();
      await loadStats();
      await refresh();
    } catch (err) {
      setWebhookError(err);
    } finally {
      setAddingWebhook(false);
    }
  };

  const handleRemoveWebhook = async (id) => {
    setRemovingWebhookId(id);
    setWebhookError(null);
    try {
      await api.webhooks.remove(id);
      await loadWebhooks();
      await loadStats();
      await refresh();
    } catch (err) {
      setWebhookError(err);
    } finally {
      setRemovingWebhookId(null);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await api.logout();
    } catch {
      // ignore
    }
    await refresh();
    navigate('/login', { replace: true });
  };

  if (loading) return <ScreenLoader />;
  if (!user) return null;

  return (
    <AppShell title="Settings">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pb: 4 }}>
        {/* User Account Card */}
        <Paper
          elevation={0}
          variant="outlined"
          sx={{
            p: 3,
            bgcolor: 'surface1',
            borderColor: 'divider',
            borderRadius: 3,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', sm: 'center' },
              gap: 2.5,
              mb: 3,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
              <Avatar
                src={user.avatarUrl}
                alt={user.username}
                sx={{
                  width: 56,
                  height: 56,
                  bgcolor: 'rgba(37, 172, 232, 0.15)',
                  border: '1px solid',
                  borderColor: 'primary.main',
                  fontWeight: 700,
                  fontSize: 20,
                  color: 'primary.main',
                }}
              >
                {(user.username || 'U')[0].toUpperCase()}
              </Avatar>
              <Box>
                <Typography variant="h5" component="h2" sx={{ color: 'text.primary', fontWeight: 700 }}>
                  {user.username}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
                  Discord ID: {user.discordId || 'Authenticated'}
                </Typography>
              </Box>
            </Box>

            <Button
              variant="outlined"
              color="error"
              size="small"
              onClick={handleLogout}
              disabled={loggingOut}
              data-testid="logout-button"
              sx={{ borderRadius: 2 }}
            >
              Sign out
            </Button>
          </Box>

          {drive && (
            <Box sx={{ pt: 2.5, borderTop: '1px solid', borderColor: 'divider', maxWidth: 460 }}>
              <QuotaMeter drive={drive} showIcon />
            </Box>
          )}
        </Paper>

        {/* Drive Stats Grid */}
        <Paper
          elevation={0}
          variant="outlined"
          sx={{
            p: 3,
            bgcolor: 'surface1',
            borderColor: 'divider',
            borderRadius: 3,
          }}
        >
          <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 600, mb: 1 }}>
            Storage analytics
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
            Real-time chunking, dedup, and compression telemetry.
          </Typography>

          {statsError ? (
            <ErrorNotice error={statsError} onRetry={loadStats} />
          ) : statsLoading ? (
            <Box
              data-testid="drive-stats-loading"
              sx={{ display: 'flex', justifyContent: 'center', py: 4 }}
            >
              <CircularProgress size={28} aria-label="Loading drive stats" />
            </Box>
          ) : stats ? (
            <Box
              data-testid="drive-stats"
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(5, 1fr)' },
                gap: 2,
              }}
            >
              <Box sx={{ bgcolor: 'surface2', border: '1px solid', borderColor: 'divider', p: 2, borderRadius: 2 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  Files
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary', mt: 0.5 }}>
                  {stats.files}
                </Typography>
              </Box>

              <Box sx={{ bgcolor: 'surface2', border: '1px solid', borderColor: 'divider', p: 2, borderRadius: 2 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  Folders
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary', mt: 0.5 }}>
                  {stats.folders}
                </Typography>
              </Box>

              <Box sx={{ bgcolor: 'surface2', border: '1px solid', borderColor: 'divider', p: 2, borderRadius: 2 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  Space used
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary', mt: 0.5 }}>
                  {formatBytes(stats.sizeBytes)}
                </Typography>
              </Box>

              <Box sx={{ bgcolor: 'surface2', border: '1px solid', borderColor: 'divider', p: 2, borderRadius: 2 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  Stored on Discord
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main', mt: 0.5 }}>
                  {formatBytes(stats.storedBytes)}
                </Typography>
              </Box>

              {stats.compressionRatio && (
                <Box sx={{ bgcolor: 'surface2', border: '1px solid', borderColor: 'divider', p: 2, borderRadius: 2 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                    Saved space
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main', mt: 0.5 }}>
                    {typeof stats.compressionRatio === 'number'
                      ? `${stats.compressionRatio.toFixed(2)}×`
                      : stats.compressionRatio}
                  </Typography>
                </Box>
              )}

              <Box sx={{ bgcolor: 'surface2', border: '1px solid', borderColor: 'divider', p: 2, borderRadius: 2 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  Webhooks
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary', mt: 0.5 }}>
                  {stats.webhooks}
                </Typography>
              </Box>
            </Box>
          ) : null}
        </Paper>

        {/* Discord Storage Webhooks Management */}
        <Paper
          elevation={0}
          variant="outlined"
          sx={{
            p: 3,
            bgcolor: 'surface1',
            borderColor: 'divider',
            borderRadius: 3,
          }}
        >
          <Box
            data-testid="storage-connected"
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5,
              mb: 2.5,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FontAwesomeIcon icon={faShieldHalved} style={{ color: '#25ACE8', fontSize: 16 }} />
              <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 600 }}>
                Storage connected
              </Typography>
              {webhooks.length > 0 && (
                <Typography
                  variant="caption"
                  sx={{
                    bgcolor: 'rgba(37, 172, 232, 0.15)',
                    color: 'primary.main',
                    px: 1,
                    py: 0.25,
                    borderRadius: 9999,
                    fontWeight: 600,
                  }}
                >
                  {webhooks.length} connection(s)
                </Typography>
              )}
            </Box>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Discord webhooks act as encrypted blob storage targets. Uploads round-robin across connected channels.
            </Typography>
          </Box>

          {/* Add Webhook Form */}
          <Box
            component="form"
            onSubmit={handleAddWebhook}
            sx={{
              display: 'flex',
              gap: 1.5,
              mb: 3,
              maxWidth: 680,
            }}
          >
            <TextField
              size="small"
              fullWidth
              label="Webhook URL"
              placeholder="https://discord.com/api/webhooks/..."
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              disabled={addingWebhook}
              inputProps={{ 'aria-label': 'Webhook URL' }}
            />
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={addingWebhook || !webhookUrl.trim()}
              data-testid="add-webhook"
              startIcon={<FontAwesomeIcon icon={faPlus} size="xs" />}
              sx={{ whiteSpace: 'nowrap', px: 2.5, borderRadius: 2 }}
            >
              Add webhook
            </Button>
          </Box>

          {webhookError && (
            <Box sx={{ mb: 2 }}>
              <ErrorNotice error={webhookError} onRetry={loadWebhooks} />
              {webhookError.code === 'WEBHOOK_IN_USE' && (
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
                  Permanently delete those files first, then retry removing this webhook.
                </Typography>
              )}
            </Box>
          )}

          {/* Webhooks List */}
          {webhooksLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : webhooks.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
              No webhooks configured yet. Add a Discord webhook URL above to expand your storage bandwidth.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {webhooks.map((wh) => (
                <Box
                  key={wh.id}
                  sx={{
                    p: 2,
                    bgcolor: 'surface2',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" noWrap sx={{ color: 'text.primary', fontWeight: 600 }}>
                      {wh.channelName || `Webhook #${wh.id}`}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                      Added {new Date(wh.createdAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    color="error"
                    aria-label={`Remove webhook ${wh.id}`}
                    disabled={removingWebhookId === wh.id}
                    onClick={() => handleRemoveWebhook(wh.id)}
                    data-testid={`remove-webhook-${wh.id}`}
                  >
                    <FontAwesomeIcon icon={faTrashCan} size="xs" />
                  </IconButton>
                </Box>
              ))}
            </Box>
          )}
        </Paper>
      </Box>
    </AppShell>
  );
}
