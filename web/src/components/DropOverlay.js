import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { reducedMotion, useSpring } from '../motion/springs';

/**
 * Walk a drop's DataTransfer and resolve it to { file, parentId } pairs:
 * directories are created on the server through `createFolder` as the walk
 * descends (so empty folders survive), and each file is paired with the
 * folder id it belongs to. When the FileSystemEntry API is unavailable
 * (older Firefox, synthetic test events) it falls back to the flat file
 * list, pairing every file with `rootParentId`.
 */
export function collectDroppedFiles(dataTransfer, createFolder, rootParentId) {
  const items =
    dataTransfer && dataTransfer.items ? Array.from(dataTransfer.items) : [];
  const entries = items
    .filter(
      (item) => item.kind === 'file' && typeof item.webkitGetAsEntry === 'function'
    )
    .map((item) => item.webkitGetAsEntry())
    .filter(Boolean);
  if (entries.length > 0) {
    return walkDroppedEntries(entries, rootParentId, createFolder);
  }
  const files =
    dataTransfer && dataTransfer.files ? Array.from(dataTransfer.files) : [];
  return Promise.resolve(files.map((file) => ({ file, parentId: rootParentId })));
}

function readEntryBatch(reader) {
  // Browsers cap readEntries() at ~100 results per call; keep reading until
  // the reader reports an empty batch.
  return new Promise((resolve, reject) => {
    const all = [];
    const readNext = () => {
      reader.readEntries(
        (batch) => {
          if (!batch || batch.length === 0) {
            resolve(all);
            return;
          }
          all.push(...batch);
          readNext();
        },
        reject
      );
    };
    readNext();
  });
}

async function walkDroppedEntries(entries, parentId, createFolder) {
  const pairs = [];
  for (const entry of entries) {
    if (entry.isFile) {
      const file = await new Promise((resolve, reject) =>
        entry.file(resolve, reject)
      );
      pairs.push({ file, parentId });
    } else if (entry.isDirectory) {
      const folder = await createFolder(parentId, entry.name);
      const children = await readEntryBatch(entry.createReader());
      pairs.push(...(await walkDroppedEntries(children, folder.id, createFolder)));
    }
  }
  return pairs;
}

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
        border: `2px dashed ${theme.palette.signal}`,
        borderRadius: '12px',
        bgcolor: theme.palette.signalSoft,
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
      <Typography fontWeight={600} sx={{ color: 'signal' }}>
        {active
          ? 'Drop files or folders to upload to this folder'
          : `Added ${lastCount} file${lastCount === 1 ? '' : 's'} — uploading`}
      </Typography>
    </Box>
  );
}
