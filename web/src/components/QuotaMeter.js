import React from 'react';
import { Box, LinearProgress, Typography } from '@mui/material';

export function formatBytes(bytes) {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) {
    return '—';
  }
  if (bytes === 0) {
    return '0 B';
  }
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  const unitIndex = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024))
  );
  const value = bytes / Math.pow(1024, unitIndex);
  const rounded = value >= 100 ? Math.round(value).toString() : value.toFixed(1);
  return `${rounded} ${units[unitIndex]}`;
}

export default function QuotaMeter({ drive }) {
  if (!drive) {
    return null;
  }
  const usedBytes = drive.usedBytes || 0;
  const quotaBytes = drive.quotaBytes || 0;
  const percent =
    quotaBytes > 0 ? Math.min(100, Math.round((usedBytes / quotaBytes) * 100)) : 0;
  return (
    <Box sx={{ width: '100%' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 0.5,
        }}
      >
        <Typography
          variant="caption"
          color="inkMuted"
          component="span"
          sx={{ fontWeight: 500 }}
        >
          Storage
        </Typography>
        <Typography
          variant="caption"
          component="span"
          sx={{
            fontFamily: 'monospace',
            fontWeight: 600,
            fontSize: 11,
            color: 'accentBlue',
            bgcolor: 'rgba(0,153,255,0.10)',
            px: 1,
            py: 0.2,
            borderRadius: '100px',
          }}
        >
          {percent}%
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={percent}
        aria-label={`${percent}% of quota used`}
        sx={{ my: 0.75 }}
      />
      <Typography
        variant="caption"
        color="inkMuted"
        component="p"
        sx={{ fontSize: 11, letterSpacing: '-0.1px' }}
      >
        {formatBytes(usedBytes)} of {formatBytes(quotaBytes)} used
      </Typography>
    </Box>
  );
}
