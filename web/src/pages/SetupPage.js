import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { Navigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheck,
  faCopy,
  faFloppyDisk,
  faKey,
  faLink,
  faRotateRight,
  faTriangleExclamation,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { useSpring, springStyle } from '../motion/springs';
import { api } from '../api/client';

/** The exact OAuth2 redirect address the operator registers in Discord. */
function redirectUri() {
  const origin =
    typeof window !== 'undefined' &&
    window.location.origin &&
    window.location.origin !== 'null'
      ? window.location.origin
      : '<APP_ORIGIN>';
  return `${origin}/api/auth/discord/callback`;
}

/**
 * Copyable chip for the redirect URI. The address is non-secret; the chip
 * makes registering it a single click instead of a retype.
 */
function RedirectUriChip() {
  const [copied, setCopied] = useState(false);
  const uri = redirectUri();

  function copyUri() {
    const fallbackCopy = () => {
      const textarea = document.createElement('textarea');
      textarea.value = uri;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
      } finally {
        document.body.removeChild(textarea);
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(uri).catch(fallbackCopy);
    } else {
      fallbackCopy();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        bgcolor: 'surface2',
        borderRadius: '10px',
        px: 1.5,
        py: 1,
      }}
    >
      <Typography
        variant="body2"
        component="code"
        sx={{
          fontFamily: 'monospace',
          fontSize: 13,
          color: 'ink',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flexGrow: 1,
        }}
      >
        {uri}
      </Typography>
      <Button
        size="small"
        variant="contained"
        onClick={copyUri}
        startIcon={
          copied ? (
            <FontAwesomeIcon icon={faCheck} aria-hidden="true" />
          ) : (
            <FontAwesomeIcon icon={faCopy} aria-hidden="true" />
          )
        }
        sx={{ flexShrink: 0 }}
      >
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </Box>
  );
}

const STAGE_1_STEPS = [
  {
    icon: faUsers,
    body: (
      <>
        Create a free Discord application at{' '}
        <Box
          component="a"
          href="https://discord.com/developers/applications"
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            color: 'primary.main',
            textDecoration: 'none',
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          discord.com/developers/applications
        </Box>{' '}
        (opens in a new tab).
      </>
    ),
  },
  {
    icon: faLink,
    body: (
      <>
        Register this exact address in your Discord application:
        <Box sx={{ mt: 1.5 }}>
          <RedirectUriChip />
        </Box>
      </>
    ),
  },
  {
    icon: faKey,
    body: (
      <>
        In your Discord application, add that address to OAuth2 &rarr; Redirects,
        then copy the Client ID and Client Secret into your server&apos;s
        environment (server/.env).
      </>
    ),
  },
];

/**
 * Maps a setup-save error to a safe, human-friendly message. Server messages
 * are never echoed because they could contain submitted values.
 */
function friendlyMessage(error) {
  switch (error && error.code) {
    case 'SETUP_TOKEN_REQUIRED':
    case 'SETUP_TOKEN_INVALID':
      return 'Enter the one-time setup code printed by the server, then save again.';
    case 'SETUP_ORIGIN_INVALID':
      return 'This address is not allowed to save configuration. Open the setup page from the exact address the server is configured for, then try again.';
    case 'SETUP_VALIDATION_FAILED':
      return 'One of the values did not pass the checks. Check the Client ID, Client Secret, and website address, then try again.';
    case 'SETUP_WRITE_FAILED':
      return "Couldn't save on this server. Check that server/.env is writable by the Wyvern process, then try again.";
    case 'RATE_LIMITED':
      return 'Too many attempts. Wait a moment, then try again.';
    default:
      return 'Something went wrong saving the configuration. Try again.';
  }
}

/**
 * Guided first-run setup page. Renders what the server's read-only
 * /api/setup/status endpoint reports — variable names and non-secret
 * validation messages — never secret values. When setup is still required,
 * the operator can save the two Discord OAuth values (plus safe defaults,
 * derived server-side) through the authenticated /api/setup/credentials
 * route. Secrets live only in React state: they are never written to
 * localStorage, the clipboard, the URL, or analytics, and are cleared after
 * a successful save.
 */
export default function SetupPage({ status, onRetry }) {
  // Critically damped arrival; reduced motion falls back to a static fade.
  const entrance = useSpring(1, { initial: 0, response: 0.4 });
  const entranceStyle = springStyle(entrance);

  const [meta, setMeta] = useState(null);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [appOrigin, setAppOrigin] = useState(() =>
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : ''
  );
  const [setupToken, setSetupToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function loadMeta() {
      try {
        const result = await api.setupMeta();
        if (!cancelled) {
          setMeta(result);
        }
      } catch {
        // Setup details are non-essential; the form still renders.
      }
    }
    loadMeta();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status && !status.setupRequired) {
    return <Navigate to="/login" replace />;
  }

  const unavailable = !status;
  const missing = status ? status.missing || [] : [];
  const invalid = status ? status.invalid || [] : [];
  const hasDiagnostics = missing.length > 0 || invalid.length > 0;

  const missingSet = new Set(missing);
  const invalidSet = new Set(invalid.map((item) => item.key));
  const needsClientId =
    missingSet.has('DISCORD_CLIENT_ID') || invalidSet.has('DISCORD_CLIENT_ID');
  const needsClientSecret =
    missingSet.has('DISCORD_CLIENT_SECRET') ||
    invalidSet.has('DISCORD_CLIENT_SECRET');
  const needsOrigin =
    missingSet.has('APP_ORIGIN') ||
    invalidSet.has('APP_ORIGIN') ||
    missingSet.has('DISCORD_REDIRECT_URI') ||
    invalidSet.has('DISCORD_REDIRECT_URI');
  const keyInvalid = invalidSet.has('WYVERN_ENCRYPTION_KEY');
  const tokenRequired = Boolean(meta && meta.tokenRequired);
  // The save card stays visible whenever anything is left to fix: fields are
  // conditional, but defaults (DB_URL, redirect URI, generated key) can still
  // be written with an otherwise-empty form.
  const showForm =
    needsClientId ||
    needsClientSecret ||
    needsOrigin ||
    tokenRequired ||
    hasDiagnostics;

  async function handleSave(event) {
    event.preventDefault();
    if (saving) {
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {};
    const trimmedId = clientId.trim();
    if (trimmedId) {
      payload.clientId = trimmedId;
    }
    if (clientSecret) {
      payload.clientSecret = clientSecret;
    }
    const trimmedOrigin = appOrigin.trim();
    if (trimmedOrigin) {
      payload.appOrigin = trimmedOrigin;
    }
    const trimmedToken = setupToken.trim();
    if (trimmedToken) {
      payload.setupToken = trimmedToken;
    }
    try {
      const result = await api.saveSetupCredentials(payload);
      setClientId('');
      setClientSecret('');
      setSetupToken('');
      setSaved(result);
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box
      data-testid="setup-page"
      style={entranceStyle}
      sx={{
        minHeight: '100vh',
        p: { xs: 2, sm: 5 },
        maxWidth: 780,
        mx: 'auto',
      }}
    >
      <Typography
        component="div"
        sx={{
          fontFamily: "'Mona Sans Variable', sans-serif",
          fontWeight: 500,
          fontSize: 15,
          letterSpacing: '-0.5px',
          color: 'ink',
          mb: 3,
        }}
      >
        Wyvern Drive
      </Typography>
      <Typography variant="h1" component="h1" sx={{ mb: 3 }}>
        Set up Wyvern Drive
      </Typography>
      <Typography variant="h5" sx={{ color: 'inkMuted', mb: 4 }}>
        Wyvern is ready for users as soon as sign-in is connected. This takes a
        few minutes.
      </Typography>

      {unavailable ? (
        <Box data-testid="setup-unavailable">
          <Alert severity="error" sx={{ mb: 2 }} data-testid="setup-error">
            The server could not be reached. Make sure it is running, then try
            again.
          </Alert>
          <Button
            variant="contained"
            size="large"
            onClick={onRetry}
            data-testid="setup-retry"
          >
            Retry
          </Button>
        </Box>
      ) : (
        <>
          <Paper
            variant="outlined"
            data-testid="setup-checklist"
            sx={{ p: 3, mb: 3, bgcolor: 'surface1', borderColor: 'hairline' }}
          >
            <Typography variant="h3" component="h2" sx={{ mb: 2 }}>
              Connect Discord sign-in
            </Typography>
            {STAGE_1_STEPS.map((step, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    bgcolor: 'surface2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    mt: 0.25,
                  }}
                >
                  <FontAwesomeIcon
                    icon={step.icon}
                    aria-hidden="true"
                    sx={{ color: 'inkMuted', fontSize: 14 }}
                  />
                </Box>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography
                    variant="body2"
                    component="div"
                    sx={{ color: 'inkMuted', mb: 0.5 }}
                  >
                    Step {i + 1}
                  </Typography>
                  <Typography variant="body1" component="div">
                    {step.body}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Paper>

          {showForm && (
            <Paper
              variant="outlined"
              data-testid="setup-meta"
              sx={{ p: 3, mb: 3, bgcolor: 'surface1', borderColor: 'hairline' }}
            >
              <Typography variant="h3" component="h2" sx={{ mb: 1.5 }}>
                Add your Discord application
              </Typography>
              <Typography variant="body1" sx={{ color: 'inkMuted', mb: 2 }}>
                Paste the Client ID and Client Secret from your Discord
                application below. They are saved in server/.env on this server
                and are never shown here again after saving.
              </Typography>

              {keyInvalid && (
                <Alert
                  severity="warning"
                  sx={{ mb: 2 }}
                  data-testid="setup-key-invalid"
                >
                  The server&apos;s existing encryption key is invalid. Restore
                  or fix the server&apos;s existing configuration — replacing it
                  would make stored files unreadable.
                </Alert>
              )}

              {!meta && (
                <Typography variant="body2" sx={{ color: 'inkMuted', mb: 2 }}>
                  Setup details could not be loaded from the server; the one-time
                  setup code field may not be shown.
                </Typography>
              )}

              <Box
                component="form"
                noValidate
                data-testid="setup-credentials-form"
                onSubmit={handleSave}
                sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
              >
                {needsClientId && (
                  <TextField
                    data-testid="setup-client-id"
                    label="Discord Client ID"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    disabled={saving}
                    fullWidth
                    autoComplete="off"
                    helperText="The application ID from the Discord Developer Portal (17–20 digits)."
                  />
                )}
                {needsClientSecret && (
                  <TextField
                    data-testid="setup-client-secret"
                    label="Discord Client Secret"
                    type="password"
                    autoComplete="new-password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    disabled={saving}
                    fullWidth
                    helperText="Kept only in this page while you save; the browser never stores it."
                  />
                )}
                {needsOrigin && (
                  <TextField
                    data-testid="setup-app-origin"
                    label="Website address"
                    value={appOrigin}
                    onChange={(e) => setAppOrigin(e.target.value)}
                    disabled={saving}
                    fullWidth
                    helperText="The public address people use to reach this server. It controls the Discord callback address."
                  />
                )}
                {tokenRequired && (
                  <TextField
                    data-testid="setup-token"
                    label="One-time setup code"
                    type="password"
                    autoComplete="off"
                    value={setupToken}
                    onChange={(e) => setSetupToken(e.target.value)}
                    disabled={saving}
                    fullWidth
                    helperText="The one-time code printed by the server"
                  />
                )}

                {error && (
                  <Alert severity="error" data-testid="setup-save-error">
                    {error}
                  </Alert>
                )}

                {saved && (
                  <Alert severity="success" data-testid="setup-saved">
                    Saved on this server. Restart Wyvern, then choose Recheck.
                    {saved.saved && saved.saved.length > 0 && (
                      <Box component="div" sx={{ mt: 1 }}>
                        Saved on the server: {saved.saved.join(', ')}.
                      </Box>
                    )}
                    {saved.generated && saved.generated.length > 0 && (
                      <Box component="div" sx={{ mt: 1 }}>
                        Generated on the server: {saved.generated.join(', ')}.
                      </Box>
                    )}
                    {saved.generated &&
                      saved.generated.includes('WYVERN_ENCRYPTION_KEY') && (
                        <Box
                          component="div"
                          data-testid="setup-backup-warning"
                          sx={{ mt: 1 }}
                        >
                          The server generated an encryption key and saved it in
                          server/.env on this host. Back that file up before
                          moving or reinstalling Wyvern — without it, stored
                          files cannot be decrypted.
                        </Box>
                      )}
                    {saved.remainingMissing &&
                      saved.remainingMissing.length > 0 && (
                        <Box component="div" sx={{ mt: 1 }}>
                          Still missing on the server:{' '}
                          {saved.remainingMissing.join(', ')}.
                        </Box>
                      )}
                    {saved.remainingInvalid &&
                      saved.remainingInvalid.length > 0 && (
                        <Box component="div" sx={{ mt: 1 }}>
                          Still invalid on the server:{' '}
                          {saved.remainingInvalid
                            .map(
                              (item) =>
                                `${item.key}${
                                  item.message ? ` — ${item.message}` : ''
                                }`
                            )
                            .join(', ')}
                          .
                        </Box>
                      )}
                  </Alert>
                )}

                <Button
                  variant="contained"
                  size="large"
                  type="submit"
                  data-testid="setup-save"
                  disabled={saving || keyInvalid}
                  startIcon={
                    saving ? (
                      <CircularProgress size={18} color="inherit" />
                    ) : (
                      <FontAwesomeIcon icon={faFloppyDisk} aria-hidden="true" />
                    )
                  }
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Save on this server
                </Button>
              </Box>
            </Paper>
          )}

          <Paper
            variant="outlined"
            sx={{ p: 3, mb: 3, bgcolor: 'surface1', borderColor: 'hairline' }}
          >
            <Typography variant="h3" component="h2" sx={{ mb: 1.5 }}>
              Restart &amp; check
            </Typography>
            <Typography variant="body1" sx={{ color: 'inkMuted', mb: 2 }}>
              Restart the server, then come back here.
            </Typography>
            <Button
              variant="contained"
              size="large"
              onClick={onRetry}
              startIcon={<FontAwesomeIcon icon={faRotateRight} aria-hidden="true" />}
              data-testid="setup-recheck"
            >
              Recheck
            </Button>
          </Paper>

          {hasDiagnostics && (
            <Paper
              variant="outlined"
              data-testid="setup-diagnostics"
              sx={{ p: 3, mb: 3, bgcolor: 'surface1', borderColor: 'hairline' }}
            >
              <Typography variant="h3" component="h2" sx={{ mb: 1.5 }}>
                What&apos;s left
              </Typography>
              {missing.length > 0 && (
                <Box sx={{ mb: invalid.length > 0 ? 2 : 0 }}>
                  {missing.map((key) => (
                    <Box
                      key={key}
                      data-testid={`missing-var-${key}`}
                      sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}
                    >
                      <FontAwesomeIcon
                        icon={faTriangleExclamation}
                        aria-hidden="true"
                        sx={{ color: 'inkMuted', fontSize: 14, flexShrink: 0 }}
                      />
                      <Typography
                        variant="body2"
                        sx={{ color: 'inkMuted', minWidth: 64, flexShrink: 0 }}
                      >
                        Missing
                      </Typography>
                      <Typography
                        variant="body2"
                        component="code"
                        sx={{ fontFamily: 'monospace' }}
                      >
                        {key}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
              {invalid.length > 0 && (
                <Box>
                  {invalid.map((item) => (
                    <Box
                      key={item.key}
                      data-testid={`invalid-var-${item.key}`}
                      sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}
                    >
                      <FontAwesomeIcon
                        icon={faTriangleExclamation}
                        aria-hidden="true"
                        sx={{ color: 'inkMuted', fontSize: 14, flexShrink: 0 }}
                      />
                      <Typography
                        variant="body2"
                        sx={{ color: 'inkMuted', minWidth: 64, flexShrink: 0 }}
                      >
                        Invalid
                      </Typography>
                      <Typography
                        variant="body2"
                        component="code"
                        sx={{ fontFamily: 'monospace' }}
                      >
                        {item.key}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'inkMuted' }}>
                        &mdash; {item.message}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Paper>
          )}

          <Paper
            variant="outlined"
            sx={{ p: 3, bgcolor: 'surface1', borderColor: 'hairline' }}
          >
            <Typography variant="h3" component="h2" sx={{ mb: 1 }}>
              For your users
            </Typography>
            <Typography variant="body1" sx={{ color: 'inkMuted' }}>
              Once sign-in works, people sign in with Discord and connect their
              own storage in about a minute — no technical knowledge needed.
            </Typography>
          </Paper>
        </>
      )}
    </Box>
  );
}
