import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import DialogTransition from '../motion/DialogTransition';

/**
 * Single name-input dialog shared by "New folder" and "Rename".
 * `onSubmit(name)` is expected to throw on failure (e.g. a 409 conflict);
 * the error is shown inline and the dialog stays open.
 */
export default function FolderDialog({
  open,
  title = 'New folder',
  description = 'Folders can contain files and other folders.',
  label = 'Folder name',
  initialName = '',
  confirmLabel = 'Create folder',
  onSubmit,
  onClose,
}) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setError(null);
      setBusy(false);
    }
  }, [open, initialName]);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter a name.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(trimmed);
      onClose();
    } catch (err) {
      setError(err && err.message ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      TransitionComponent={DialogTransition}
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          {description}
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <TextField
          autoFocus
          size="small"
          fullWidth
          label={label}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSubmit();
            }
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSubmit}
          disabled={busy}
          data-testid="folder-dialog-submit"
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
