import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { reducedMotion, useSpring } from '../motion/springs';

/**
 * Walk a drop's DataTransfer and resolve it to { file, parentId } pairs.
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
 * Drag-and-Drop overlay for uploading files.
 */
export default function DropOverlay({ active = false, open = false, dropCount = 0 }) {
  const isDragActive = Boolean(active || open);
  const [confirmed, setConfirmed] = useState(false);
  const [lastCount, setLastCount] = useState(0);

  useEffect(() => {
    if (!dropCount || dropCount <= 0) {
      return undefined;
    }
    setLastCount(dropCount);
    setConfirmed(true);
    const timer = setTimeout(() => setConfirmed(false), 1100);
    return () => clearTimeout(timer);
  }, [dropCount]);

  const shown = isDragActive || confirmed;
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
        borderRadius: '16px',
        bgcolor: alpha(theme.palette.primary.main, 0.08),
        zIndex: 1100,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(4px)',
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
      <Typography fontWeight={600} sx={{ color: 'primary.main', fontSize: 16 }}>
        {isDragActive
          ? 'Drop files or folders to upload to this folder'
          : `Added ${lastCount} file${lastCount === 1 ? '' : 's'} — uploading`}
      </Typography>
    </Box>
  );
}
