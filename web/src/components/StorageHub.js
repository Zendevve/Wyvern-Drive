import React from 'react';
import {
  Box,
  CircularProgress,
  Paper,
  Typography,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCloudArrowUp,
  faFileLines,
  faFolder,
  faHardDrive,
  faLock,
  faShieldHalved,
} from '@fortawesome/free-solid-svg-icons';
import { formatBytes } from './QuotaMeter';
import { useUploads } from '../upload/UploadProvider';

/**
 * Storage & Transfer Hub Widget (matching Cloudy reference UI).
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
        width: 320,
        flexShrink: 0,
        borderRadius: '18px',
        bgcolor: 'surface1',
        borderColor: 'hairlineSoft',
        p: 2.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 2.25,
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" sx={{ fontWeight: 600, color: 'ink', fontSize: 16, display: 'flex', alignItems: 'center', gap: 1 }}>
          <FontAwesomeIcon icon={faHardDrive} color="#1E86FF" size="sm" />
          Storage
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: 'accentBlue',
            fontWeight: 600,
            fontSize: 11,
            bgcolor: 'rgba(30, 134, 255, 0.12)',
            px: 1,
            py: 0.25,
            borderRadius: '100px',
          }}
        >
          AES-256
        </Typography>
      </Box>

      {/* Multi-Segment Storage Bar */}
      <Box>
        <Box sx={{ display: 'flex', gap: '4px', height: 8, borderRadius: '100px', overflow: 'hidden', bgcolor: 'rgba(255,255,255,0.06)', mb: 1 }}>
          <Box sx={{ width: `${Math.max(12, percent * 0.45)}%`, bgcolor: '#FF9F0A', borderRadius: '100px 0 0 100px' }} />
          <Box sx={{ width: `${Math.max(8, percent * 0.25)}%`, bgcolor: '#FFB020' }} />
          <Box sx={{ width: `${Math.max(10, percent * 0.20)}%`, bgcolor: '#1E86FF' }} />
          <Box sx={{ width: `${Math.max(6, percent * 0.10)}%`, bgcolor: '#BF5AF2', borderRadius: '0 100px 100px 0' }} />
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'ink', fontSize: 13, fontFamily: 'monospace' }}>
            {formatBytes(usedBytes)} / {formatBytes(quotaBytes)}
          </Typography>
          <Typography variant="caption" sx={{ color: 'inkMuted', fontSize: 11.5 }}>
            {percent}% used
          </Typography>
        </Box>
      </Box>

      {/* 2x2 Metric Grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25 }}>
        {/* Metric 1: Folders */}
        <Box
          sx={{
            p: 1.5,
            borderRadius: '12px',
            bgcolor: 'surface2',
            border: '1px solid hairlineSoft',
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: '#FFB020' }}>
            <FontAwesomeIcon icon={faFolder} size="xs" />
            <Typography variant="caption" sx={{ color: 'inkMuted', fontSize: 11 }}>
              Folders
            </Typography>
          </Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'ink', fontSize: 14 }}>
            {totalFolders}
          </Typography>
        </Box>

        {/* Metric 2: Files */}
        <Box
          sx={{
            p: 1.5,
            borderRadius: '12px',
            bgcolor: 'surface2',
            border: '1px solid hairlineSoft',
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: '#1E86FF' }}>
            <FontAwesomeIcon icon={faFileLines} size="xs" />
            <Typography variant="caption" sx={{ color: 'inkMuted', fontSize: 11 }}>
              Files
            </Typography>
          </Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'ink', fontSize: 14 }}>
            {totalFiles}
          </Typography>
        </Box>

        {/* Metric 3: Encryption */}
        <Box
          sx={{
            p: 1.5,
            borderRadius: '12px',
            bgcolor: 'surface2',
            border: '1px solid hairlineSoft',
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: '#30D158' }}>
            <FontAwesomeIcon icon={faLock} size="xs" />
            <Typography variant="caption" sx={{ color: 'inkMuted', fontSize: 11 }}>
              Encryption
            </Typography>
          </Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'ink', fontSize: 13 }}>
            AES-256
          </Typography>
        </Box>

        {/* Metric 4: Cloud Backing */}
        <Box
          sx={{
            p: 1.5,
            borderRadius: '12px',
            bgcolor: 'surface2',
            border: '1px solid hairlineSoft',
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: '#BF5AF2' }}>
            <FontAwesomeIcon icon={faShieldHalved} size="xs" />
            <Typography variant="caption" sx={{ color: 'inkMuted', fontSize: 11 }}>
              Storage
            </Typography>
          </Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'ink', fontSize: 13 }} noWrap>
            Discord At-Rest
          </Typography>
        </Box>
      </Box>

      {/* Active Upload Card (if any file is uploading) */}
      {activeUpload && (
        <Box
          sx={{
            p: 1.75,
            borderRadius: '14px',
            bgcolor: 'rgba(30, 134, 255, 0.15)',
            border: '1px solid rgba(30, 134, 255, 0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          <Box sx={{ position: 'relative', display: 'inline-flex' }}>
            <CircularProgress
              variant="determinate"
              value={activeUpload.progress || 10}
              size={36}
              thickness={4}
              sx={{ color: '#1E86FF' }}
            />
            <Box
              sx={{
                top: 0,
                left: 0,
                bottom: 0,
                right: 0,
                position: 'absolute',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography variant="caption" sx={{ fontSize: 9, fontWeight: 700, color: 'ink' }}>
                {activeUpload.progress ? `${Math.round(activeUpload.progress)}%` : '...'}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="caption" sx={{ color: 'accentBlue', fontWeight: 600, display: 'block', fontSize: 11 }}>
              Uploading File...
            </Typography>
            <Typography variant="body2" noWrap sx={{ color: 'ink', fontWeight: 600, fontSize: 12.5 }}>
              {activeUpload.name}
            </Typography>
          </Box>
        </Box>
      )}

      {/* Dashed Drag & Drop Box */}
      <Box
        onClick={onUploadClick}
        sx={{
          border: '1.5px dashed rgba(255, 255, 255, 0.14)',
          borderRadius: '14px',
          p: 2.25,
          textAlign: 'center',
          cursor: 'pointer',
          bgcolor: 'rgba(255, 255, 255, 0.02)',
          transition: 'all 140ms ease-out',
          '&:hover': {
            borderColor: 'accentBlue',
            bgcolor: 'rgba(30, 134, 255, 0.05)',
          },
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '10px',
            bgcolor: 'rgba(30, 134, 255, 0.12)',
            color: 'accentBlue',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 1,
          }}
        >
          <FontAwesomeIcon icon={faCloudArrowUp} style={{ fontSize: 18 }} />
        </Box>
        <Typography variant="body2" sx={{ fontWeight: 600, color: 'ink', fontSize: 13 }}>
          Upload Files
        </Typography>
        <Typography variant="caption" sx={{ color: 'inkMuted', fontSize: 11, display: 'block', mt: 0.25 }}>
          Click or drop anywhere
        </Typography>
      </Box>
    </Paper>
  );
}
