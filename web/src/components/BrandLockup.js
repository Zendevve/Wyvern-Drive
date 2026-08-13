import React from 'react';
import { Box, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolder } from '@fortawesome/free-solid-svg-icons';

/**
 * Wyvern Drive brand lockup: the folder glyph in a surface2 circle plus
 * the wordmark. `compact` is the rail/app-bar size; `align` controls the
 * text alignment for full-width contexts.
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
          width: size,
          height: size,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'surface2',
          border: '1px solid hairline',
          borderRadius: '10px',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
        aria-hidden="true"
      >
        <FontAwesomeIcon icon={faFolder} color="#0099FF" size="sm" />
      </Box>
      <Typography
        variant={compact ? 'subtitle2' : 'h6'}
        noWrap
        sx={{
          fontFamily: "'Mona Sans Variable', sans-serif",
          fontWeight: 500,
          letterSpacing: '-0.5px',
          color: 'ink',
        }}
      >
        Wyvern Drive
      </Typography>
    </Box>
  );
}
