import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { reducedMotion, useSpring } from '../motion/springs';

/**
 * Full-bleed drag-and-drop ring for the entries area.
 *
 * Two phases, both spring-animated (scale 0.985 -> 1 + fade, response 0.3):
 *   - active: while a drag is over the entries area
 *   - confirmed: a brief 1.1s "Added N files — uploading" flash after a drop,
 *     so the handoff to the upload queue is visible even when the drop
 *     happens on an empty area or the queue slides in a beat later.
 * Under `prefers-reduced-motion` only opacity animates.
 */
export default function DropOverlay({ active, dropCount }) {
  const [confirmed, setConfirmed] = useState(false);
  const [lastCount, setLastCount] = useState(0);

  useEffect(() => {
    if (dropCount <= 0) {
      return undefined;
    }
    setLastCount(dropCount);
    setConfirmed(true);
    const timer = setTimeout(() => setConfirmed(false), 1100);
    return () => clearTimeout(timer);
  }, [dropCount]);

  const shown = active || confirmed;
  const enter = useSpring(shown ? 1 : 0, { response: 0.3 });

  if (!shown && enter < 0.02) {
    return null;
  }

  return (
    <Box
      data-testid="drop-overlay"
      sx={(theme) => ({
        position: 'absolute',
        inset: 0,
        border: `2px dashed ${theme.palette.primary.main}`,
        borderRadius: '15px',
        bgcolor: alpha(theme.palette.primary.main, 0.06),
        zIndex: 1100,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      })}
      style={{
        opacity: enter,
        ...(reducedMotion()
          ? {}
          : {
              transform: `scale(${0.985 + 0.015 * enter})`,
              willChange: 'transform, opacity',
            }),
      }}
    >
      <Typography fontWeight={600} sx={{ color: 'primary.main' }}>
        {active
          ? 'Drop files to upload to this folder'
          : `Added ${lastCount} file${lastCount === 1 ? '' : 's'} — uploading`}
      </Typography>
    </Box>
  );
}
