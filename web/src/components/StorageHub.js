import React from 'react';
import {
  Box,
  Button,
  LinearProgress,
  Paper,
  Typography,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCloudArrowUp } from '@fortawesome/free-solid-svg-icons';
import { formatBytes } from './QuotaMeter';
import { useUploads } from '../upload/UploadProvider';

/**
 * Generate an ASCII progress bar string like [████████░░░░] 66%
 */
function makeAsciiBar(percent, length = 16) {
  const filledCount = Math.round((percent / 100) * length);
  const emptyCount = Math.max(0, length - filledCount);
  const filled = '█'.repeat(filledCount);
  const empty = '░'.repeat(emptyCount);
  return `[${filled}${empty}]`;
}

/**
 * system24 TUI Storage & Discord Chunks Hub
 */
export default function StorageHub({
  drive,
  totalFiles = 0,
  totalFolders = 0,
  onUploadClick,
}) {
  const uploadCtx = useUploads();
  const uploads = (uploadCtx && uploadCtx.uploads) || [];
  const activeUpload = Array.isArray(uploads) ? uploads.find((j) => j.status === 'uploading') : null;

  const usedBytes = drive ? drive.usedBytes || 0 : 0;
  const quotaBytes = drive ? drive.quotaBytes || 10737418240 : 10737418240;
  const percent = quotaBytes > 0 ? Math.min(100, Math.round((usedBytes / quotaBytes) * 100)) : 0;

  return (
    <Paper
      elevation={0}
      variant="outlined"
      sx={{
        width: 300,
        flexShrink: 0,
        borderRadius: 0,
        bgcolor: 'surface1',
        borderColor: 'divider',
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid', borderColor: 'divider', pb: 1 }}>
        <Typography variant="overline" sx={{ color: 'text.disabled', fontSize: 10, letterSpacing: '0.08ch' }}>
          [ STORAGE // METRICS ]
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: 'success.main',
            fontSize: 10,
            fontFamily: "'DM Mono', monospace",
          }}
        >
          ● ENCRYPTED
        </Typography>
      </Box>

      {/* ASCII Quota Bar */}
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11 }}>
            USAGE_RATIO:
          </Typography>
          <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600, fontSize: 11 }}>
            {percent}%
          </Typography>
        </Box>
        
        {/* ASCII visual representation */}
        <Typography
          variant="body2"
          sx={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 12,
            letterSpacing: '0.05ch',
            color: 'primary.main',
            lineHeight: 1.2,
            mb: 0.75,
            userSelect: 'none',
          }}
        >
          {makeAsciiBar(percent, 18)}
        </Typography>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 500, fontSize: 11 }}>
            {formatBytes(usedBytes)}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 11 }}>
            MAX: {formatBytes(quotaBytes)}
          </Typography>
        </Box>
      </Box>

      {/* 2x2 Metric Table */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 1,
          borderTop: '1px solid',
          borderBottom: '1px solid',
          borderColor: 'divider',
          py: 1.5,
        }}
      >
        <Box sx={{ p: 1, bgcolor: 'surface2', border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 9.5, display: 'block' }}>
            FOLDERS:
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'warning.main', fontSize: 13 }}>
            {totalFolders}
          </Typography>
        </Box>

        <Box sx={{ p: 1, bgcolor: 'surface2', border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 9.5, display: 'block' }}>
            FILES:
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'info.main', fontSize: 13 }}>
            {totalFiles}
          </Typography>
        </Box>

        <Box sx={{ p: 1, bgcolor: 'surface2', border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 9.5, display: 'block' }}>
            CIPHER:
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'success.main', fontSize: 11.5 }}>
            AES-256-GCM
          </Typography>
        </Box>

        <Box sx={{ p: 1, bgcolor: 'surface2', border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 9.5, display: 'block' }}>
            BACKING:
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main', fontSize: 11.5 }} noWrap>
            DISCORD_WEBHOOK
          </Typography>
        </Box>
      </Box>

      {/* Active Uploading Status */}
      {activeUpload && (
        <Box
          sx={{
            p: 1.25,
            borderRadius: 0,
            bgcolor: 'surface2',
            border: '1px solid',
            borderColor: 'primary.main',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600, fontSize: 10.5 }}>
              [ UPLOADING_JOB ]
            </Typography>
            <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600, fontSize: 10.5 }}>
              {activeUpload.progress ? `${Math.round(activeUpload.progress)}%` : '0%'}
            </Typography>
          </Box>
          <Typography variant="body2" noWrap sx={{ color: 'text.primary', fontSize: 12, mb: 0.75 }}>
            &gt; {activeUpload.name}
          </Typography>
          <LinearProgress variant="determinate" value={activeUpload.progress || 10} />
        </Box>
      )}

      {/* TUI Upload Trigger Button */}
      <Button
        variant="outlined"
        fullWidth
        onClick={onUploadClick}
        startIcon={<FontAwesomeIcon icon={faCloudArrowUp} size="xs" />}
        sx={{
          py: 1,
          fontFamily: "'DM Mono', monospace",
          fontSize: 12,
          color: 'text.primary',
        }}
      >
        [ + UPLOAD TO THIS DIRECTORY ]
      </Button>
    </Paper>
  );
}
