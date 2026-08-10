import React from 'react';
import { Alert, AlertTitle, Button } from '@mui/material';

export default function ErrorNotice({ error, onRetry }) {
  if (!error) {
    return null;
  }
  const message = error && error.message ? error.message : String(error);
  return (
    <Alert
      severity="error"
      sx={{ mb: 2 }}
      action={
        onRetry ? (
          <Button color="inherit" size="small" onClick={onRetry}>
            Retry
          </Button>
        ) : null
      }
    >
      <AlertTitle>Something went wrong</AlertTitle>
      {message}
    </Alert>
  );
}
