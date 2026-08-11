import React from 'react';
import { Alert, Box, Button, Paper, Typography } from '@mui/material';
import { Navigate } from 'react-router-dom';
import { useSpring, springStyle } from '../motion/springs';

const CHECKLIST = [
  {
    title: 'Create a Discord application',
    body: 'At discord.com/developers/applications, create an application with OAuth2 credentials. Wyvern signs users in with OAuth2; no bot is needed. Each user connects their own Discord webhook on the /connect page.',
  },
  {
    title: 'Register the OAuth redirect URI',
    body: (
      <>
        Add{' '}
        <code>
          {'<APP_ORIGIN>/api/auth/discord/callback'}
        </code>{' '}
        to the application&apos;s OAuth2 redirect list. The server must be
        reachable at that exact URL.
      </>
    ),
  },
  {
    title: 'Point the server at a database',
    body: (
      <>
        Set <code>DB_URL</code> to a SQLite file path (the parent directory is
        created automatically). Use <code>:memory:</code> for tests only.
      </>
    ),
  },
  {
    title: 'Generate the encryption key',
    body: (
      <>
        Generate a base64-encoded 32-byte key, e.g.{' '}
        <code>node -e &quot;console.log(require(&apos;crypto&apos;).randomBytes(32).toString(&apos;base64&apos;))&quot;</code>
        , and never share it. The server uses it to encrypt every file chunk
        and every user&apos;s webhook credential at rest.
      </>
    ),
  },
  {
    title: 'Fill in server/.env',
    body: (
      <>
        Copy <code>.env.example</code> to <code>.env</code> and fill in every
        value, including the ones listed below.
      </>
    ),
  },
  {
    title: 'Restart the server',
    body: 'Stop the server and run npm start again. This page disappears and sign-in becomes available once the configuration is complete.',
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
        One-time operator setup. Secrets never leave the server.
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
            sx={{ p: 3, mb: 3, bgcolor: 'surface1', borderColor: 'hairline' }}
          >
            <Typography variant="h3" component="h2" sx={{ mb: 1.5 }}>
              How Wyvern stores your files
            </Typography>
            <Typography variant="body1" sx={{ color: 'inkMuted', mb: 1 }}>
              Wyvern uses a Discord OAuth2 application for sign-in. No bot is
              involved: each user connects their own Discord webhook on the
              authenticated <code>/connect</code> page, and the server stores
              the webhook URL encrypted at rest. Files are encrypted
              server-side with AES-256-GCM before upload, and the browser
              never receives bot tokens, webhook URLs, or raw attachment
              URLs.
            </Typography>
          </Paper>

          {hasDiagnostics && (
            <Paper
              variant="outlined"
              data-testid="setup-diagnostics"
              sx={{ p: 3, mb: 3, bgcolor: 'surface1', borderColor: 'hairline' }}
            >
              <Typography variant="h3" component="h2" sx={{ mb: 1.5 }}>
                What the server is missing
              </Typography>
              {missing.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ color: 'inkMuted', mb: 1 }}>
                    Missing variables
                  </Typography>
                  {missing.map((key) => (
                    <Typography
                      key={key}
                      variant="body2"
                      component="div"
                      data-testid={`missing-var-${key}`}
                      sx={{ mb: 0.5 }}
                    >
                      <code>{key}</code>
                    </Typography>
                  ))}
                </Box>
              )}
              {invalid.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ color: 'inkMuted', mb: 1 }}>
                    Invalid values
                  </Typography>
                  {invalid.map((item) => (
                    <Typography
                      key={item.key}
                      variant="body2"
                      component="div"
                      data-testid={`invalid-var-${item.key}`}
                      sx={{ mb: 0.5 }}
                    >
                      <code>{item.key}</code> — {item.message}
                    </Typography>
                  ))}
                </Box>
              )}
            </Paper>
          )}

          <Paper
            variant="outlined"
            data-testid="setup-checklist"
            sx={{ p: 3, mb: 3, bgcolor: 'surface1', borderColor: 'hairline' }}
          >
            <Typography variant="h3" component="h2" sx={{ mb: 2 }}>
              Operator checklist
            </Typography>
            {CHECKLIST.map((step, i) => (
              <Box key={step.title} sx={{ display: 'flex', mb: 1.5 }}>
                <Typography
                  variant="body2"
                  component="div"
                  sx={{ color: 'inkMuted', mr: 2, minWidth: 22 }}
                >
                  {i + 1}.
                </Typography>
                <Box>
                  <Typography variant="subtitle2" component="div">
                    {step.title}
                  </Typography>
                  <Typography variant="body1" sx={{ color: 'inkMuted' }}>
                    {step.body}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Paper>
        </>
      )}
    </Box>
  );
}
