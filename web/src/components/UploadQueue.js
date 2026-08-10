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
 * One job per upload request. Jobs show progress while uploading, the
 * server-returned name when done, and a retry action on failure.
 */
export default function UploadQueue({ jobs, onRetry, onRemove }) {
  if (!jobs || jobs.length === 0) {
    return null;
  }
  return (
    <Paper variant="outlined" sx={{ mb: 2, p: 2 }} data-testid="upload-queue" aria-label="Upload queue">
      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        Uploads
      </Typography>
      <List dense disablePadding>
        {jobs.map((job) => (
          <ListItem key={job.id} divider disableGutters>
            <ListItemIcon>
              <FontAwesomeIcon
                icon={
                  job.status === 'done'
                    ? faCircleCheck
                    : job.status === 'failed'
                      ? faCircleXmark
                      : faUpload
                }
              />
            </ListItemIcon>
            <ListItemText
              primary={job.entry ? job.entry.name : job.file.name}
              secondary={
                job.status === 'uploading'
                  ? `Uploading ${job.progress}%`
                  : job.status === 'failed'
                    ? (job.error && job.error.message) || 'Upload failed'
                    : 'Uploaded'
              }
            />
            {job.status === 'uploading' && (
              <Box sx={{ width: 120, mr: 1 }}>
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
  );
}
