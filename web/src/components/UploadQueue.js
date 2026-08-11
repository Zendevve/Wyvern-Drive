import React, { useEffect, useRef, useState } from 'react';
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
import { reducedMotion, useSpring } from '../motion/springs';

/**
 * Floating transfer manager (Mega-style). One job per upload request; jobs
 * show progress while uploading, the server-returned name when done, and a
 * retry action on failure. Pinned to the bottom-right of the viewport.
 *
 * Motion: the panel fades/slides in when the first job appears; each row
 * springs in, smooths its progress bar, pulses its check icon on completion,
 * and fades out before the parent actually removes the job. All springs
 * honor prefers-reduced-motion (opacity only).
 */
export default function UploadQueue({ jobs, onRetry, onRemove }) {
  const hasJobs = !!(jobs && jobs.length > 0);
  // Target 1 only while there are jobs so the entrance plays when the panel
  // first appears, not invisibly on mount with an empty queue.
  const panelEnter = useSpring(hasJobs ? 1 : 0, { initial: 0, response: 0.4 });
  const [removing, setRemoving] = useState(new Set());

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
      <Paper
        elevation={4}
        sx={{ borderRadius: '20px', overflow: 'hidden' }}
        style={{
          opacity: panelEnter,
          ...(reducedMotion()
            ? {}
            : {
                transform: `translateY(${(1 - panelEnter) * 6}px) scale(${0.98 + 0.02 * panelEnter})`,
                willChange: 'transform, opacity',
              }),
        }}
      >
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
            <QueueJobItem
              key={job.id}
              job={job}
              removing={removing.has(job.id)}
              onRequestRemove={(id) =>
                setRemoving((prev) => new Set(prev).add(id))
              }
              onRetry={onRetry}
              onRemove={onRemove}
            />
          ))}
        </List>
      </Paper>
    </Box>
  );
}

function QueueJobItem({ job, removing, onRequestRemove, onRetry, onRemove }) {
  const enter = useSpring(1, { initial: 0, response: 0.4 });
  const exit = useSpring(removing ? 0 : 1, { response: 0.25 });
  const progress = useSpring(job.status === 'done' ? 100 : job.progress, {
    response: 0.3,
  });
  const [pulseTarget, setPulseTarget] = useState(1);
  const pulse = useSpring(pulseTarget, { response: 0.35, dampingRatio: 0.8 });

  // Fire the real removal exactly once, after the exit spring has finished.
  // The ref guard keeps it to a single call even if the parent defers the
  // unmount (e.g. a no-op handler in tests).
  const removalFired = useRef(false);
  useEffect(() => {
    if (!removalFired.current && removing && exit < 0.02) {
      removalFired.current = true;
      onRemove(job.id);
    }
  }, [removing, exit, job.id, onRemove]);

  // Small momentum reward on completion: the check icon pulses once.
  useEffect(() => {
    if (job.status === 'done') {
      setPulseTarget(1.08);
      const timer = setTimeout(() => setPulseTarget(1), 160);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [job.status]);

  return (
    <ListItem
      divider
      disableGutters
      sx={{ px: 2, py: 1 }}
      style={{
        opacity: enter * exit,
        ...(reducedMotion()
          ? {}
          : {
              transform: `translateY(${(1 - enter) * 8}px) scale(${0.97 + 0.03 * enter * exit})`,
              willChange: 'transform, opacity',
            }),
      }}
    >
      <ListItemIcon sx={{ transform: `scale(${pulse})` }}>
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
            value={progress}
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
        onClick={() => onRequestRemove(job.id)}
      >
        <FontAwesomeIcon icon={faXmark} />
      </IconButton>
    </ListItem>
  );
}
