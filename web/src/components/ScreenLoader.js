import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

/**
 * Full-screen boot/loading state for route-level fetches. The Signal Deck
 * equivalent of a centered spinner: a graphite cell with an amber activity
 * lamp and a mono label. `aria-label` carries the machine-readable loading
 * contract to assistive tech.
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
      <Box
        sx={{
          width: 56,
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'surface1',
          border: 1,
          borderColor: 'hairline',
          borderRadius: '12px',
        }}
      >
        <CircularProgress
          size={28}
          aria-label={label}
          sx={{ color: 'signal' }}
        />
      </Box>
      <Typography
        variant="overline"
        component="p"
        sx={{ color: 'inkMuted', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace' }}
      >
        {label}
      </Typography>
    </Box>
  );
}
