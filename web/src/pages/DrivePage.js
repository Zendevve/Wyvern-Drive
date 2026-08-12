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
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Paper,
  Skeleton,
  Snackbar,
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
  faFolderTree,
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
import DropOverlay, { collectDroppedFiles } from '../components/DropOverlay';
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
import ScreenLoader from '../components/ScreenLoader';
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

/**
 * Materialize an <input webkitdirectory> selection into upload pairs. The
 * picker returns a flat FileList where each file carries its position in
 * webkitRelativePath ("folder/sub/file.txt"); this creates the folder chain
 * on the server (once per folder, via a path cache) and resolves each file
 * to the folder id it belongs in.
 */
async function materializeFolderPicker(files, rootParentId) {
  const folderIds = new Map(); // relative dir path -> created folder id
  const pairs = [];
  for (const file of files) {
    const relativePath = String(file.webkitRelativePath || file.name);
    const parts = relativePath.split('/').filter(Boolean);
    const dirParts = parts.slice(0, -1);
    let parentId = rootParentId;
    if (dirParts.length > 0) {
      const fullKey = dirParts.join('/');
      if (!folderIds.has(fullKey)) {
        let currentParent = rootParentId;
        let currentKey = '';
        for (const part of dirParts) {
          currentKey = currentKey ? `${currentKey}/${part}` : part;
          if (!folderIds.has(currentKey)) {
            const folder = await api.createFolder(currentParent, part);
            folderIds.set(currentKey, folder.id);
          }
          currentParent = folderIds.get(currentKey);
        }
      }
      parentId = folderIds.get(fullKey);
    }
    pairs.push({ file, parentId });
  }
  return pairs;
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
  const folderInputRef = useRef(null);

  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [renameEntry, setRenameEntry] = useState(null);
  const [moveEntry, setMoveEntry] = useState(null);
  const [copyEntry, setCopyEntry] = useState(null);
  const [deletedEntries, setDeletedEntries] = useState([]);
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
  // One-time first-run tip: shown only while the drive root is empty and the
  // user has not dismissed it. Auto-hides once the drive has entries.
  const [dragHintDismissed, setDragHintDismissed] = useState(() => {
    try {
      return localStorage.getItem('wyvern-drag-hint-dismissed') === '1';
    } catch {
      return false;
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

  const dismissDragHint = useCallback(() => {
    setDragHintDismissed(true);
    try {
      localStorage.setItem('wyvern-drag-hint-dismissed', '1');
    } catch {
      // Storage may be unavailable; the hint stays dismissed for this session.
    }
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
      // Folder-upload jobs carry an explicit parentId; plain uploads target
      // the folder the user is currently viewing.
      const parentId = job.parentId == null ? currentParentId : job.parentId;
      try {
        const upload = uploadFile({
          parentId,
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
        // Expose the XHR abort handle on the queued job so the queue's
        // Cancel control can stop the request in flight.
        setUploads((prev) =>
          prev.map((j) =>
            j.id === jobId ? { ...j, abort: upload.abort } : j
          )
        );
        const entry = await upload;
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
            j.id === jobId
              ? err && err.code === 'ABORTED'
                ? j // cancelled from the queue; the removal flow cleans up
                : { ...j, status: 'failed', error: err }
              : j
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

  // `pairs` are { file, parentId } uploads; a null/undefined parentId means
  // "the folder the user is currently viewing" at upload time.
  const enqueueJobPairs = useCallback(
    (pairs) => {
      if (!pairs || pairs.length === 0) {
        return;
      }
      const jobs = pairs.map(({ file, parentId }) => ({
        id: nextJobId++,
        file,
        parentId: parentId == null ? undefined : parentId,
        uploadToken: newUploadToken(),
        abort: null, // attached by runUpload once the XHR exists
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

  const enqueueFiles = useCallback(
    (files) => {
      if (!files || files.length === 0) {
        return;
      }
      enqueueJobPairs(
        Array.from(files).map((file) => ({ file, parentId: undefined }))
      );
    },
    [enqueueJobPairs]
  );

  const handleFilesSelected = useCallback(
    (event) => {
      enqueueFiles(Array.from(event.target.files || []));
      event.target.value = '';
    },
    [enqueueFiles]
  );

  const handleFolderSelected = useCallback(
    async (event) => {
      const files = Array.from(event.target.files || []);
      event.target.value = '';
      if (files.length === 0) {
        return;
      }
      try {
        const pairs = await materializeFolderPicker(files, currentParentId);
        enqueueJobPairs(pairs);
      } catch (err) {
        setNotice(err);
      }
    },
    [currentParentId, enqueueJobPairs]
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

  // Copy is instant server-side (chunk rows reference existing blocks), so
  // the duplicate appears immediately and quota grows by the copied bytes.
  // The target folder comes from the copy dialog (defaults to the current
  // parent, which reproduces the old one-click duplicate-in-place behavior).
  const handleCopy = useCallback(
    async (entry, targetParentId) => {
      const ok = await runMutation(() =>
        api.copyEntry(entry.id, targetParentId)
      );
      if (ok) {
        await reload();
        await refreshQuota();
      }
      return ok;
    },
    [runMutation, reload, refreshQuota]
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
      setDeletedEntries((prev) => [...prev, entry]);
    }
  }, [deleteEntry, runMutation, reload, refreshQuota, clearSelection]);

  // Undo from the "Moved to Trash" snackbar: restore every queued entry
  // straight back to its original parent and refresh. Failures are
  // swallowed — the Trash page remains the authoritative recovery path.
  const handleUndoDelete = useCallback(async () => {
    if (deletedEntries.length === 0) {
      return;
    }
    const entries = deletedEntries;
    setDeletedEntries([]);
    await Promise.all(
      entries.map(async (entry) => {
        try {
          await api.trash.restore(entry.id);
        } catch {
          // Best-effort restore from the snackbar.
        }
      })
    );
    await reload();
    await refreshQuota();
  }, [deletedEntries, reload, refreshQuota]);

  const actions = useMemo(
    () => ({
      onOpenFolder: openFolder,
      onShare: setShareEntry,
      onRename: setRenameEntry,
      onMove: setMoveEntry,
      onCopy: setCopyEntry,
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
    async (event) => {
      event.preventDefault();
      setDragging(false);
      try {
        // Folder drops are walked as trees (folders created server-side as
        // the walk descends); plain file drops fall back to the flat list.
        const pairs = await collectDroppedFiles(
          event.dataTransfer,
          api.createFolder,
          currentParentId
        );
        if (pairs.length > 0) {
          enqueueJobPairs(pairs);
          setDropCount((c) => c + 1);
        }
      } catch (err) {
        setNotice(err);
      }
    },
    [currentParentId, enqueueJobPairs]
  );

  if (loading) {
    return <ScreenLoader />;
  }

  if (!user) {
    return null; // AuthProvider redirects to /login.
  }

  return (
    <AppShell title="Drive">
      {/* Bottom padding keeps the fixed transfer console from covering the
          last rows of the manifest, especially on small screens. */}
      <Box sx={{ pb: { xs: 12, md: 2 } }}>
      {notice && <ErrorNotice error={notice} onRetry={reload} />}

      {/* Command row: search spans the primary column; the white Upload pill
          leads, charcoal secondary pills follow; the circular view toggle
          and quota cell sit in utility slots. Below 768px the search stacks
          full-width and the actions wrap without horizontal overflow. */}
      <Box
        component="section"
        aria-label="Drive commands"
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
          disabled={entriesLoading}
          sx={{
            flexGrow: 1,
            minWidth: 220,
          }}
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
          startIcon={<FontAwesomeIcon icon={faFolderTree} />}
          onClick={() => folderInputRef.current && folderInputRef.current.click()}
          disabled={entriesLoading}
        >
          Upload folder
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
        <input
          ref={folderInputRef}
          type="file"
          multiple
          webkitdirectory=""
          directory=""
          hidden
          data-testid="folder-input"
          onChange={handleFolderSelected}
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
          <Typography
            variant="caption"
            component="span"
            sx={{ color: 'ink', whiteSpace: 'nowrap', mr: 1 }}
          >
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
            sx={{ ml: 'auto', width: 40, height: 40, borderRadius: '50%' }}
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

        {search && (
          <Typography
            variant="h6"
            sx={{ fontWeight: 600, mb: 1 }}
            data-testid="search-results-header"
          >
            Search results for &quot;{search}&quot;
          </Typography>
        )}

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
          <>
            {trail.length === 0 && !dragHintDismissed && (
              <Paper
                elevation={0}
                variant="outlined"
                data-testid="drag-drop-hint"
                sx={{
                  mt: 3,
                  mx: 'auto',
                  maxWidth: 560,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 2,
                  py: 1.5,
                  bgcolor: 'surface1',
                  borderColor: 'hairline',
                }}
              >
                <Typography variant="body2" sx={{ flexGrow: 1, color: 'inkMuted' }}>
                  Tip: drag files anywhere on the page to upload
                </Typography>
                <IconButton
                  aria-label="Dismiss tip"
                  size="small"
                  onClick={dismissDragHint}
                >
                  <FontAwesomeIcon icon={faXmark} />
                </IconButton>
              </Paper>
            )}
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
                Your space is ready
              </Typography>
              <Typography
                variant="caption"
                component="p"
                sx={{ mt: 1, mb: 3, color: 'rgba(255,255,255,0.85)' }}
              >
                Your files are encrypted before they&apos;re stored — only
                you can see them.
              </Typography>
              <Button
                variant="contained"
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.14)',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255,255,255,0.35)',
                  borderRadius: '100px',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.22)',
                  },
                }}
              >
                Upload your first file
              </Button>
            </Box>
          </>
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
        mode="move"
        currentParentId={moveEntry ? moveEntry.parentId : null}
        onClose={() => setMoveEntry(null)}
        onMove={handleMove}
      />
      <MoveDialog
        open={copyEntry !== null}
        entry={copyEntry}
        mode="copy"
        currentParentId={copyEntry ? currentParentId : null}
        onClose={() => setCopyEntry(null)}
        onMove={handleCopy}
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
              ? 'This folder and everything inside it will be moved to trash. You can restore it from the Trash page.'
              : 'This file will be moved to trash. You can restore it from the Trash page.'}
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
      <Snackbar
        open={deletedEntries.length > 0}
        autoHideDuration={5000}
        onClose={() => setDeletedEntries([])}
        message={`Moved ${deletedEntries.length} item${deletedEntries.length > 1 ? 's' : ''} to Trash`}
        action={
          <Button
            color="secondary"
            size="small"
            onClick={handleUndoDelete}
            data-testid="undo-delete"
          >
            Undo
          </Button>
        }
        data-testid="delete-snackbar"
      />
      </Box>
    </AppShell>
  );
}
