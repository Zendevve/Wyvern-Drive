import React from 'react';
import { Box, Button, Paper, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';

export default function ErrorNotice({ error, onRetry }) {
  if (!error) {
    return null;
  }
  // ApiError messages are operator-safe by construction; never echo codes or stacks.
  const message = error && error.message ? error.message : String(error);
  return (
    <Paper
      elevation={0}
      variant="outlined"
      role="alert"
      sx={(theme) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        p: 1.5,
        mb: 2,
        borderRadius: '10px',
        bgcolor: alpha(theme.palette.error.main, 0.1),
        borderColor: alpha(theme.palette.error.main, 0.35),
      })}
    >
      <Box
        component="span"
        sx={{ display: 'inline-flex', color: 'error.main', fontSize: 18, flexShrink: 0 }}
      >
        <FontAwesomeIcon icon={faTriangleExclamation} aria-hidden="true" />
      </Box>
      <Typography variant="body2" aria-live="polite" sx={{ flexGrow: 1 }}>
        {message}
      </Typography>
      {onRetry && (
        <Button size="small" variant="outlined" color="error" onClick={onRetry}>
          Retry
        </Button>
      )}
    </Paper>
  );
}
