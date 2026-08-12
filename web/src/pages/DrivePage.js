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
  IconButton,
  Paper,
  Skeleton,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowRightArrowLeft,
  faDownload,
  faFolderOpen,
  faFolderPlus,
  faMagnifyingGlass,
  faPen,
  faShareNodes,
  faTableCellsLarge,
  faTableList,
  faTrash,
  faUpload,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import AppShell from '../components/AppShell';
import Breadcrumbs from '../components/Breadcrumbs';
import DropOverlay from '../components/DropOverlay';
import EntryCards from '../components/EntryCards';
import EntryGrid from '../components/EntryGrid';
import EntryTable from '../components/EntryTable';
import ErrorNotice from '../components/ErrorNotice';
import FolderDialog from '../components/FolderDialog';
import MoveDialog from '../components/MoveDialog';
import PreviewDialog from '../components/PreviewDialog';
import ShareDialog from '../components/ShareDialog';
import QuotaMeter from '../components/QuotaMeter';
import UploadQueue from '../components/UploadQueue';
import {
  api,
  archiveUrl,
  downloadUrl,
  uploadFile,
  uploadProgress,
} from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import DialogTransition from '../motion/DialogTransition';
import { gradients } from '../theme';

let nextJobId = 1;

// Client-generated resume token: a UUID when the platform provides one,
// otherwise a unique-enough timestamp/random fallback. Retrying an upload
// reuses the token so the server can resume the same entry.
function newUploadToken() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `u-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function DrivePage() {
  const { user, drive, loading, refresh } = useAuth();
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
  const [previewEntry, setPreviewEntry] = useState(null);

  const [view, setView] = useState(() => {
    try {
      return localStorage.getItem('wyvern.view') === 'grid' ? 'grid' : 'list';
    } catch {
      return 'list';
    }
  });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [dragging, setDragging] = useState(false);
  const [dropCount, setDropCount] = useState(0);

  useEffect(() => {
    try {
      localStorage.setItem('wyvern.view', view);
    } catch {
      // Storage may be unavailable; the view still works for this session.
    }
  }, [view]);

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

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((ids, checked) => {
    setSelectedIds(checked ? new Set(ids) : new Set());
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const openFolder = useCallback(
    (entry) => {
      clearSelection();
      setTrail((prev) => [...prev, { id: entry.id, name: entry.name }]);
    },
    [clearSelection]
  );

  const navigateTo = useCallback(
    (folderId) => {
      clearSelection();
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
    },
    [clearSelection]
  );

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

  // Server-side "storing to Discord" progress polling. Once the browser has
  // pushed 100% of the bytes the XHR is still pending while the server posts
  // chunks to Discord; poll the resume token and surface postedBytes so the
  // queue can show real storage progress. Display-only: failures are ignored
  // and the poll never blocks the upload promise.
  const pollTimersRef = useRef(new Map()); // jobId -> interval id
  const pollsInFlightRef = useRef(new Set()); // jobIds with a request in flight
  useEffect(() => {
    const timers = pollTimersRef.current;
    return () => {
      timers.forEach((timer) => clearInterval(timer));
      timers.clear();
    };
  }, []);

  const stopServerPoll = useCallback((jobId) => {
    const timer = pollTimersRef.current.get(jobId);
    if (timer) {
      clearInterval(timer);
      pollTimersRef.current.delete(jobId);
    }
    pollsInFlightRef.current.delete(jobId);
  }, []);

  const pollServerProgress = useCallback(async (jobId, uploadToken) => {
    if (pollsInFlightRef.current.has(jobId)) {
      return;
    }
    pollsInFlightRef.current.add(jobId);
    try {
      const data = await uploadProgress(uploadToken);
      const expected = data && data.expectedBytes;
      const posted = data && data.postedBytes;
      let pct = null;
      if (expected && expected > 0 && typeof posted === 'number') {
        pct = Math.max(0, Math.min(100, Math.round((posted / expected) * 100)));
      }
      setUploads((prev) =>
        prev.map((job) =>
          job.id === jobId
            ? { ...job, serverPhase: 'storing', serverProgress: pct }
            : job
        )
      );
    } catch {
      // Server progress is display-only; ignore poll failures.
    } finally {
      pollsInFlightRef.current.delete(jobId);
    }
  }, []);

  const startServerPoll = useCallback(
    (jobId, uploadToken) => {
      if (!uploadToken || pollTimersRef.current.has(jobId)) {
        return;
      }
      const timer = setInterval(
        () => pollServerProgress(jobId, uploadToken),
        1000
      );
      pollTimersRef.current.set(jobId, timer);
      pollServerProgress(jobId, uploadToken);
    },
    [pollServerProgress]
  );

  const runUpload = useCallback(
    async (job) => {
      const jobId = job.id;
      const uploadToken = job.uploadToken;
      try {
        const entry = await uploadFile({
          parentId: currentParentId,
          file: job.file,
          uploadToken,
          fileSize: job.file.size,
          onProgress: (loaded, total) => {
            const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;
            setUploads((prev) =>
              prev.map((j) =>
                j.id === jobId ? { ...j, progress: percent } : j
              )
            );
            if (total > 0 && loaded >= total) {
              startServerPoll(jobId, uploadToken);
            }
          },
        });
        stopServerPoll(jobId);
        setUploads((prev) =>
          prev.map((j) =>
            j.id === jobId ? { ...j, status: 'done', progress: 100, entry } : j
          )
        );
        await reload();
        await refreshQuota();
      } catch (err) {
        stopServerPoll(jobId);
        setUploads((prev) =>
          prev.map((j) =>
            j.id === jobId ? { ...j, status: 'failed', error: err } : j
          )
        );
      }
    },
    [
      currentParentId,
      reload,
      refreshQuota,
      startServerPoll,
      stopServerPoll,
    ]
  );

  const enqueueFiles = useCallback(
    (files) => {
      if (!files || files.length === 0) {
        return;
      }
      const jobs = files.map((file) => ({
        id: nextJobId++,
        file,
        uploadToken: newUploadToken(),
        status: 'uploading',
        progress: 0,
        error: null,
        entry: null,
        serverPhase: null,
        serverProgress: null,
      }));
      setUploads((prev) => [...prev, ...jobs]);
      jobs.forEach((job) => {
        runUpload(job);
      });
    },
    [runUpload]
  );

  const handleFilesSelected = useCallback(
    (event) => {
      enqueueFiles(Array.from(event.target.files || []));
      event.target.value = '';
    },
    [enqueueFiles]
  );

  const retryUpload = useCallback(
    (job) => {
      setUploads((prev) =>
        prev.map((j) =>
          j.id === job.id
            ? {
                ...j,
                status: 'uploading',
                progress: 0,
                error: null,
                serverPhase: null,
                serverProgress: null,
              }
            : j
        )
      );
      // Reuse the job's original token so the server resumes the same entry.
      runUpload(job);
    },
    [runUpload]
  );

  const removeUpload = useCallback(
    (jobId) => {
      stopServerPoll(jobId);
      setUploads((prev) => prev.filter((job) => job.id !== jobId));
    },
    [stopServerPoll]
  );

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
      clearSelection();
    }
  }, [deleteEntry, runMutation, reload, refreshQuota, clearSelection]);

  const actions = useMemo(
    () => ({
      onOpenFolder: openFolder,
      onShare: setShareEntry,
      onRename: setRenameEntry,
      onMove: setMoveEntry,
      onDelete: setDeleteEntry,
      onPreview: setPreviewEntry,
    }),
    [openFolder]
  );

  // Exactly one selected entry (if any) — the object the single-item
  // selection bar actions operate on.
  const singleSelected = useMemo(() => {
    if (selectedIds.size !== 1) {
      return null;
    }
    const id = [...selectedIds][0];
    return entries.find((entry) => entry.id === id) || null;
  }, [selectedIds, entries]);

  const singleSelectedFile =
    singleSelected && singleSelected.kind !== 'folder' ? singleSelected : null;

  const singleSelectedFolder =
    singleSelected && singleSelected.kind === 'folder' ? singleSelected : null;

  const handleBulkDelete = useCallback(async () => {
    for (const id of [...selectedIds]) {
      const ok = await runMutation(() => api.deleteEntry(id));
      if (!ok) {
        break;
      }
    }
    await reload();
    await refreshQuota();
    clearSelection();
  }, [selectedIds, runMutation, reload, refreshQuota, clearSelection]);

  const handleDragOver = useCallback(
    (event) => {
      event.preventDefault();
      if (!entriesLoading) {
        setDragging(true);
      }
    },
    [entriesLoading]
  );

  const handleDragLeave = useCallback((event) => {
    event.preventDefault();
    if (
      !event.relatedTarget ||
      !event.currentTarget.contains(event.relatedTarget)
    ) {
      setDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      setDragging(false);
      if (event.dataTransfer && event.dataTransfer.files) {
        enqueueFiles(Array.from(event.dataTransfer.files));
        setDropCount((c) => c + 1);
      }
    },
    [enqueueFiles]
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
              <Box
                component="span"
                sx={{ color: 'inkMuted', display: 'inline-flex' }}
              >
                <FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden="true" />
              </Box>
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
        {isDesktop && (
          <Box sx={{ display: 'inline-flex', gap: 1 }}>
            <IconButton
              aria-label="List view"
              aria-pressed={view === 'list'}
              onClick={() => setView('list')}
              sx={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                color: view === 'list' ? 'ink' : 'inkMuted',
                bgcolor: view === 'list' ? 'surface2' : 'transparent',
              }}
            >
              <FontAwesomeIcon icon={faTableList} />
            </IconButton>
            <IconButton
              aria-label="Grid view"
              aria-pressed={view === 'grid'}
              onClick={() => setView('grid')}
              sx={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                color: view === 'grid' ? 'ink' : 'inkMuted',
                bgcolor: view === 'grid' ? 'surface2' : 'transparent',
              }}
            >
              <FontAwesomeIcon icon={faTableCellsLarge} />
            </IconButton>
          </Box>
        )}
        <Box
          sx={{ ml: 'auto', width: 200, display: isDesktop ? 'block' : 'none' }}
        >
          <QuotaMeter drive={drive} />
        </Box>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          data-testid="file-input"
          onChange={handleFilesSelected}
        />
      </Box>

      {isDesktop && selectedIds.size > 0 && (
        <Paper
          elevation={3}
          data-testid="selection-bar"
          sx={{
            bgcolor: 'surface2',
            borderRadius: '20px',
            px: 3,
            py: 1.5,
            mb: 2,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            alignItems: 'center',
          }}
        >
          <Typography variant="caption" color="ink" sx={{ mr: 1 }}>
            {selectedIds.size} selected
          </Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<FontAwesomeIcon icon={faDownload} />}
            disabled={!(singleSelectedFile || singleSelectedFolder)}
            onClick={() => {
              if (singleSelectedFolder) {
                window.location.href = archiveUrl(singleSelectedFolder.id);
              } else if (singleSelectedFile) {
                window.location.href = downloadUrl(singleSelectedFile.id);
              }
            }}
          >
            Download
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<FontAwesomeIcon icon={faShareNodes} />}
            disabled={!singleSelectedFile}
            onClick={() => singleSelectedFile && setShareEntry(singleSelectedFile)}
          >
            Share
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<FontAwesomeIcon icon={faPen} />}
            disabled={!singleSelected}
            onClick={() => singleSelected && setRenameEntry(singleSelected)}
          >
            Rename
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<FontAwesomeIcon icon={faArrowRightArrowLeft} />}
            disabled={!singleSelected}
            onClick={() => singleSelected && setMoveEntry(singleSelected)}
          >
            Move
          </Button>
          <Button
            size="small"
            color="error"
            startIcon={<FontAwesomeIcon icon={faTrash} />}
            onClick={handleBulkDelete}
          >
            Delete
          </Button>
          <IconButton
            aria-label="Clear selection"
            onClick={clearSelection}
            sx={{ ml: 'auto' }}
          >
            <FontAwesomeIcon icon={faXmark} />
          </IconButton>
        </Paper>
      )}

      <Box
        position="relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Breadcrumbs trail={trail} onNavigate={navigateTo} />

        {entriesError && <ErrorNotice error={entriesError} onRetry={reload} />}

        {entriesLoading ? (
          <Paper
            elevation={0}
            sx={{ p: 2 }}
            data-testid="entries-loading"
            aria-label="Loading entries"
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} variant="rectangular" height={48} sx={{ mb: 1 }} />
            ))}
          </Paper>
        ) : entries.length === 0 ? (
          <Box
            data-testid="empty-state"
            sx={{
              background: gradients.violet,
              borderRadius: '30px',
              p: 8,
              mt: 3,
              textAlign: 'center',
              maxWidth: 560,
              mx: 'auto',
            }}
          >
            <FontAwesomeIcon
              icon={faFolderOpen}
              size="4x"
              color="#FFFFFF"
              aria-hidden="true"
            />
            <Typography variant="h2" sx={{ mt: 3, color: '#FFFFFF' }}>
              This folder is empty
            </Typography>
            <Typography
              variant="caption"
              component="p"
              sx={{ mt: 1, mb: 3, color: 'rgba(255,255,255,0.85)' }}
            >
              Drag and drop files here, or use the buttons above.
            </Typography>
            <Button
              variant="outlined"
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              sx={{
                bgcolor: 'rgba(255,255,255,0.14)',
                borderColor: 'rgba(255,255,255,0.35)',
                color: '#FFFFFF',
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.22)',
                  borderColor: 'rgba(255,255,255,0.35)',
                },
              }}
            >
              Upload your first file
            </Button>
          </Box>
        ) : isDesktop ? (
          view === 'grid' ? (
            <EntryGrid
              entries={entries}
              actions={actions}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
            />
          ) : (
            <EntryTable
              entries={entries}
              sort={sort}
              direction={direction}
              onSort={handleSort}
              actions={actions}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
            />
          )
        ) : (
          <EntryCards entries={entries} actions={actions} />
        )}

        <DropOverlay active={dragging} dropCount={dropCount} />
      </Box>

      <UploadQueue jobs={uploads} onRetry={retryUpload} onRemove={removeUpload} />

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
      <PreviewDialog
        entry={previewEntry}
        onClose={() => setPreviewEntry(null)}
      />
      <Dialog
        open={deleteEntry !== null}
        onClose={() => setDeleteEntry(null)}
        TransitionComponent={DialogTransition}
      >
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
