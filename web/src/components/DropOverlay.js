import React from 'react';
import { Box, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCloudArrowUp } from '@fortawesome/free-solid-svg-icons';

/**
 * Scan a dropped DataTransferItemList for files and nested directories.
 */
export async function collectDroppedFiles(dataTransfer, createFolder, rootParentId) {
  const items = Array.from((dataTransfer && dataTransfer.items) || []);
  const createdFolders = new Map();

  async function ensureFolder(parentId, name) {
    const key = `${parentId || 'root'}:${name}`;
    if (createdFolders.has(key)) {
      return createdFolders.get(key);
    }
    const folder = await createFolder(parentId, name);
    createdFolders.set(key, folder.id);
    return folder.id;
  }

  async function traverseEntry(itemEntry, parentId) {
    if (itemEntry.isFile) {
      return new Promise((resolve) => {
        itemEntry.file((file) => {
          resolve([{ file, parentId }]);
        });
      });
    }
    if (itemEntry.isDirectory) {
      const folderId = await ensureFolder(parentId, itemEntry.name);
      const reader = itemEntry.createReader();
      const entries = await new Promise((resolve) => {
        const results = [];
        function readBatch() {
          reader.readEntries((batch) => {
            if (!batch.length) {
              resolve(results);
            } else {
              results.push(...batch);
            }
          });
        }
        readBatch();
      });

      const nested = await Promise.all(
        entries.map((child) => traverseEntry(child, folderId))
      );
      return nested.flat();
    }
    return [];
  }

  const entries = items
    .map((item) => {
      if (item.webkitGetAsEntry) {
        return item.webkitGetAsEntry();
      }
      if (item.getAsEntry) {
        return item.getAsEntry();
      }
      return null;
    })
    .filter(Boolean);

  if (entries.length > 0) {
    const results = await Promise.all(
      entries.map((entry) => traverseEntry(entry, rootParentId))
    );
    return results.flat();
  }

  const files = Array.from((dataTransfer && dataTransfer.files) || []);
  return files.map((file) => ({ file, parentId: rootParentId }));
}

/**
 * Cloud-Drive Drop Target Overlay
 */
export default function DropOverlay({
  active = false,
  open = false,
  onDrop,
  onDragLeave,
  onDragOver,
}) {
  const isDragging = active || open;

  if (!isDragging) return null;

  return (
    <Box
      onDrop={onDrop}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      data-testid="drop-overlay"
      sx={{
        position: 'absolute',
        inset: 0,
        zIndex: 1300,
        bgcolor: 'rgba(12, 14, 18, 0.88)',
        border: '2px dashed',
        borderColor: 'primary.main',
        borderRadius: 3,
        backdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        cursor: 'copy',
        p: 4,
        boxShadow: 'inset 0 0 40px rgba(37, 172, 232, 0.15)',
      }}
    >
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'rgba(37, 172, 232, 0.15)',
          border: '1px solid',
          borderColor: 'primary.main',
          color: 'primary.main',
          boxShadow: '0 0 24px rgba(37, 172, 232, 0.35)',
        }}
      >
        <FontAwesomeIcon icon={faCloudArrowUp} style={{ fontSize: 28 }} />
      </Box>

      <Typography
        variant="h6"
        sx={{
          color: 'text.primary',
          fontWeight: 600,
          fontSize: 16,
        }}
      >
        Drop files to upload
      </Typography>
      <Typography
        variant="body2"
        sx={{ color: 'text.secondary' }}
      >
        Files will be encrypted with AES-256 and uploaded to current directory
      </Typography>
    </Box>
  );
}
