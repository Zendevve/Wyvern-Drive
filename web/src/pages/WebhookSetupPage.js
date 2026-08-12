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
        <Typography
          component="div"
          sx={{
            fontFamily: "'Mona Sans Variable', sans-serif",
            fontWeight: 500,
            fontSize: 15,
            letterSpacing: '-0.5px',
            color: 'ink',
            mb: 2,
            textAlign: 'center',
          }}
        >
          Wyvern Drive
        </Typography>
        <Typography variant="h1" component="h1" sx={{ mb: 1.5, textAlign: 'center' }}>
          Connect your storage
        </Typography>
        <Typography variant="h5" sx={{ color: 'inkMuted', mb: 3, textAlign: 'center' }}>
          Wyvern stores your files in a private channel of a Discord server you
          own. It takes about a minute.
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
          {STEPS.map((step, i) => (
            <Paper
              key={step.text}
              variant="outlined"
              sx={{
                p: 2,
                bgcolor: 'surface1',
                borderColor: 'hairline',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  bgcolor: 'surface2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <FontAwesomeIcon
                  icon={step.icon}
                  aria-hidden="true"
                  sx={{ color: 'inkMuted', fontSize: 16 }}
                />
              </Box>
              <Typography variant="body1" component="div" sx={{ color: 'inkMuted' }}>
                <Box component="span" sx={{ color: 'ink', fontWeight: 600, mr: 1 }}>
                  {i + 1}.
                </Box>
                {step.text}
              </Typography>
            </Paper>
          ))}
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
          <Box
            data-testid="webhook-warning"
            sx={{ display: 'flex', gap: 1.5, mt: 2, alignItems: 'flex-start' }}
          >
            <FontAwesomeIcon
              icon={faKey}
              aria-hidden="true"
              sx={{ color: 'inkMuted', fontSize: 14, mt: 0.25, flexShrink: 0 }}
            />
            <Typography variant="body2" sx={{ color: 'inkMuted' }}>
              Your files are encrypted before they&apos;re stored, and only you
              can access them. This URL is the key to your storage — don&apos;t
              share it.
            </Typography>
          </Box>
        </Paper>

        <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: 'inkMuted', textAlign: 'center' }}>
          The URL is encrypted on the server and never stored in your browser.
        </Typography>
      </Box>
    </Box>
  );
}
