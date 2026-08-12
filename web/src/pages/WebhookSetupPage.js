import React, { useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowRightToBracket,
  faCommentDots,
  faGear,
  faKey,
  faLink,
  faPlug,
} from '@fortawesome/free-solid-svg-icons';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import ErrorNotice from '../components/ErrorNotice';
import BrandLockup from '../components/BrandLockup';

const STEPS = [
  {
    icon: faCommentDots,
    text: 'Open Discord and open any server you own — a server with just you in it is perfect.',
  },
  {
    icon: faGear,
    text: 'Click the server name at the top left, then Server Settings \u2192 Integrations \u2192 Webhooks.',
  },
  {
    icon: faLink,
    text: 'Click New Webhook, name it anything (like \u201cWyvern\u201d), then copy the webhook URL.',
  },
  {
    icon: faArrowRightToBracket,
    text: 'Paste it below and click Connect — Wyvern checks it and connects your storage.',
  },
];

/**
 * Map server error codes to friendly, non-technical copy. The raw server
 * message is never shown: it can echo the submitted URL back, and this page
 * is written for people who should not have to read server errors.
 */
function friendlyMessage(error) {
  if (error && error.code === 'INVALID_WEBHOOK') {
    return "That URL didn't work. Double-check you copied the whole webhook URL from Discord.";
  }
  if (error && error.code === 'STORAGE_UNAVAILABLE') {
    return 'Discord is busy right now. Wait a moment and try again.';
  }
  return 'Something went wrong connecting your storage. Try again in a moment.';
}

const MONO = 'ui-monospace, SFMono-Regular, Consolas, monospace';

/**
 * Per-user storage connection page. The webhook URL is a full-access
 * credential for the server's Discord messages; it is submitted to the server
 * once, encrypted at rest there, and never kept in the browser: no
 * localStorage, query strings, fragments, analytics, or error messages.
 */
export default function WebhookSetupPage() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [webhookUrl, setWebhookUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.configureWebhook(webhookUrl);
      setWebhookUrl('');
      await refresh();
      navigate('/drive', { replace: true });
    } catch (err) {
      setError(friendlyMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <Box
      data-testid="webhook-setup-page"
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 560 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <BrandLockup align="center" />
        </Box>
        <Typography variant="h1" component="h1" sx={{ mb: 1.5, textAlign: 'center' }}>
          Connect your storage
        </Typography>
        <Typography variant="h5" sx={{ color: 'inkMuted', mb: 3, textAlign: 'center' }}>
          Wyvern stores your files in a private channel of a Discord server you
          own. It takes about a minute.
        </Typography>

        {/* Ruled setup timeline: mono step cell + signal tick on a connected spine */}
        <Box sx={{ mb: 2.5 }}>
          {STEPS.map((step, i) => {
            const isLast = i === STEPS.length - 1;
            return (
              <Box key={step.text} sx={{ display: 'flex', gap: 1.5 }}>
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: 'hairline',
                      bgcolor: 'surface2',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: MONO,
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'signal',
                    }}
                  >
                    {i + 1}
                  </Box>
                  {!isLast && (
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        flexGrow: 1,
                        py: 0.5,
                      }}
                    >
                      <Box
                        sx={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          bgcolor: 'signal',
                          mb: 0.5,
                        }}
                      />
                      <Box sx={{ flexGrow: 1, width: 2, bgcolor: 'hairlineSoft' }} />
                    </Box>
                  )}
                </Box>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1.5,
                    pt: 0.5,
                    pb: isLast ? 0 : 1.5,
                    minWidth: 0,
                  }}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      flexShrink: 0,
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: 'hairlineSoft',
                      bgcolor: 'surface2',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'inkMuted',
                      fontSize: 15,
                    }}
                  >
                    <FontAwesomeIcon icon={step.icon} aria-hidden="true" />
                  </Box>
                  <Typography variant="body1" component="div" sx={{ color: 'inkMuted', pt: 0.5 }}>
                    {step.text}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>

        <ErrorNotice error={error} />

        <Paper
          variant="outlined"
          sx={{ p: 3, bgcolor: 'surface1', borderColor: 'hairline' }}
        >
          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              type="password"
              autoComplete="off"
              label="Webhook URL"
              inputProps={{ 'data-testid': 'webhook-url-input' }}
              value={webhookUrl}
              onChange={(event) => setWebhookUrl(event.target.value)}
              fullWidth
              required
              disabled={submitting}
              sx={{ mb: 2 }}
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              startIcon={
                submitting ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <FontAwesomeIcon icon={faPlug} />
                )
              }
              disabled={submitting || webhookUrl.trim().length === 0}
              data-testid="connect-storage-button"
            >
              Connect
            </Button>
          </Box>
        </Paper>

        <Paper
          variant="outlined"
          data-testid="webhook-warning"
          sx={{
            mt: 2.5,
            p: 2,
            bgcolor: 'surface2',
            borderColor: 'hairline',
            borderLeft: '3px solid',
            borderLeftColor: 'warning.main',
            display: 'flex',
            gap: 1.5,
            alignItems: 'flex-start',
          }}
        >
          <Box
            sx={{
              color: 'warning.main',
              fontSize: 15,
              mt: 0.25,
              flexShrink: 0,
              display: 'flex',
            }}
          >
            <FontAwesomeIcon icon={faKey} aria-hidden="true" />
          </Box>
          <Typography variant="body2" sx={{ color: 'ink' }}>
            Your files are encrypted before they&apos;re stored, and only you
            can access them. This URL is the key to your storage — don&apos;t
            share it.
          </Typography>
        </Paper>

        <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: 'inkMuted', textAlign: 'center' }}>
          The URL is encrypted on the server and never stored in your browser.
        </Typography>
      </Box>
    </Box>
  );
}
