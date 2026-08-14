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
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowRightArrowLeft,
  faCircleInfo,
  faCloudArrowUp,
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
import FolderCards from '../components/FolderCards';
import ErrorNotice from '../components/ErrorNotice';
import FolderDialog from '../components/FolderDialog';
import MoveDialog from '../components/MoveDialog';
import PreviewDialog from '../components/PreviewDialog';
import ShareDialog from '../components/ShareDialog';
import FileDetailsPanel from '../components/FileDetailsPanel';
import ContextMenu from '../components/ContextMenu';
import { useMediaPlayer } from '../components/MediaPlayerProvider';
import {
  api,
  archiveUrl,
  downloadUrl,
} from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { useUploads } from '../upload/UploadProvider';
import DialogTransition from '../motion/DialogTransition';
import ScreenLoader from '../components/ScreenLoader';

const DRAG_HINT_KEY = 'wyvern-drag-hint-dismissed';

async function materializeFolderPicker(files, rootParentId) {
  const folderIds = new Map();
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

  const [trail, setTrail] = useState([]);
  const [entries, setEntries] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [entriesError, setEntriesError] = useState(null);
  const [notice, setNotice] = useState(null);

  const [dragHintDismissed, setDragHintDismissed] = useState(() => {
    try {
      return localStorage.getItem(DRAG_HINT_KEY) === '1';
    } catch {
      return false;
    }
  });

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('name');
  const [direction, setDirection] = useState('asc');

  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const searchInputRef = useRef(null);

  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [renameEntry, setRenameEntry] = useState(null);
  const [moveEntry, setMoveEntry] = useState(null);
  const [copyEntry, setCopyEntry] = useState(null);
  const [deletedEntries, setDeletedEntries] = useState([]);
  const [deleteEntry, setDeleteEntry] = useState(null);
  const [shareEntry, setShareEntry] = useState(null);
  const [previewEntry, setPreviewEntry] = useState(null);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const { playTrack } = useMediaPlayer();

  const [view, setView] = useState(() => {
    try {
      return localStorage.getItem('wyvern.view') === 'grid' ? 'grid' : 'list';
    } catch {
      return 'list';
    }
  });

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [dragging, setDragging] = useState(false);

  const currentFolder = trail.length > 0 ? trail[trail.length - 1] : null;
  const currentParentId = currentFolder ? currentFolder.id : null;

  const { enqueueJobPairs, subscribe } = useUploads();

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

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
        if (mountedRef.current) {
          setEntries(data.entries || []);
        }
      } catch (err) {
        if (mountedRef.current) {
          setEntriesError(err);
          setEntries([]);
        }
      } finally {
        if (mountedRef.current) {
          setEntriesLoading(false);
        }
      }
    },
    []
  );

  const reload = useCallback(() => {
    return loadEntries(currentParentId, search, sort, direction);
  }, [currentParentId, search, sort, direction, loadEntries]);

  useEffect(() => {
    loadEntries(currentParentId, search, sort, direction);
  }, [currentParentId, search, sort, direction, loadEntries]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    const unsubscribe = subscribe((event) => {
      if (event.type === 'job-complete' || event.type === 'job-failed') {
        reload();
        refresh();
      }
    });
    return () => unsubscribe();
  }, [subscribe, reload, refresh]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [currentParentId, search]);

  const handleSort = (field) => {
    if (sort === field) {
      setDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(field);
      setDirection('asc');
    }
  };

  const navigateTo = (folderId) => {
    if (folderId === null) {
      setTrail([]);
      return;
    }
    const index = trail.findIndex((f) => f.id === folderId);
    if (index !== -1) {
      setTrail(trail.slice(0, index + 1));
    }
  };

  const openFolder = useCallback((folder) => {
    setTrail((prev) => [...prev, { id: folder.id, name: folder.name }]);
  }, []);

  const handleFilesSelected = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const pairs = files.map((file) => ({ file, parentId: currentParentId }));
      enqueueJobPairs(pairs);
    }
    e.target.value = '';
  };

  const handleFolderSelected = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      try {
        const pairs = await materializeFolderPicker(files, currentParentId);
        if (pairs.length > 0) {
          enqueueJobPairs(pairs);
        }
      } catch (err) {
        setNotice(err);
      }
    }
    e.target.value = '';
  };

  const handleDismissDragHint = () => {
    setDragHintDismissed(true);
    try {
      localStorage.setItem(DRAG_HINT_KEY, '1');
    } catch {
      // ignore
    }
  };

  const toggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const toggleSelectAll = useCallback((ids, selectAll) => {
    if (selectAll) {
      setSelectedIds(new Set(ids));
    } else {
      setSelectedIds(new Set());
    }
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const selectedEntries = useMemo(() => {
    return entries.filter((entry) => selectedIds.has(entry.id));
  }, [entries, selectedIds]);

  const singleSelected = selectedEntries.length === 1 ? selectedEntries[0] : null;
  const singleSelectedFile =
    singleSelected && singleSelected.kind !== 'folder' ? singleSelected : null;
  const singleSelectedFolder =
    singleSelected && singleSelected.kind === 'folder' ? singleSelected : null;

  const folderEntries = useMemo(() => entries.filter((e) => e.kind === 'folder'), [entries]);
  const fileEntries = useMemo(() => entries.filter((e) => e.kind !== 'folder'), [entries]);

  const handleCreateFolder = async (name) => {
    try {
      await api.createFolder(currentParentId, name);
      setFolderDialogOpen(false);
      reload();
    } catch (err) {
      setNotice(err);
      throw err;
    }
  };

  const handleRename = async (name) => {
    if (!renameEntry) return;
    try {
      await api.updateEntry(renameEntry.id, { name });
      setRenameEntry(null);
      reload();
    } catch (err) {
      setNotice(err);
      throw err;
    }
  };

  const handleMove = async (entry, targetParentId) => {
    try {
      await api.updateEntry(entry.id, { parentId: targetParentId });
      setMoveEntry(null);
      reload();
    } catch (err) {
      setNotice(err);
      throw err;
    }
  };

  const handleCopy = async (entry, targetParentId) => {
    try {
      await api.copyEntry(entry.id, targetParentId);
      setCopyEntry(null);
      reload();
      refresh();
    } catch (err) {
      setNotice(err);
      throw err;
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteEntry) return;
    try {
      await api.deleteEntry(deleteEntry.id);
      setDeletedEntries([deleteEntry]);
      setDeleteEntry(null);
      reload();
      refresh();
    } catch (err) {
      setNotice(err);
    }
  };

  const handleBulkDelete = useCallback(async () => {
    const toDelete = selectedEntries;
    if (toDelete.length === 0) return;
    try {
      for (const item of toDelete) {
        await api.deleteEntry(item.id);
      }
      setDeletedEntries(toDelete);
      setSelectedIds(new Set());
      reload();
      refresh();
    } catch (err) {
      setNotice(err);
    }
  }, [selectedEntries, reload, refresh]);

  const handleUndoDelete = async () => {
    if (deletedEntries.length === 0) return;
    try {
      for (const item of deletedEntries) {
        await api.trash.restore(item.id);
      }
      setDeletedEntries([]);
      reload();
      refresh();
    } catch (err) {
      setNotice(err);
    }
  };

  const actions = useMemo(
    () => ({
      onOpenFolder: openFolder,
      onPreview: setPreviewEntry,
      onShare: setShareEntry,
      onRename: setRenameEntry,
      onMove: setMoveEntry,
      onCopy: setCopyEntry,
      onDelete: setDeleteEntry,
    }),
    [openFolder]
  );

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (event) => {
      event.preventDefault();
      event.stopPropagation();
      setDragging(false);
      try {
        const pairs = await collectDroppedFiles(
          event.dataTransfer,
          api.createFolder,
          currentParentId
        );
        if (pairs.length > 0) {
          enqueueJobPairs(pairs);
        }
      } catch (err) {
        setNotice(err);
      }
    },
    [currentParentId, enqueueJobPairs]
  );

  const handleItemContextMenu = useCallback((event, entry) => {
    event.preventDefault();
    event.stopPropagation();
    if (!selectedIds.has(entry.id)) {
      setSelectedIds(new Set([entry.id]));
    }
    setContextMenu({
      mouseX: event.clientX + 2,
      mouseY: event.clientY - 6,
      entry,
      isCanvas: false,
    });
  }, [selectedIds]);

  const handleCanvasContextMenu = useCallback((event) => {
    const isDirect =
      event.target === event.currentTarget ||
      event.target.getAttribute('data-testid') === 'drive-content-pane' ||
      event.target.getAttribute('data-testid') === 'entry-grid';
    if (isDirect) {
      event.preventDefault();
      setContextMenu({
        mouseX: event.clientX + 2,
        mouseY: event.clientY - 6,
        entry: null,
        isCanvas: true,
      });
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'TEXTAREA' ||
        e.target.isContentEditable ||
        previewEntry !== null ||
        folderDialogOpen ||
        renameEntry !== null ||
        moveEntry !== null ||
        copyEntry !== null ||
        shareEntry !== null ||
        deleteEntry !== null
      ) {
        return;
      }

      if (e.key === ' ' || e.code === 'Space') {
        if (singleSelectedFile) {
          e.preventDefault();
          setPreviewEntry(singleSelectedFile);
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.size > 0) {
          e.preventDefault();
          if (singleSelected) {
            setDeleteEntry(singleSelected);
          } else {
            handleBulkDelete();
          }
        }
      } else if (e.key === 'F2') {
        if (singleSelected) {
          e.preventDefault();
          setRenameEntry(singleSelected);
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        toggleSelectAll(entries.map((item) => item.id), true);
      } else if (e.altKey && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault();
        setDetailsOpen((prev) => !prev);
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      } else if (e.key === 'Escape') {
        if (contextMenu) {
          setContextMenu(null);
        } else if (selectedIds.size > 0) {
          clearSelection();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    singleSelected,
    singleSelectedFile,
    selectedIds,
    entries,
    previewEntry,
    folderDialogOpen,
    renameEntry,
    moveEntry,
    copyEntry,
    shareEntry,
    deleteEntry,
    contextMenu,
    handleBulkDelete,
    toggleSelectAll,
    clearSelection,
  ]);

  if (loading) {
    return <ScreenLoader />;
  }

  if (!user) {
    return null;
  }

  const searchElement = (
    <TextField
      size="small"
      placeholder="Search files and folders..."
      value={searchInput}
      inputRef={searchInputRef}
      onChange={(e) => setSearchInput(e.target.value)}
      disabled={entriesLoading}
      fullWidth
      inputProps={{ 'aria-label': 'Search files and folders' }}
      InputProps={{
        startAdornment: (
          <Box
            component="span"
            sx={{ color: 'text.disabled', display: 'inline-flex', mr: 1, fontSize: 13 }}
          >
            <FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden="true" />
          </Box>
        ),
        endAdornment: searchInput ? (
          <IconButton size="small" onClick={() => setSearchInput('')} sx={{ p: 0.25 }}>
            <FontAwesomeIcon icon={faXmark} size="xs" />
          </IconButton>
        ) : null,
      }}
      sx={{
        '& .MuiOutlinedInput-root': {
          bgcolor: 'surface1',
          height: 38,
          borderRadius: 9999,
          border: '1px solid',
          borderColor: 'divider',
          '&:hover': { borderColor: 'primary.main' },
        },
      }}
    />
  );

  return (
    <AppShell
      title="Drive"
      searchSlot={searchElement}
      onUploadFiles={() => fileInputRef.current && fileInputRef.current.click()}
      onUploadFolder={() => folderInputRef.current && folderInputRef.current.click()}
      onNewFolder={() => setFolderDialogOpen(true)}
    >
      <Box sx={{ pb: { xs: 12, md: 2 } }}>
        {notice && <ErrorNotice error={notice} onRetry={reload} />}

        {/* Directory Sub-Header Toolbar (Breadcrumbs + Controls) */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1.5,
            mb: 2.5,
            pb: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          {/* Breadcrumbs Navigation */}
          <Breadcrumbs trail={trail} onNavigate={navigateTo} />

          {/* Directory Toolbar Actions */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 'auto' }}>
            {/* Quick Action Buttons for Toolbar */}
            <Button
              variant="outlined"
              size="small"
              startIcon={<FontAwesomeIcon icon={faUpload} size="xs" />}
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              sx={{ display: { xs: 'none', md: 'inline-flex' }, borderRadius: 2 }}
            >
              Upload files
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<FontAwesomeIcon icon={faFolderTree} size="xs" />}
              onClick={() => folderInputRef.current && folderInputRef.current.click()}
              sx={{ display: { xs: 'none', md: 'inline-flex' }, borderRadius: 2 }}
            >
              Upload folder
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<FontAwesomeIcon icon={faFolderPlus} size="xs" />}
              onClick={() => setFolderDialogOpen(true)}
              sx={{ display: { xs: 'none', md: 'inline-flex' }, borderRadius: 2 }}
            >
              New folder
            </Button>

            {/* View Switchers */}
            {isDesktop && (
              <Box
                sx={{
                  display: 'inline-flex',
                  bgcolor: 'surface1',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  p: 0.25,
                }}
              >
                <IconButton
                  aria-label="List view"
                  aria-pressed={view === 'list'}
                  onClick={() => setView('list')}
                  size="small"
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: 1.5,
                    color: view === 'list' ? 'primary.main' : 'text.disabled',
                    bgcolor: view === 'list' ? 'surface2' : 'transparent',
                    boxShadow: view === 'list' ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
                  }}
                >
                  <FontAwesomeIcon icon={faTableList} size="xs" />
                </IconButton>
                <IconButton
                  aria-label="Grid view"
                  aria-pressed={view === 'grid'}
                  onClick={() => setView('grid')}
                  size="small"
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: 1.5,
                    color: view === 'grid' ? 'primary.main' : 'text.disabled',
                    bgcolor: view === 'grid' ? 'surface2' : 'transparent',
                    boxShadow: view === 'grid' ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
                  }}
                >
                  <FontAwesomeIcon icon={faTableCellsLarge} size="xs" />
                </IconButton>
              </Box>
            )}

            {/* Inspector Toggle Button */}
            {isDesktop && (
              <Tooltip title={detailsOpen ? "Hide file details (Alt+I)" : "View file details (Alt+I)"}>
                <IconButton
                  aria-label="Toggle details panel"
                  aria-pressed={detailsOpen}
                  onClick={() => setDetailsOpen(!detailsOpen)}
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 2,
                    bgcolor: detailsOpen ? 'rgba(37, 172, 232, 0.15)' : 'surface1',
                    color: detailsOpen ? 'primary.main' : 'text.disabled',
                    border: '1px solid',
                    borderColor: detailsOpen ? 'rgba(37, 172, 232, 0.4)' : 'divider',
                  }}
                >
                  <FontAwesomeIcon icon={faCircleInfo} size="sm" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        {/* Drag & Drop Hint Banner (if applicable) */}
        {!dragHintDismissed && entries.length === 0 && trail.length === 0 && !search && (
          <Paper
            variant="outlined"
            data-testid="drag-drop-hint"
            sx={{
              p: 1.5,
              mb: 2,
              borderRadius: 2,
              bgcolor: 'rgba(37, 172, 232, 0.08)',
              borderColor: 'rgba(37, 172, 232, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <FontAwesomeIcon icon={faCloudArrowUp} style={{ color: '#25ACE8', fontSize: 14 }} />
              <Typography variant="body2" sx={{ color: 'text.primary', fontSize: 13 }}>
                Tip: drag files anywhere on the page to upload
              </Typography>
            </Box>
            <IconButton
              size="small"
              aria-label="Dismiss tip"
              onClick={handleDismissDragHint}
              sx={{ color: 'text.disabled', '&:hover': { color: 'text.primary' } }}
            >
              <FontAwesomeIcon icon={faXmark} size="xs" />
            </IconButton>
          </Paper>
        )}

        {/* Search Results Header */}
        {search && (
          <Typography
            variant="h6"
            sx={{ fontWeight: 600, mb: 2, color: 'text.primary', fontSize: 15 }}
            data-testid="search-results-header"
          >
            Search results for &quot;{search}&quot;
          </Typography>
        )}

        {/* Contextual Selection Action Bar */}
        {isDesktop && selectedIds.size > 0 && (
          <Paper
            elevation={0}
            data-testid="selection-bar"
            sx={{
              bgcolor: 'surfaceElevated',
              border: '1px solid',
              borderColor: 'primary.main',
              borderRadius: 2.5,
              px: 2.5,
              py: 1,
              mb: 2.5,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1.5,
              alignItems: 'center',
              boxShadow: '0 8px 24px rgba(0,0,0,0.6), 0 0 12px rgba(37, 172, 232, 0.2)',
            }}
          >
            <Typography
              variant="body2"
              component="span"
              sx={{ color: 'primary.main', whiteSpace: 'nowrap', mr: 1, fontWeight: 600, fontSize: 13 }}
            >
              {selectedIds.size} selected
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<FontAwesomeIcon icon={faDownload} size="xs" />}
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
              startIcon={<FontAwesomeIcon icon={faShareNodes} size="xs" />}
              disabled={!singleSelectedFile}
              onClick={() => singleSelectedFile && setShareEntry(singleSelectedFile)}
            >
              Share
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<FontAwesomeIcon icon={faPen} size="xs" />}
              disabled={!singleSelected}
              onClick={() => singleSelected && setRenameEntry(singleSelected)}
            >
              Rename
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<FontAwesomeIcon icon={faArrowRightArrowLeft} size="xs" />}
              disabled={!singleSelected}
              onClick={() => singleSelected && setMoveEntry(singleSelected)}
            >
              Move
            </Button>
            <Button
              size="small"
              color="error"
              variant="outlined"
              startIcon={<FontAwesomeIcon icon={faTrash} size="xs" />}
              onClick={handleBulkDelete}
            >
              Delete
            </Button>
            <IconButton
              aria-label="Clear selection"
              size="small"
              onClick={clearSelection}
              sx={{ ml: 'auto', width: 28, height: 28, borderRadius: 1 }}
            >
              <FontAwesomeIcon icon={faXmark} size="xs" />
            </IconButton>
          </Paper>
        )}

        {/* Main 2-Pane Content Area: File Explorer + Optional Right Inspector */}
        <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
          <Box
            data-testid="drive-content-pane"
            sx={{ flexGrow: 1, minWidth: 0, position: 'relative' }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onContextMenu={handleCanvasContextMenu}
          >
            {dragging && (
              <DropOverlay
                active={dragging}
                onDrop={handleDrop}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
              />
            )}

            {entriesError && <ErrorNotice error={entriesError} onRetry={reload} />}

            {entriesLoading ? (
              <Paper
                elevation={0}
                variant="outlined"
                sx={{ p: 2, bgcolor: 'surface1', borderColor: 'divider', borderRadius: 2 }}
                data-testid="entries-loading"
                aria-label="Loading entries"
              >
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} variant="rectangular" height={40} sx={{ mb: 1, borderRadius: 1 }} />
                ))}
              </Paper>
            ) : entries.length === 0 ? (
              <Paper
                elevation={0}
                variant="outlined"
                data-testid="empty-state"
                sx={{
                  p: { xs: 4, md: 6 },
                  bgcolor: 'surface1',
                  borderColor: 'divider',
                  borderRadius: 3,
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  my: 3,
                  background: 'radial-gradient(ellipse at top, rgba(37, 172, 232, 0.1) 0%, rgba(22, 25, 33, 0.6) 70%)',
                  border: '1px solid rgba(37, 172, 232, 0.25)',
                }}
              >
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    bgcolor: 'rgba(37, 172, 232, 0.15)',
                    border: '1px solid rgba(37, 172, 232, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'primary.main',
                    boxShadow: '0 0 20px rgba(37, 172, 232, 0.25)',
                  }}
                >
                  <FontAwesomeIcon icon={faFolderOpen} style={{ fontSize: 24, color: '#FBBF24' }} />
                </Box>
                <Box sx={{ maxWidth: 460 }}>
                  <Typography variant="h5" component="h2" sx={{ fontWeight: 600, color: 'text.primary', mb: 1 }}>
                    {search ? 'No files found' : trail.length > 0 ? 'This folder is empty' : 'Your space is ready'}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
                    {search
                      ? `No entries matched your search "${search}".`
                      : "Your files are encrypted before they're stored — only you can see them."}
                  </Typography>
                </Box>
                {!search && (
                  <Button
                    variant="contained"
                    color="primary"
                    size="medium"
                    startIcon={<FontAwesomeIcon icon={faUpload} size="sm" />}
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                    sx={{
                      mt: 1,
                      px: 3,
                      py: 1,
                      borderRadius: 9999,
                      boxShadow: '0 4px 16px rgba(37, 172, 232, 0.35)',
                    }}
                  >
                    Upload your first file
                  </Button>
                )}
              </Paper>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* Folders Section */}
                {folderEntries.length > 0 && (
                  <FolderCards
                    folders={folderEntries}
                    onOpenFolder={openFolder}
                    onNewFolder={() => setFolderDialogOpen(true)}
                    onContextMenu={handleItemContextMenu}
                  />
                )}

                {/* Files Section */}
                <Box>
                  {folderEntries.length > 0 && (
                    <Typography
                      variant="overline"
                      sx={{ color: 'text.disabled', fontSize: 11, letterSpacing: '0.06em', mb: 1, display: 'block' }}
                    >
                      Files ({fileEntries.length})
                    </Typography>
                  )}

                  {!isDesktop ? (
                    <EntryCards
                      entries={entries}
                      actions={actions}
                      selectedIds={selectedIds}
                      onToggleSelect={toggleSelect}
                      onContextMenu={handleItemContextMenu}
                    />
                  ) : view === 'grid' ? (
                    <EntryGrid
                      entries={entries}
                      actions={actions}
                      selectedIds={selectedIds}
                      onToggleSelect={toggleSelect}
                      onContextMenu={handleItemContextMenu}
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
                      onContextMenu={handleItemContextMenu}
                    />
                  )}
                </Box>
              </Box>
            )}
          </Box>

          {/* Right Inspector / Details Panel */}
          {isDesktop && detailsOpen && (
            <FileDetailsPanel
              open={detailsOpen}
              onClose={() => setDetailsOpen(false)}
              selectedEntries={selectedEntries}
              currentFolder={currentFolder}
              drive={drive}
              actions={actions}
              onPreview={setPreviewEntry}
              onPlayTrack={playTrack}
            />
          )}
        </Box>

        {/* Hidden File / Folder Inputs */}
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

      {/* Floating Context Menu */}
      <ContextMenu
        contextMenu={contextMenu}
        onClose={() => setContextMenu(null)}
        onUploadFiles={() => fileInputRef.current && fileInputRef.current.click()}
        onUploadFolder={() => folderInputRef.current && folderInputRef.current.click()}
        onNewFolder={() => setFolderDialogOpen(true)}
        onOpenFolder={openFolder}
        onPreview={setPreviewEntry}
        onPlayTrack={playTrack}
        onShare={setShareEntry}
        onRename={setRenameEntry}
        onMove={setMoveEntry}
        onCopy={setCopyEntry}
        onDelete={setDeleteEntry}
        onShowDetails={() => setDetailsOpen(true)}
      />

      {/* QuickLook Previewer Dialog */}
      <PreviewDialog
        entry={previewEntry}
        allEntries={entries}
        onClose={() => setPreviewEntry(null)}
        onNavigate={(nextEntry) => setPreviewEntry(nextEntry)}
        onPlayTrack={playTrack}
        onShare={setShareEntry}
      />

      {/* Create Folder Dialog */}
      <FolderDialog
        open={folderDialogOpen}
        onClose={() => setFolderDialogOpen(false)}
        onSubmit={handleCreateFolder}
      />

      {/* Rename Dialog */}
      <FolderDialog
        open={renameEntry !== null}
        title="Rename"
        description="Enter a new name for this entry."
        label="Name"
        initialName={renameEntry ? renameEntry.name : ''}
        confirmLabel="Rename"
        onClose={() => setRenameEntry(null)}
        onSubmit={handleRename}
      />

      {/* Move Dialog */}
      <MoveDialog
        open={moveEntry !== null}
        entry={moveEntry}
        currentParentId={moveEntry ? moveEntry.parentId : currentParentId}
        onClose={() => setMoveEntry(null)}
        onMove={handleMove}
      />

      {/* Copy Dialog */}
      <MoveDialog
        open={copyEntry !== null}
        entry={copyEntry}
        currentParentId={copyEntry ? copyEntry.parentId : currentParentId}
        mode="copy"
        onClose={() => setCopyEntry(null)}
        onMove={handleCopy}
      />

      {/* Share Dialog */}
      <ShareDialog
        open={shareEntry !== null}
        entry={shareEntry}
        onClose={() => setShareEntry(null)}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteEntry !== null}
        TransitionComponent={DialogTransition}
        onClose={() => setDeleteEntry(null)}
        aria-labelledby="delete-dialog-title"
      >
        <DialogTitle id="delete-dialog-title">
          Move {deleteEntry && deleteEntry.name} to Trash?
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'text.secondary' }}>
            {deleteEntry && deleteEntry.kind === 'folder'
              ? 'This folder and all nested entries will be moved to trash.'
              : 'This file will be moved to trash and can be restored later.'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteEntry(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            data-testid="confirm-delete"
            onClick={handleDeleteConfirmed}
          >
            Move to Trash
          </Button>
        </DialogActions>
      </Dialog>

      {/* Undo Delete Toast */}
      <Snackbar
        open={deletedEntries.length > 0}
        autoHideDuration={6000}
        onClose={() => setDeletedEntries([])}
        message={
          deletedEntries.length === 1
            ? `Moved "${deletedEntries[0].name}" to Trash`
            : `Moved ${deletedEntries.length} items to Trash`
        }
        action={
          <Button
            color="primary"
            size="small"
            data-testid="undo-delete"
            onClick={handleUndoDelete}
            sx={{ fontWeight: 600 }}
          >
            Undo
          </Button>
        }
      />
    </AppShell>
  );
}
