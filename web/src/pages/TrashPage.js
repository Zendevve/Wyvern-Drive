import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Typography,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faRotateLeft,
  faTrashCan,
} from '@fortawesome/free-solid-svg-icons';
import { Navigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import ErrorNotice from '../components/ErrorNotice';
import ScreenLoader from '../components/ScreenLoader';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { formatBytes } from '../components/QuotaMeter';
import { entryIcon, fileTypeLabel } from '../components/entryIcons';
import DialogTransition from '../motion/DialogTransition';

function formatDate(value) {
  return new Date(value).toLocaleString();
}

/**
 * Recycle bin: softly deleted entries, newest first (the server lazily
 * sweeps expired trash on every list). Restore puts an entry and its
 * subtree back; Delete forever hard-purges it; Empty trash purges the
 * root entries only, so children of a trashed folder go with their root.
 */
export default function TrashPage() {
  const { user, loading } = useAuth();
  const [entries, setEntries] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [purgeEntry, setPurgeEntry] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadTrash = useCallback(async () => {
    setEntriesLoading(true);
    setNotice(null);
    try {
      const data = await api.trash.list();
      setEntries((data && data.entries) || []);
    } catch (err) {
      setNotice(err);
    } finally {
      setEntriesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTrash();
  }, [loadTrash]);

  const handleRestore = useCallback(
    async (entry) => {
      setBusy(true);
      try {
        await api.trash.restore(entry.id);
        setNotice(null);
        await loadTrash();
      } catch (err) {
        setNotice(err);
      } finally {
        setBusy(false);
      }
    },
    [loadTrash]
  );

  const confirmPurge = useCallback(async () => {
    if (!purgeEntry) {
      return;
    }
    const entry = purgeEntry;
    setPurgeEntry(null);
    setBusy(true);
    try {
      await api.trash.purge(entry.id);
      setNotice(null);
      await loadTrash();
    } catch (err) {
      setNotice(err);
    } finally {
      setBusy(false);
    }
  }, [purgeEntry, loadTrash]);

  // Children of trashed folders are listed but purged with their root.
  const rootEntries = useMemo(() => {
    const ids = new Set(entries.map((entry) => entry.id));
    return entries.filter(
      (entry) => entry.parentId == null || !ids.has(entry.parentId)
    );
  }, [entries]);

  const handleEmptyTrash = useCallback(async () => {
    setBusy(true);
    try {
      for (const entry of rootEntries) {
        await api.trash.purge(entry.id);
      }
      setNotice(null);
      await loadTrash();
    } catch (err) {
      setNotice(err);
    } finally {
      setBusy(false);
    }
  }, [rootEntries, loadTrash]);

  if (loading) {
    return <ScreenLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppShell title="Trash">
      <Box data-testid="trash-page">
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            mb: 2,
          }}
        >
          <Button
            variant="outlined"
            color="error"
            startIcon={<FontAwesomeIcon icon={faTrashCan} />}
            onClick={handleEmptyTrash}
            disabled={busy || entries.length === 0}
            data-testid="empty-trash"
          >
            Empty trash
          </Button>
        </Box>

        {notice && <ErrorNotice error={notice} />}

        {entriesLoading ? (
          <Box
            data-testid="trash-loading"
            aria-label="Loading trash"
            sx={{ display: 'flex', justifyContent: 'center', py: 6 }}
          >
            <CircularProgress />
          </Box>
        ) : entries.length === 0 ? (
          <Card
            variant="outlined"
            elevation={0}
            data-testid="trash-empty"
            sx={{ borderRadius: '20px', bgcolor: 'surface1' }}
          >
            <CardContent sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'ink' }}>
                Trash is empty
              </Typography>
              <Typography
                variant="body2"
                sx={{ mt: 1, color: 'inkMuted' }}
              >
                Deleted files and folders appear here and can be restored.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {entries.map((entry) => {
              const isFolder = entry.kind === 'folder';
              const { icon, color } = entryIcon(entry);
              const meta = isFolder
                ? `${fileTypeLabel(entry)} · deleted ${formatDate(entry.deletedAt)}`
                : `${formatBytes(entry.sizeBytes)} · deleted ${formatDate(entry.deletedAt)}`;
              return (
                <Card
                  key={entry.id}
                  variant="outlined"
                  elevation={0}
                  sx={{ borderRadius: '15px', bgcolor: 'surface1' }}
                >
                  <CardContent
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      py: 1.5,
                      '&:last-child': { pb: 1.5 },
                    }}
                  >
                    <FontAwesomeIcon icon={icon} color={color} aria-hidden="true" />
                    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                      <Typography
                        variant="body2"
                        noWrap
                        sx={{ fontWeight: 500, color: 'ink' }}
                      >
                        {entry.name}
                      </Typography>
                      <Typography
                        variant="caption"
                        component="p"
                        sx={{ color: 'inkMuted' }}
                      >
                        {meta}
                      </Typography>
                    </Box>
                    <IconButton
                      aria-label={`Restore ${entry.name}`}
                      title="Restore"
                      onClick={() => handleRestore(entry)}
                      disabled={busy}
                    >
                      <FontAwesomeIcon icon={faRotateLeft} />
                    </IconButton>
                    <IconButton
                      aria-label={`Delete forever ${entry.name}`}
                      title="Delete forever"
                      color="error"
                      onClick={() => setPurgeEntry(entry)}
                      disabled={busy}
                      sx={{
                        color: 'error.main',
                        '&:hover': {
                          color: '#FF7575',
                          backgroundColor: 'rgba(255,92,92,0.08)',
                        },
                      }}
                    >
                      <FontAwesomeIcon icon={faTrashCan} />
                    </IconButton>
                  </CardContent>
                </Card>
              );
            })}
          </Box>
        )}
      </Box>

      <Dialog
        open={purgeEntry !== null}
        onClose={() => setPurgeEntry(null)}
        TransitionComponent={DialogTransition}
      >
        <DialogTitle>Delete {purgeEntry ? purgeEntry.name : ''} forever?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {purgeEntry && purgeEntry.kind === 'folder'
              ? 'This folder and everything inside it will be permanently deleted from Discord storage. This cannot be undone.'
              : 'This file will be permanently deleted from Discord storage. This cannot be undone.'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPurgeEntry(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={confirmPurge}
            data-testid="confirm-purge"
          >
            Delete forever
          </Button>
        </DialogActions>
      </Dialog>
    </AppShell>
  );
}
