import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

/**
 * Full-screen boot/loading state for route-level fetches: a centered
 * spinner with a small caption. `aria-label` carries the loading contract
 * to assistive tech.
 */
export default function ScreenLoader({ label = 'Loading' }) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <CircularProgress size={32} aria-label={label} sx={{ color: 'ink' }} />
      <Typography variant="body2" component="p" sx={{ color: 'inkMuted' }}>
        {label}
      </Typography>
    </Box>
  );
}
