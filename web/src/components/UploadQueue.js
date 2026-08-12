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
  useMediaQuery,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCircleCheck,
  faCircleXmark,
  faStop,
  faUpload,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { api } from '../api/client';
import { reducedMotion, useSpring } from '../motion/springs';

// Measurement/data roles (progress readouts, status labels, counts) use the
// mono stack; body copy never does.
const MONO = "'ui-monospace', SFMono-Regular, Consolas, monospace";

/**
 * Fixed transfer console (Signal Deck). One job per upload request; jobs
 * show progress while uploading, the server-returned name when done, and a
 * retry action on failure. Pinned to the bottom-right of the viewport,
 * safe-area aware, and clamped inside the viewport edge below 412px.
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
  // Below 412px the console must never touch the viewport edge: shrink the
  // max width and pin from the left so a right gutter stays visible.
  const narrow = useMediaQuery('(max-width: 411px)');

  if (!jobs || jobs.length === 0) {
    return null;
  }
  const activeCount = jobs.filter((job) => job.status === 'uploading').length;
  return (
    <Box
      sx={{
        position: 'fixed',
        right: 16,
        bottom: 'max(16px, env(safe-area-inset-bottom))',
        zIndex: 1300,
        width: 380,
        maxWidth: narrow ? 'calc(100vw - 16px)' : 'calc(100vw - 32px)',
        ...(narrow ? { left: 8 } : {}),
      }}
      data-testid="upload-queue"
    >
      <Paper
        elevation={2}
        sx={{
          borderRadius: '12px',
          overflow: 'hidden',
          backgroundColor: 'surface2',
          border: '1px solid',
          borderColor: 'hairline',
        }}
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
            borderBottom: '1px solid',
            borderColor: 'hairline',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography variant="subtitle1" fontWeight={600}>
            Uploads
          </Typography>
          <Typography variant="caption" color="inkMuted" sx={{ fontFamily: MONO }}>
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
  // After the browser reaches 100% the server may still be storing chunks to
  // Discord; DrivePage polls that phase and surfaces it via serverPhase /
  // serverProgress. Never let the bar move backwards — the stored value is
  // the max of browser and server progress.
  const storing =
    job.serverPhase === 'storing' && typeof job.serverProgress === 'number';
  const barTarget =
    job.status === 'done'
      ? 100
      : storing
        ? Math.max(job.progress || 0, job.serverProgress)
        : job.progress;
  const progress = useSpring(barTarget, {
    response: 0.3,
  });
  const [pulseTarget, setPulseTarget] = useState(1);
  const pulse = useSpring(pulseTarget, { response: 0.35, dampingRatio: 0.8 });

  // Cancel stops the in-flight XHR, hard-purges the partial upload server-side
  // (so nothing leaks into quota or trash), then walks the same removal flow
  // as the dismiss button: exit animation, then onRemove.
  const handleCancel = () => {
    if (job.abort) {
      job.abort();
    }
    if (job.uploadToken) {
      api.uploadCancel(job.uploadToken).catch(() => {});
    }
    onRequestRemove(job.id);
  };

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

  const statusColor =
    job.status === 'done'
      ? 'success.main'
      : job.status === 'failed'
        ? 'error.main'
        : 'inkMuted';

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
      <ListItemIcon sx={{ transform: `scale(${pulse})`, color: statusColor }}>
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
        primaryTypographyProps={{ variant: 'body2' }}
        secondary={
          job.status === 'uploading'
            ? job.serverPhase === 'storing'
              ? typeof job.serverProgress === 'number'
                ? `Storing to Discord ${job.serverProgress}%`
                : 'Storing to Discord'
              : `Uploading ${job.progress}%`
            : job.status === 'failed'
              ? (job.error && job.error.message) || 'Upload failed'
              : 'Uploaded'
        }
        secondaryTypographyProps={{
          variant: 'caption',
          color: 'inkMuted',
          sx: { fontFamily: MONO },
        }}
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
      {job.status === 'uploading' && (
        <IconButton
          size="small"
          aria-label={`Cancel upload ${job.file.name}`}
          title="Cancel upload"
          onClick={handleCancel}
        >
          <FontAwesomeIcon icon={faStop} />
        </IconButton>
      )}
      {job.status === 'failed' && (
        <Button size="small" variant="outlined" onClick={() => onRetry(job)}>
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
