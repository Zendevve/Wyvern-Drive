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
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
        <Box
          component="span"
          aria-hidden="true"
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            bgcolor: 'signal',
            flexShrink: 0,
          }}
        />
        <Typography variant="overline" component="p" sx={{ color: 'inkMuted' }}>
          Storage
        </Typography>
      </Box>
      <Typography
        variant="caption"
        component="p"
        sx={{
          color: 'inkMuted',
          fontFamily: "'ui-monospace', SFMono-Regular, Consolas, monospace",
          letterSpacing: '0.01em',
          mb: 0.75,
        }}
      >
        {formatBytes(usedBytes)} of {formatBytes(quotaBytes)} used
      </Typography>
      <LinearProgress
        variant="determinate"
        value={percent}
        aria-label={`${percent}% of quota used`}
        sx={{ mt: 0.5 }}
      />
    </Box>
  );
}
