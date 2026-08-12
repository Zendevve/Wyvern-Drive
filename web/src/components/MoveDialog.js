import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronRight, faFolder } from '@fortawesome/free-solid-svg-icons';
import { useTheme } from '@mui/material/styles';
import { api } from '../api/client';
import DialogTransition from '../motion/DialogTransition';

const ROOT_KEY = 'root';

/**
 * Folder tree picker for moves and copies. Folders load lazily; the entry
 * itself and any discovered descendant folders are disabled as targets (the
 * server still enforces INVALID_MOVE/INVALID_COPY for self/descendant
 * targets). In copy mode the current parent stays selectable so a duplicate
 * can be created in place.
 */
export default function MoveDialog({
  open,
  entry,
  currentParentId,
  onClose,
  onMove,
  mode = 'move',
}) {
  const [folders, setFolders] = useState({});
  const [expanded, setExpanded] = useState(new Set());
  const [forbidden, setForbidden] = useState(new Set());
  const [targetId, setTargetId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const theme = useTheme();
  const keyOf = (id) => (id == null ? ROOT_KEY : id);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    setError(null);
    setBusy(false);
    setLoading(true);
    setExpanded(new Set([null])); // root (id null) starts expanded
    setForbidden(new Set([entry ? entry.id : -1]));
    setTargetId(currentParentId == null ? null : currentParentId);
    setFolders({
      [ROOT_KEY]: { id: null, name: 'Wyvern Drive', loaded: false, children: [] },
    });
    api
      .entries({ parentId: null, kind: 'folder', sort: 'name', direction: 'asc' })
      .then((data) => {
        if (cancelled) return;
        const children = ((data && data.entries) || []).map((e) => ({
          id: e.id,
          name: e.name,
          loaded: false,
          children: [],
        }));
        setFolders((prev) => ({
          ...prev,
          [ROOT_KEY]: {
            id: null,
            name: 'Wyvern Drive',
            loaded: true,
            children: children.map((c) => c.id),
          },
          ...Object.fromEntries(children.map((c) => [c.id, c])),
        }));
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, entry, currentParentId]);

  const loadChildren = async (node) => {
    const data = await api.entries({
      parentId: node.id,
      kind: 'folder',
      sort: 'name',
      direction: 'asc',
    });
    const children = ((data && data.entries) || []).map((e) => ({
      id: e.id,
      name: e.name,
      loaded: false,
      children: [],
    }));
    setFolders((prev) => ({
      ...prev,
      [keyOf(node.id)]: {
        ...(prev[keyOf(node.id)] || node),
        loaded: true,
        children: children.map((c) => c.id),
      },
      ...Object.fromEntries(children.map((c) => [c.id, c])),
    }));
    setForbidden((prevForbidden) => {
      if (prevForbidden.has(node.id)) {
        return new Set([...prevForbidden, ...children.map((c) => c.id)]);
      }
      return prevForbidden;
    });
  };

  const handleToggle = async (node) => {
    if (expanded.has(node.id)) {
      setExpanded((prev) => {
        const next = new Set(prev);
        next.delete(node.id);
        return next;
      });
      return;
    }
    setError(null);
    try {
      const current = folders[keyOf(node.id)];
      if (!current || !current.loaded) {
        await loadChildren(current || node);
      }
      setExpanded((prev) => new Set([...prev, node.id]));
    } catch (err) {
      setError(err);
    }
  };

  const handleSubmit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onMove(entry, targetId);
      onClose();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  const sameParent = targetId === (currentParentId == null ? null : currentParentId);
  // Moving to the entry's current parent is a no-op, so it's blocked in move
  // mode; copying there is a legitimate duplicate and stays enabled.
  const sameParentDisabled = mode === 'move' && sameParent;

  const renderNode = (node, depth) => {
    if (!node) {
      return null;
    }
    const isForbidden = forbidden.has(node.id);
    const isExpanded = expanded.has(node.id);
    const isSelected = targetId === node.id;
    const canExpand = !node.loaded || node.children.length > 0;
    return (
      <Box key={node.id == null ? 'root' : node.id}>
        <ListItemButton
          disabled={isForbidden}
          selected={isSelected}
          onClick={() => {
            if (!isForbidden) setTargetId(node.id);
          }}
          sx={{
            pl: 2 + depth * 3,
            borderRadius: '8px',
            opacity: isForbidden ? 0.4 : undefined,
            '&:hover:not(.Mui-selected)': { bgcolor: 'surface1' },
          }}
        >
          <IconButton
            size="small"
            edge="start"
            sx={{ mr: 0.5 }}
            onClick={(event) => {
              event.stopPropagation();
              handleToggle(node);
            }}
            disabled={!canExpand}
            aria-label={
              isExpanded ? `Collapse ${node.name}` : `Expand ${node.name}`
            }
          >
            <FontAwesomeIcon icon={isExpanded ? faChevronDown : faChevronRight} />
          </IconButton>
          <ListItemIcon sx={{ minWidth: 32 }}>
            <FontAwesomeIcon icon={faFolder} color={theme.palette.inkMuted} />
          </ListItemIcon>
          <ListItemText primary={node.name} />
          {isForbidden && (
            <Typography variant="caption" color="inkMuted">
              {mode === 'copy' ? 'Cannot copy here' : 'Cannot move here'}
            </Typography>
          )}
        </ListItemButton>
        {isExpanded &&
          node.children.map((childId) => renderNode(folders[keyOf(childId)], depth + 1))}
      </Box>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      TransitionComponent={DialogTransition}
    >
      <DialogTitle sx={{ borderBottom: '1px solid', borderColor: 'hairline' }}>
        {mode === 'copy' ? 'Copy' : 'Move'} {entry ? entry.name : ''}
      </DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error.message || String(error)}
          </Alert>
        )}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress size={28} aria-label="Loading folders" />
          </Box>
        ) : (
          renderNode(folders[ROOT_KEY], 0)
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={busy || sameParentDisabled}
          data-testid={mode === 'copy' ? 'copy-here' : 'move-here'}
        >
          {mode === 'copy' ? 'Copy here' : 'Move here'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
