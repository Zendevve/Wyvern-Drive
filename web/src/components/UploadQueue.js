import React from 'react';
import {
  Box,
  Button,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Typography,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCircleCheck,
  faCircleXmark,
  faUpload,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';

/**
 * Floating transfer manager (Mega-style). One job per upload request; jobs
 * show progress while uploading, the server-returned name when done, and a
 * retry action on failure. Pinned to the bottom-right of the viewport.
 */
export default function UploadQueue({ jobs, onRetry, onRemove }) {
  if (!jobs || jobs.length === 0) {
    return null;
  }
  const activeCount = jobs.filter((job) => job.status === 'uploading').length;
  return (
    <Box
      sx={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 1300,
        width: 380,
        maxWidth: 'calc(100vw - 32px)',
      }}
      data-testid="upload-queue"
    >
      <Paper elevation={4} sx={{ borderRadius: '20px', overflow: 'hidden' }}>
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderBottom: 1,
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography variant="subtitle1" fontWeight={600}>
            Uploads
          </Typography>
          <Typography variant="caption" color="inkMuted">
            {activeCount} active
          </Typography>
        </Box>
        <List dense disablePadding>
          {jobs.map((job) => (
            <ListItem key={job.id} divider disableGutters sx={{ px: 2, py: 1 }}>
              <ListItemIcon>
                <FontAwesomeIcon
                  icon={
                    job.status === 'done'
                      ? faCircleCheck
                      : job.status === 'failed'
                        ? faCircleXmark
                        : faUpload
                  }
                  color={
                    job.status === 'done'
                      ? '#3AC36F'
                      : job.status === 'failed'
                        ? '#FF5C5C'
                        : '#999999'
                  }
                />
              </ListItemIcon>
              <ListItemText
                primary={job.entry ? job.entry.name : job.file.name}
                primaryTypographyProps={{ variant: 'body2' }}
                secondary={
                  job.status === 'uploading'
                    ? `Uploading ${job.progress}%`
                    : job.status === 'failed'
                      ? (job.error && job.error.message) || 'Upload failed'
                      : 'Uploaded'
                }
                secondaryTypographyProps={{ variant: 'caption', color: 'inkMuted' }}
              />
              {job.status === 'uploading' && (
                <Box sx={{ width: 110, mr: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={job.progress}
                    aria-label={`Upload progress for ${job.file.name}`}
                  />
                </Box>
              )}
              {job.status === 'failed' && (
                <Button size="small" onClick={() => onRetry(job)}>
                  Retry
                </Button>
              )}
              <IconButton
                size="small"
                aria-label={`Remove ${job.file.name} from uploads`}
                onClick={() => onRemove(job.id)}
              >
                <FontAwesomeIcon icon={faXmark} />
              </IconButton>
            </ListItem>
          ))}
        </List>
      </Paper>
    </Box>
  );
}
