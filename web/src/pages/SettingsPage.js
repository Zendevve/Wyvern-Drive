import React, { useCallback, useEffect, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
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

// Measurement/data role: IDs, webhook numbers, sizes, dates.
const MONO = "'ui-monospace, SFMono-Regular, Consolas, monospace'";

// Ruled section header shared by the stats band and the webhook ledger.
const sectionHeader = {
  color: 'ink',
  fontSize: 12,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  fontWeight: 600,
};

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
        {/* Identity / health band */}
        <Box
          sx={{
            gridColumn: '1 / -1',
            bgcolor: 'surface1',
            border: 1,
            borderColor: 'hairline',
            borderRadius: '12px',
            p: 2.5,
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
                sx={{ width: 48, height: 48, bgcolor: 'surface3', color: 'ink' }}
              >
                {user.username ? user.username.charAt(0).toUpperCase() : '?'}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                  {user.username}
                </Typography>
                <Typography
                  variant="caption"
                  color="inkMuted"
                  component="p"
                  sx={{ fontFamily: MONO }}
                >
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
          {drive && (
            <Box sx={{ borderTop: 1, borderColor: 'hairlineSoft', mt: 2, pt: 2 }}>
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
                <Typography
                  variant="caption"
                  color="inkMuted"
                  sx={{ ml: 'auto', fontFamily: MONO }}
                >
                  {webhooksLoading ? '' : `${webhooks.length} connection(s)`}
                </Typography>
              </Box>
              <Typography variant="caption" color="inkMuted" component="p" sx={{ mt: 0.5 }}>
                Your files are encrypted before they&apos;re stored.
              </Typography>
            </Box>
          )}
        </Box>

        {/* Drive stats — ruled number band */}
        {statsError ? (
          <Box sx={{ bgcolor: 'surface1', border: 1, borderColor: 'hairline', borderRadius: '12px', p: 2.5 }}>
            <ErrorNotice error={statsError} onRetry={loadStats} />
          </Box>
        ) : statsLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2, bgcolor: 'surface1', border: 1, borderColor: 'hairline', borderRadius: '12px' }}>
            <CircularProgress size={24} aria-label="Loading drive stats" />
          </Box>
        ) : stats ? (
          <Box
            data-testid="drive-stats"
            sx={{
              bgcolor: 'surface1',
              border: 1,
              borderColor: 'hairline',
              borderRadius: '12px',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                px: 2.5,
                py: 1.5,
                borderBottom: 1,
                borderColor: 'hairlineSoft',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
              }}
            >
              <Box
                sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'signal', flexShrink: 0 }}
                aria-hidden="true"
              />
              <Typography variant="overline" component="h2" sx={sectionHeader}>
                Drive stats
              </Typography>
            </Box>
            <Box sx={{ px: 2.5, py: 0.5 }}>
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
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 2,
                    py: 1.25,
                    borderBottom: 1,
                    borderColor: 'hairlineSoft',
                    '&:last-of-type': { borderBottom: 0 },
                  }}
                >
                  <Typography variant="body2" color="inkMuted" component="p">
                    {item.label}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ fontFamily: MONO, color: 'ink', fontWeight: 500 }}
                  >
                    {item.value}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        ) : null}

        {/* Webhook connection ledger */}
        <Box
          sx={{
            bgcolor: 'surface1',
            border: 1,
            borderColor: 'hairline',
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              px: 2.5,
              py: 1.5,
              borderBottom: 1,
              borderColor: 'hairlineSoft',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
            }}
          >
            <Box
              sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'signal', flexShrink: 0 }}
              aria-hidden="true"
            />
            <Typography variant="overline" component="h2" sx={sectionHeader}>
              Webhooks
            </Typography>
          </Box>
          <Box sx={{ px: 2.5, py: 2 }}>
            {webhookError && (
              <Box
                role="alert"
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1.25,
                  bgcolor: 'dangerSoft',
                  border: 1,
                  borderColor: 'error.main',
                  borderRadius: '12px',
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
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                {webhooks.map((webhook) => (
                  <Box
                    key={webhook.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      py: 1.25,
                      borderBottom: 1,
                      borderColor: 'hairlineSoft',
                      '&:last-of-type': { borderBottom: 0 },
                    }}
                  >
                    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                      <Typography variant="body2" noWrap sx={{ fontFamily: MONO }}>
                        Webhook #{webhook.id}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="inkMuted"
                        component="p"
                        sx={{ fontFamily: MONO }}
                      >
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
                        '&:hover': { backgroundColor: 'dangerSoft' },
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
      </Box>

      {/* Logout danger zone */}
      <Box
        sx={{
          mt: 2.5,
          p: 2.5,
          border: 1,
          borderColor: 'dangerSoft',
          borderRadius: '12px',
          bgcolor: 'dangerSoft',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 600 }}>
            Danger zone
          </Typography>
          <Typography variant="caption" color="inkMuted" component="p" sx={{ mt: 0.25 }}>
            End your session on this device.
          </Typography>
        </Box>
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
