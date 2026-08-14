import React from 'react';
import { Box, LinearProgress, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCloud } from '@fortawesome/free-solid-svg-icons';

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

export default function QuotaMeter({ drive, showIcon = false }) {
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
          mb: 0.75,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {showIcon && (
            <FontAwesomeIcon icon={faCloud} style={{ fontSize: 13, color: '#25ACE8' }} />
          )}
          <Typography
            variant="caption"
            sx={{ fontWeight: 600, color: 'text.secondary', fontSize: 12 }}
          >
            Storage
          </Typography>
        </Box>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 600,
            fontSize: 11,
            color: 'primary.main',
            bgcolor: 'rgba(37, 172, 232, 0.12)',
            px: 0.75,
            py: 0.2,
            borderRadius: '4px',
          }}
        >
          {percent}%
        </Typography>
      </Box>

      <LinearProgress
        variant="determinate"
        value={percent}
        aria-label={`${percent}% of quota used`}
        sx={{
          my: 0.75,
          height: 6,
          bgcolor: 'rgba(255, 255, 255, 0.08)',
          borderRadius: 9999,
          '& .MuiLinearProgress-bar': {
            background: percent > 90 ? '#F87171' : 'linear-gradient(90deg, #25ACE8 0%, #38BDF8 100%)',
          },
        }}
      />

      <Typography
        variant="caption"
        component="p"
        sx={{ color: 'text.disabled', fontSize: 11.5, mt: 0.5 }}
      >
        {formatBytes(usedBytes)} of {formatBytes(quotaBytes)} used
      </Typography>
    </Box>
  );
}
