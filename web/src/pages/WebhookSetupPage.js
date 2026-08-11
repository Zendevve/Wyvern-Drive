import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlug } from '@fortawesome/free-solid-svg-icons';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import ErrorNotice from '../components/ErrorNotice';

const STEPS = [
  'Open a private Discord server you control (create one if needed).',
  'Open Server Settings from the server name menu.',
  'Select Integrations, then click Create Webhook.',
  'Copy the webhook URL, paste it below, and click Connect storage.',
];

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
      setError(err);
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
          One Discord webhook gives Wyvern a place to keep your encrypted files.
        </Typography>

        <ErrorNotice error={error} />

        <Paper
          variant="outlined"
          sx={{ p: 3, mb: 3, bgcolor: 'surface1', borderColor: 'hairline' }}
        >
          <Typography variant="h3" component="h2" sx={{ mb: 1.5 }}>
            Create a webhook in Discord
          </Typography>
          {STEPS.map((step, i) => (
            <Box key={step} sx={{ display: 'flex', mb: 1 }}>
              <Typography
                variant="body2"
                component="div"
                sx={{ color: 'inkMuted', mr: 2, minWidth: 22 }}
              >
                {i + 1}.
              </Typography>
              <Typography variant="body1" sx={{ color: 'inkMuted' }}>
                {step}
              </Typography>
            </Box>
          ))}
          <Alert severity="warning" sx={{ mt: 2 }} data-testid="webhook-warning">
            Your webhook URL is a full-access credential. Anyone who has it can
            read and delete your stored files, so never share it and never paste
            it anywhere but this page.
          </Alert>
        </Paper>

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
            Connect storage
          </Button>
        </Box>

        <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: 'inkMuted', textAlign: 'center' }}>
          The URL is encrypted on the server and never stored in your browser.
        </Typography>
      </Box>
    </Box>
  );
}
