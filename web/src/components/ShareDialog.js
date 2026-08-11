import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy } from '@fortawesome/free-solid-svg-icons';
import { api } from '../api/client';
import DialogTransition from '../motion/DialogTransition';

function formatDate(value) {
  return new Date(value).toLocaleString();
}

export default function ShareDialog({ open, entry, onClose }) {
  const [shares, setShares] = useState([]);
  const [createdShare, setCreatedShare] = useState(null);
  const [enableExpiry, setEnableExpiry] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !entry) {
      return;
    }
    let cancelled = false;
    setShares([]);
    setCreatedShare(null);
    setEnableExpiry(false);
    setExpiresAt('');
    setBusy(false);
    setError(null);
    setCopied(false);
    api
      .listShares(entry.id)
      .then((data) => {
        if (!cancelled) setShares((data && data.shares) || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [open, entry]);

  const handleCreate = async () => {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const expiresIso =
        enableExpiry && expiresAt ? new Date(expiresAt).toISOString() : null;
      const created = await api.createShare(entry.id, expiresIso);
      setCreatedShare(created);
      const data = await api.listShares(entry.id);
      setShares((data && data.shares) || []);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (shareId) => {
    setBusy(true);
    setError(null);
    try {
      await api.revokeShare(shareId);
      const data = await api.listShares(entry.id);
      setShares((data && data.shares) || []);
      setCreatedShare((prev) => (prev && prev.id === shareId ? null : prev));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = (text) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => setCopied(true))
        .catch(() => setCopied(false));
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      TransitionComponent={DialogTransition}
    >
      <DialogTitle>Share {entry ? entry.name : ''}</DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error.message || String(error)}
          </Alert>
        )}
        {createdShare && (
          <Alert severity="success" sx={{ mb: 2 }} data-testid="share-created">
            <Box sx={{ bgcolor: 'surface1', borderRadius: '10px', px: 2, py: 1.5, mb: 1 }}>
              <Typography
                variant="body2"
                color="inkMuted"
                component="p"
                sx={{ fontFamily: "'Consolas', monospace", wordBreak: 'break-all' }}
              >
                {createdShare.url}
              </Typography>
            </Box>
            <Button
              size="small"
              variant="outlined"
              startIcon={<FontAwesomeIcon icon={faCopy} />}
              onClick={() => handleCopy(createdShare.url)}
              data-testid="copy-share-url"
            >
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          </Alert>
        )}
        <FormControlLabel
          control={
            <Checkbox
              checked={enableExpiry}
              onChange={(e) => setEnableExpiry(e.target.checked)}
            />
          }
          label="Expire link on"
        />
        {enableExpiry && (
          <TextField
            type="datetime-local"
            fullWidth
            size="small"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            inputProps={{ 'aria-label': 'Share expiration' }}
            sx={{ mb: 2 }}
          />
        )}
        <Box sx={{ mb: 2 }}>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={busy}
            data-testid="create-share"
          >
            Create share link
          </Button>
        </Box>
        {shares.length > 0 && (
          <List dense>
            {shares.map((share) => (
              <ListItem key={share.id} divider disableGutters>
                <ListItemText
                  primary={
                    <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                      {share.url}
                    </Typography>
                  }
                  secondary={
                    <Typography variant="caption" color="inkMuted">
                      {share.revokedAt
                        ? 'Revoked'
                        : share.expiresAt
                          ? `Expires ${formatDate(share.expiresAt)}`
                          : 'Never expires'}
                    </Typography>
                  }
                />
                {!share.revokedAt && (
                  <Button size="small" color="error" onClick={() => handleRevoke(share.id)}>
                    Revoke
                  </Button>
                )}
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
