import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
import { entryIcon } from '../components/entryIcons';
import DialogTransition from '../motion/DialogTransition';

function formatDeletedDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return `Deleted ${d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })}`;
}

/**
 * Cloud-Drive Trash Page
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
    if (!purgeEntry) return;
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

  if (loading) return <ScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <AppShell title="Trash">
      <Box data-testid="trash-page" sx={{ pb: 4 }}>
        {/* Header Toolbar */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 2.5,
            pb: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600, color: 'text.primary', fontSize: 18 }}>
              Trash
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 12 }}>
              Items in trash are permanently deleted after 30 days
            </Typography>
          </Box>
          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={<FontAwesomeIcon icon={faTrashCan} size="xs" />}
            onClick={handleEmptyTrash}
            disabled={busy || entries.length === 0}
            data-testid="empty-trash"
            sx={{ borderRadius: 2 }}
          >
            Empty trash
          </Button>
        </Box>

        {notice && <ErrorNotice error={notice} />}

        {entriesLoading ? (
          <Box data-testid="trash-loading" sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={32} />
          </Box>
        ) : entries.length === 0 ? (
          <Paper
            variant="outlined"
            elevation={0}
            data-testid="trash-empty"
            sx={{
              maxWidth: 480,
              mx: 'auto',
              my: 6,
              p: 5,
              bgcolor: 'surface1',
              borderColor: 'divider',
              borderRadius: 3,
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                bgcolor: 'rgba(255, 255, 255, 0.04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'text.disabled',
              }}
            >
              <FontAwesomeIcon icon={faTrashCan} style={{ fontSize: 22 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary', fontSize: 16 }}>
                Trash is empty
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 13, mt: 0.5 }}>
                Items moved to trash will appear here before permanent deletion.
              </Typography>
            </Box>
          </Paper>
        ) : (
          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{ bgcolor: 'surface1', borderRadius: 2, borderColor: 'divider' }}
          >
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'sidebar' }}>
                  <TableCell sx={{ pl: 2 }}>Name</TableCell>
                  <TableCell align="right">Size</TableCell>
                  <TableCell>Date deleted</TableCell>
                  <TableCell align="right" sx={{ pr: 2 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {entries.map((entry) => {
                  const isFolder = entry.kind === 'folder';
                  const { icon, color } = entryIcon(entry);

                  return (
                    <TableRow key={entry.id} hover sx={{ '&:hover': { bgcolor: 'surface2' } }}>
                      <TableCell sx={{ pl: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Box
                            sx={{
                              width: 28,
                              height: 28,
                              borderRadius: '6px',
                              bgcolor: 'rgba(255, 255, 255, 0.04)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <FontAwesomeIcon icon={icon} color={color} style={{ fontSize: 13 }} />
                          </Box>
                          <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500, fontSize: 13.5 }}>
                            {entry.name}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 13 }}>
                          {isFolder ? '—' : formatBytes(entry.sizeBytes)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: 'text.disabled', fontSize: 12.5 }}>
                          {formatDeletedDate(entry.deletedAt)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ pr: 2 }}>
                        <Box sx={{ display: 'inline-flex', gap: 1 }}>
                          <IconButton
                            size="small"
                            aria-label={`Restore ${entry.name}`}
                            onClick={() => handleRestore(entry)}
                            title="Restore"
                            disabled={busy}
                            sx={{ color: 'primary.main', '&:hover': { bgcolor: 'rgba(37, 172, 232, 0.15)' } }}
                          >
                            <FontAwesomeIcon icon={faRotateLeft} size="xs" />
                          </IconButton>
                          <IconButton
                            size="small"
                            aria-label={`Delete forever ${entry.name}`}
                            onClick={() => setPurgeEntry(entry)}
                            title="Delete forever"
                            disabled={busy}
                            sx={{ color: 'error.main', '&:hover': { bgcolor: 'rgba(248, 113, 113, 0.15)' } }}
                          >
                            <FontAwesomeIcon icon={faTrashCan} size="xs" />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* Purge Dialog */}
      <Dialog
        open={purgeEntry !== null}
        TransitionComponent={DialogTransition}
        onClose={() => setPurgeEntry(null)}
      >
        <DialogTitle>Delete {purgeEntry && purgeEntry.name} forever?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'text.secondary' }}>
            This item will be deleted immediately and permanently. You can&apos;t undo this action.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPurgeEntry(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            data-testid="confirm-purge"
            onClick={confirmPurge}
            disabled={busy}
          >
            Delete forever
          </Button>
        </DialogActions>
      </Dialog>
    </AppShell>
  );
}
