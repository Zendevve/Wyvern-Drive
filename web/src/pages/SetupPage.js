import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Paper,
  Typography,
} from '@mui/material';
import { Navigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheck,
  faCopy,
  faKey,
  faLink,
  faRotateRight,
  faTriangleExclamation,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { useSpring, springStyle } from '../motion/springs';

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
 * Guided first-run setup page. Renders only what the server's read-only
 * /api/setup/status endpoint reports — variable names and non-secret
 * validation messages — never secret values, and never writes configuration.
 * `status` is null while the status fetch has failed, in which case a Retry
 * action is shown.
 */
export default function SetupPage({ status, onRetry }) {
  // Critically damped arrival; reduced motion falls back to a static fade.
  const entrance = useSpring(1, { initial: 0, response: 0.4 });
  const entranceStyle = springStyle(entrance);

  if (status && !status.setupRequired) {
    return <Navigate to="/login" replace />;
  }

  const unavailable = !status;
  const missing = status ? status.missing || [] : [];
  const invalid = status ? status.invalid || [] : [];
  const hasDiagnostics = missing.length > 0 || invalid.length > 0;

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
