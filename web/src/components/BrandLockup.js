import React from 'react';
import { Box, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolder } from '@fortawesome/free-solid-svg-icons';

/**
 * Wyvern Drive brand lockup: the folder glyph inside the Signal Deck mark —
 * a graphite cell with an amber signal lamp — plus the wordmark. `compact`
 * is the rail/app-bar size; `align` controls the text alignment for
 * full-width contexts.
 */
export default function BrandLockup({ compact = false, align = 'left' }) {
  const size = compact ? 30 : 38;
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
          position: 'relative',
          width: size,
          height: size,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'surface2',
          border: 1,
          borderColor: 'hairline',
          borderRadius: '8px',
        }}
        aria-hidden="true"
      >
        <FontAwesomeIcon icon={faFolder} color="#F4F1E8" size="sm" />
        <Box
          sx={{
            position: 'absolute',
            top: 5,
            right: 5,
            width: 6,
            height: 6,
            borderRadius: '50%',
            bgcolor: 'signal',
            boxShadow: '0 0 6px rgba(217,164,65,0.7)',
          }}
        />
      </Box>
      <Typography
        variant={compact ? 'subtitle2' : 'h6'}
        noWrap
        sx={{
          fontFamily: "'Mona Sans Variable', sans-serif",
          fontWeight: 500,
          letterSpacing: '-0.4px',
          color: 'ink',
        }}
      >
        Wyvern Drive
      </Typography>
    </Box>
  );
}
