import React from 'react';
import { Box, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolder } from '@fortawesome/free-solid-svg-icons';

/**
 * Wyvern Drive brand lockup: first-party cloud mark + wordmark.
 */
export default function BrandLockup({ compact = false, align = 'left' }) {
  const size = compact ? 28 : 34;
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: align === 'center' ? 'center' : 'flex-start',
        gap: 1.5,
        minWidth: 0,
      }}
    >
      <Box
        sx={{
          width: size,
          height: size,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'rgba(0, 132, 255, 0.12)',
          border: '1px solid rgba(0, 132, 255, 0.28)',
          borderRadius: '9px',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 2px 8px rgba(0, 132, 255, 0.15)',
        }}
        aria-hidden="true"
      >
        <FontAwesomeIcon icon={faFolder} color="#0084FF" size="sm" />
      </Box>
      <Typography
        variant={compact ? 'subtitle2' : 'h6'}
        noWrap
        sx={{
          fontFamily: "'Mona Sans Variable', sans-serif",
          fontWeight: 600,
          fontSize: compact ? 15 : 17,
          letterSpacing: '-0.02em',
          color: 'ink',
        }}
      >
        Wyvern Drive
      </Typography>
    </Box>
  );
}
