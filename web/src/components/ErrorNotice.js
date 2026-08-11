import React from 'react';
import { Box, Button, Paper, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';

export default function ErrorNotice({ error, onRetry }) {
  if (!error) {
    return null;
  }
  const message = error && error.message ? error.message : String(error);
  return (
    <Paper
      elevation={0}
      variant="outlined"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        p: 1.5,
        mb: 2,
        borderRadius: '10px',
      }}
    >
      <Box
        component="span"
        sx={{ display: 'inline-flex', color: 'error.main', fontSize: 18, flexShrink: 0 }}
      >
        <FontAwesomeIcon icon={faTriangleExclamation} aria-hidden="true" />
      </Box>
      <Typography variant="body2" sx={{ flexGrow: 1 }}>
        {message}
      </Typography>
      {onRetry && (
        <Button size="small" color="error" onClick={onRetry}>
          Retry
        </Button>
      )}
    </Paper>
  );
}
