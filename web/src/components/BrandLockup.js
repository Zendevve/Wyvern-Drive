import React from 'react';
import { Box, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCloud } from '@fortawesome/free-solid-svg-icons';

/**
 * Wyvern Drive Brand Lockup
 */
export default function BrandLockup({ compact = false, align = 'left' }) {
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
          width: compact ? 26 : 30,
          height: compact ? 26 : 30,
          borderRadius: '8px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'rgba(37, 172, 232, 0.15)',
          border: '1px solid',
          borderColor: 'rgba(37, 172, 232, 0.4)',
          color: 'primary.main',
          boxShadow: '0 0 10px rgba(37, 172, 232, 0.2)',
        }}
        aria-hidden="true"
      >
        <FontAwesomeIcon icon={faCloud} style={{ fontSize: compact ? 12 : 14 }} />
      </Box>
      <Typography
        variant={compact ? 'subtitle2' : 'h6'}
        noWrap
        sx={{
          fontFamily: "'Mona Sans Variable', 'Inter Variable', sans-serif",
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: 'text.primary',
        }}
      >
        Wyvern Drive
      </Typography>
    </Box>
  );
}
