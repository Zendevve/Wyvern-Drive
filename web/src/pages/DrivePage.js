import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  Skeleton,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFolderPlus,
  faMagnifyingGlass,
  faUpload,
} from '@fortawesome/free-solid-svg-icons';
import AppShell from '../components/AppShell';
import Breadcrumbs from '../components/Breadcrumbs';
import EntryCards from '../components/EntryCards';
import EntryTable from '../components/EntryTable';
import ErrorNotice from '../components/ErrorNotice';
import FolderDialog from '../components/FolderDialog';
import MoveDialog from '../components/MoveDialog';
import ShareDialog from '../components/ShareDialog';
import UploadQueue from '../components/UploadQueue';
import { api, uploadFile } from '../api/client';
import { useAuth } from '../auth/AuthProvider';

let nextJobId = 1;

export default function DrivePage() {
  const { user, loading, refresh } = useAuth();
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const [trail, setTrail] = useState([]); // { id, name } ancestors; [] = root
  const [entries, setEntries] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [entriesError, setEntriesError] = useState(null);
  const [notice, setNotice] = useState(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('name');
  const [direction, setDirection] = useState('asc');

  const [uploads, setUploads] = useState([]);
  const fileInputRef = useRef(null);

  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [renameEntry, setRenameEntry] = useState(null);
  const [moveEntry, setMoveEntry] = useState(null);
  const [deleteEntry, setDeleteEntry] = useState(null);
  const [shareEntry, setShareEntry] = useState(null);

  const currentParentId = trail.length > 0 ? trail[trail.length - 1].id : null;

  const loadEntries = useCallback(
    async (parentId, query, sortField, sortDirection) => {
      setEntriesLoading(true);
      setEntriesError(null);
      try {
        const data = await api.entries({
          parentId,
          query,
          kind: 'all',
          sort: sortField,
          direction: sortDirection,
        });
        setEntries(data.entries || []);
      } catch (err) {
        setEntriesError(err);
        setEntries([]);
      } finally {
        setEntriesLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadEntries(currentParentId, search, sort, direction);
  }, [currentParentId, search, sort, direction, loadEntries]);

  // Debounce the search box into the server query parameter.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const reload = useCallback(() => {
    loadEntries(currentParentId, search, sort, direction);
  }, [loadEntries, currentParentId, search, sort, direction]);

  const refreshQuota = useCallback(async () => {
    try {
      await refresh();
    } catch {
      // Quota refresh is best-effort.
    }
  }, [refresh]);

  const openFolder = useCallback((entry) => {
    setTrail((prev) => [...prev, { id: entry.id, name: entry.name }]);
  }, []);

  const navigateTo = useCallback((folderId) => {
    setTrail((prev) => {
      if (folderId === null) {
        return [];
      }
      const index = prev.findIndex((part) => part.id === folderId);
      if (index === -1) {
        return prev;
      }
      return prev.slice(0, index + 1);
    });
  }, []);

  const handleSort = useCallback((field) => {
    setSort((prevSort) => {
      if (prevSort === field) {
        setDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prevSort;
      }
      setDirection('asc');
      return field;
    });
  }, []);

  const runUpload = useCallback(
    async (jobId, file) => {
      try {
        const entry = await uploadFile({
          parentId: currentParentId,
          file,
          onProgress: (loaded, total) => {
            const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;
            setUploads((prev) =>
              prev.map((job) =>
                job.id === jobId ? { ...job, progress: percent } : job
              )
            );
          },
        });
        setUploads((prev) =>
          prev.map((job) =>
            job.id === jobId
              ? { ...job, status: 'done', progress: 100, entry }
              : job
          )
        );
        await reload();
        await refreshQuota();
      } catch (err) {
        setUploads((prev) =>
          prev.map((job) =>
            job.id === jobId ? { ...job, status: 'failed', error: err } : job
          )
        );
      }
    },
    [currentParentId, reload, refreshQuota]
  );

  const handleFilesSelected = useCallback(
    (event) => {
      const files = Array.from(event.target.files || []);
      if (files.length === 0) {
        return;
      }
      const jobs = files.map((file) => ({
        id: nextJobId++,
        file,
        status: 'uploading',
        progress: 0,
        error: null,
        entry: null,
      }));
      setUploads((prev) => [...prev, ...jobs]);
      jobs.forEach((job) => {
        runUpload(job.id, job.file);
      });
      event.target.value = '';
    },
    [runUpload]
  );

  const retryUpload = useCallback(
    (job) => {
      setUploads((prev) =>
        prev.map((j) =>
          j.id === job.id
            ? { ...j, status: 'uploading', progress: 0, error: null }
            : j
        )
      );
      runUpload(job.id, job.file);
    },
    [runUpload]
  );

  const removeUpload = useCallback((jobId) => {
    setUploads((prev) => prev.filter((job) => job.id !== jobId));
  }, []);

  const runMutation = useCallback(async (fn) => {
    try {
      await fn();
      setNotice(null);
      return true;
    } catch (err) {
      setNotice(err);
      return false;
    }
  }, []);

  const handleCreateFolder = useCallback(
    async (name) => {
      try {
        await api.createFolder(currentParentId, name);
        setNotice(null);
        await reload();
        return true;
      } catch (err) {
        setNotice(err);
        throw err;
      }
    },
    [currentParentId, reload]
  );

  const handleRename = useCallback(
    async (entry, name) => {
      try {
        await api.updateEntry(entry.id, { name });
        setNotice(null);
        await reload();
        return true;
      } catch (err) {
        setNotice(err);
        throw err;
      }
    },
    [reload]
  );

  const handleMove = useCallback(
    async (entry, targetParentId) => {
      if (targetParentId === (entry.parentId == null ? null : entry.parentId)) {
        return true; // No-op move to the current parent.
      }
      const ok = await runMutation(() =>
        api.updateEntry(entry.id, { parentId: targetParentId })
      );
      if (ok) {
        await reload();
      }
      return ok;
    },
    [runMutation, reload]
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteEntry) {
      return;
    }
    const entry = deleteEntry;
    const ok = await runMutation(() => api.deleteEntry(entry.id));
    setDeleteEntry(null);
    if (ok) {
      await reload();
      await refreshQuota();
    }
  }, [deleteEntry, runMutation, reload, refreshQuota]);

  const actions = useMemo(
    () => ({
      onOpenFolder: openFolder,
      onShare: setShareEntry,
      onRename: setRenameEntry,
      onMove: setMoveEntry,
      onDelete: setDeleteEntry,
    }),
    [openFolder]
  );

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress aria-label="Loading" />
      </Box>
    );
  }

  if (!user) {
    return null; // AuthProvider redirects to /login.
  }

  return (
    <AppShell title="Drive">
      {notice && <ErrorNotice error={notice} onRetry={reload} />}

      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1,
          mb: 2,
          alignItems: 'center',
        }}
      >
        <TextField
          size="small"
          placeholder="Search files and folders"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          sx={{ flexGrow: 1, minWidth: 220 }}
          inputProps={{ 'aria-label': 'Search files and folders' }}
          InputProps={{
            startAdornment: (
              <FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden="true" />
            ),
          }}
        />
        <Button
          variant="contained"
          startIcon={<FontAwesomeIcon icon={faUpload} />}
          onClick={() => fileInputRef.current && fileInputRef.current.click()}
          disabled={entriesLoading}
        >
          Upload
        </Button>
        <Button
          variant="outlined"
          startIcon={<FontAwesomeIcon icon={faFolderPlus} />}
          onClick={() => setFolderDialogOpen(true)}
        >
          New folder
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          data-testid="file-input"
          onChange={handleFilesSelected}
        />
      </Box>

      <UploadQueue jobs={uploads} onRetry={retryUpload} onRemove={removeUpload} />

      <Breadcrumbs trail={trail} onNavigate={navigateTo} />

      {entriesError && <ErrorNotice error={entriesError} onRetry={reload} />}

      {entriesLoading ? (
        <Box data-testid="entries-loading" aria-label="Loading entries">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="rectangular" height={48} sx={{ mb: 1 }} />
          ))}
        </Box>
      ) : entries.length === 0 ? (
        <Paper
          variant="outlined"
          sx={{ p: 4, textAlign: 'center' }}
          data-testid="empty-state"
        >
          <Typography variant="body1" gutterBottom>
            This folder is empty
          </Typography>
          <Button
            variant="contained"
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
          >
            Upload your first file
          </Button>
        </Paper>
      ) : isDesktop ? (
        <EntryTable
          entries={entries}
          sort={sort}
          direction={direction}
          onSort={handleSort}
          actions={actions}
        />
      ) : (
        <EntryCards entries={entries} actions={actions} />
      )}

      <FolderDialog
        open={folderDialogOpen}
        title="New folder"
        description="Folders can contain files and other folders."
        label="Folder name"
        confirmLabel="Create folder"
        onSubmit={handleCreateFolder}
        onClose={() => setFolderDialogOpen(false)}
      />
      <FolderDialog
        open={renameEntry !== null}
        title="Rename"
        description="Choose a new name for this item."
        label="Name"
        initialName={renameEntry ? renameEntry.name : ''}
        confirmLabel="Rename"
        onSubmit={(name) => handleRename(renameEntry, name)}
        onClose={() => setRenameEntry(null)}
      />
      <MoveDialog
        open={moveEntry !== null}
        entry={moveEntry}
        currentParentId={moveEntry ? moveEntry.parentId : null}
        onClose={() => setMoveEntry(null)}
        onMove={handleMove}
      />
      <ShareDialog
        open={shareEntry !== null}
        entry={shareEntry}
        onClose={() => setShareEntry(null)}
      />
      <Dialog open={deleteEntry !== null} onClose={() => setDeleteEntry(null)}>
        <DialogTitle>Delete {deleteEntry ? deleteEntry.name : ''}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {deleteEntry && deleteEntry.kind === 'folder'
              ? 'This folder and everything inside it will be permanently deleted. This cannot be undone.'
              : 'This file will be permanently deleted. This cannot be undone.'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteEntry(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={confirmDelete}
            data-testid="confirm-delete"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </AppShell>
  );
}
