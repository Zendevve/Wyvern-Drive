import React, { useState } from 'react';
import {
  AppBar,
  Box,
  Button,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBars,
  faChevronDown,
  faFolderOpen,
  faFolderPlus,
  faFolderTree,
  faGear,
  faPlus,
  faPowerOff,
  faShieldHalved,
  faTrashCan,
  faUpload,
} from '@fortawesome/free-solid-svg-icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import BrandLockup from './BrandLockup';
import QuotaMeter from './QuotaMeter';

const DRAWER_WIDTH = 240;
const HEADER_HEIGHT = 56;

/**
 * Cloud-Standard App Shell for Wyvern Drive
 */
export default function AppShell({
  title,
  searchSlot,
  onUploadFiles,
  onUploadFolder,
  onNewFolder,
  children,
}) {
  const { user, drive, refresh } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [newMenuAnchor, setNewMenuAnchor] = useState(null);

  const navItems = [
    { label: 'Drive', icon: faFolderOpen, to: '/drive' },
    { label: 'Trash', icon: faTrashCan, to: '/trash' },
    { label: 'Settings', icon: faGear, to: '/settings' },
  ];

  const go = (to) => {
    navigate(to);
    setMobileOpen(false);
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // Session may already be invalid; still clear local state below.
    }
    await refresh();
    navigate('/login', { replace: true });
  };

  const handleNewClick = (event) => {
    setNewMenuAnchor(event.currentTarget);
  };

  const handleNewClose = () => {
    setNewMenuAnchor(null);
  };

  const navContent = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: 'sidebar',
        p: 2,
        gap: 2,
      }}
    >
      {/* Mobile Brand Header */}
      {!isDesktop && (
        <Box sx={{ pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
          <BrandLockup />
        </Box>
      )}

      {/* Primary + New Action Button */}
      {(onUploadFiles || onUploadFolder || onNewFolder) && (
        <Box>
          <Button
            variant="contained"
            color="primary"
            fullWidth
            onClick={handleNewClick}
            startIcon={<FontAwesomeIcon icon={faPlus} style={{ fontSize: 13 }} />}
            endIcon={<FontAwesomeIcon icon={faChevronDown} style={{ fontSize: 10, marginLeft: 'auto' }} />}
            sx={{
              py: 1.25,
              px: 2,
              borderRadius: 3,
              fontWeight: 600,
              fontSize: 14,
              boxShadow: '0 4px 16px rgba(37, 172, 232, 0.3)',
              textTransform: 'none',
            }}
          >
            New
          </Button>
          <Menu
            anchorEl={newMenuAnchor}
            open={Boolean(newMenuAnchor)}
            onClose={handleNewClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            sx={{ mt: 1 }}
          >
            {onUploadFiles && (
              <MenuItem
                onClick={() => {
                  handleNewClose();
                  onUploadFiles();
                }}
              >
                <ListItemIcon sx={{ color: 'text.secondary', minWidth: 28 }}>
                  <FontAwesomeIcon icon={faUpload} size="sm" />
                </ListItemIcon>
                <ListItemText primary="Upload files" />
              </MenuItem>
            )}
            {onUploadFolder && (
              <MenuItem
                onClick={() => {
                  handleNewClose();
                  onUploadFolder();
                }}
              >
                <ListItemIcon sx={{ color: 'text.secondary', minWidth: 28 }}>
                  <FontAwesomeIcon icon={faFolderTree} size="sm" />
                </ListItemIcon>
                <ListItemText primary="Upload folder" />
              </MenuItem>
            )}
            {onNewFolder && (
              <MenuItem
                onClick={() => {
                  handleNewClose();
                  onNewFolder();
                }}
              >
                <ListItemIcon sx={{ color: 'text.secondary', minWidth: 28 }}>
                  <FontAwesomeIcon icon={faFolderPlus} size="sm" />
                </ListItemIcon>
                <ListItemText primary="New folder" />
              </MenuItem>
            )}
          </Menu>
        </Box>
      )}

      {/* Navigation List */}
      <List
        component="nav"
        aria-label="Navigation"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5,
          p: 0,
        }}
      >
        {navItems.map((item) => {
          const selected = location.pathname.startsWith(item.to);
          return (
            <ListItem key={item.to} disablePadding>
              <ListItemButton
                selected={selected}
                onClick={() => go(item.to)}
                aria-current={selected ? 'page' : undefined}
                sx={{
                  gap: 1.5,
                  minHeight: 40,
                  borderRadius: 2,
                  px: 1.75,
                  color: selected ? '#FFFFFF' : 'text.secondary',
                  fontWeight: selected ? 600 : 500,
                  bgcolor: selected ? 'rgba(37, 172, 232, 0.15)' : 'transparent',
                  border: '1px solid',
                  borderColor: selected ? 'rgba(37, 172, 232, 0.4)' : 'transparent',
                  transition: 'all 120ms ease',
                  '&:hover': {
                    bgcolor: selected ? 'rgba(37, 172, 232, 0.22)' : 'surface2',
                    color: 'text.primary',
                  },
                  '& .MuiListItemIcon-root': {
                    color: selected ? 'primary.main' : 'text.disabled',
                    minWidth: 20,
                    justifyContent: 'center',
                  },
                }}
              >
                <ListItemIcon>
                  <FontAwesomeIcon icon={item.icon} style={{ fontSize: 15 }} />
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: 13.5,
                    fontWeight: selected ? 600 : 500,
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Box sx={{ flexGrow: 1 }} />

      {/* Bottom Storage Meter */}
      {drive && (
        <Box
          sx={{
            p: 1.5,
            bgcolor: 'surface1',
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <QuotaMeter drive={drive} showIcon />
        </Box>
      )}

      {/* User Session Footer */}
      {user && (
        <Box
          sx={{
            p: 1.25,
            bgcolor: 'surface1',
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 7,
                  height: 7,
                  bgcolor: 'success.main',
                  borderRadius: '50%',
                  boxShadow: '0 0 8px rgba(74, 222, 128, 0.6)',
                }}
              />
              <Typography
                variant="body2"
                noWrap
                sx={{ color: 'text.primary', fontWeight: 600, fontSize: 13 }}
              >
                @{user.username}
              </Typography>
            </Box>
          </Box>
          <IconButton
            size="small"
            onClick={handleLogout}
            data-testid="sidebar-logout"
            title="Log out"
            sx={{
              color: 'text.disabled',
              '&:hover': { color: 'error.main', bgcolor: 'rgba(248, 113, 113, 0.12)' },
              p: 0.75,
            }}
          >
            <FontAwesomeIcon icon={faPowerOff} size="xs" />
          </IconButton>
        </Box>
      )}
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'canvas', display: 'flex', flexDirection: 'column' }}>
      {/* Skip Link for Accessibility */}
      <Box
        component="a"
        href="#main-content"
        sx={{
          position: 'fixed',
          top: 8,
          left: 8,
          zIndex: 3000,
          transform: 'translateY(-200%)',
          bgcolor: 'surfaceElevated',
          color: 'text.primary',
          border: '1px solid',
          borderColor: 'primary.main',
          px: 2,
          py: 1,
          borderRadius: 2,
          fontSize: 13,
          fontWeight: 600,
          '&:focus': { transform: 'translateY(0)' },
        }}
      >
        Skip to content
      </Box>

      {/* Top Global Header (56px) */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          height: HEADER_HEIGHT,
          bgcolor: 'sidebar',
          borderBottom: '1px solid',
          borderColor: 'divider',
          zIndex: 1250,
          justifyContent: 'center',
        }}
      >
        <Toolbar sx={{ minHeight: `${HEADER_HEIGHT}px !important`, px: { xs: 2, md: 3 }, gap: 2 }}>
          {/* Brand or Mobile Menu Button */}
          {!isDesktop && (
            <IconButton
              edge="start"
              color="inherit"
              aria-label="Open navigation menu"
              onClick={() => setMobileOpen(true)}
              sx={{ mr: 0.5 }}
            >
              <FontAwesomeIcon icon={faBars} size="sm" />
            </IconButton>
          )}

          <Box sx={{ width: { xs: 'auto', md: DRAWER_WIDTH - 24 }, flexShrink: 0 }}>
            <BrandLockup compact={!isDesktop} />
          </Box>

          {/* Center Search Slot */}
          <Box
            sx={{
              flexGrow: 1,
              maxWidth: 640,
              mx: 'auto',
              minWidth: 0,
            }}
          >
            {searchSlot}
          </Box>

          {/* Right Header Status & Profile */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 'auto' }}>
            <Box
              sx={{
                display: { xs: 'none', md: 'flex' },
                alignItems: 'center',
                gap: 0.75,
                px: 1.25,
                py: 0.5,
                borderRadius: '9999px',
                bgcolor: 'rgba(37, 172, 232, 0.1)',
                border: '1px solid',
                borderColor: 'rgba(37, 172, 232, 0.3)',
              }}
            >
              <FontAwesomeIcon icon={faShieldHalved} style={{ fontSize: 11, color: '#25ACE8' }} />
              <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600, fontSize: 11 }}>
                AES-256 ENCRYPTED
              </Typography>
            </Box>

            {user && (
              <IconButton
                size="small"
                onClick={handleLogout}
                data-testid="header-logout"
                title="Log out"
                sx={{
                  display: { xs: 'flex', md: 'none' },
                  color: 'text.disabled',
                  '&:hover': { color: 'error.main' },
                }}
              >
                <FontAwesomeIcon icon={faPowerOff} size="xs" />
              </IconButton>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      {/* Left Desktop Navigation Drawer */}
      {isDesktop ? (
        <Box
          sx={{
            position: 'fixed',
            top: HEADER_HEIGHT,
            bottom: 0,
            left: 0,
            width: DRAWER_WIDTH,
            zIndex: 1200,
            bgcolor: 'sidebar',
            borderRight: '1px solid',
            borderColor: 'divider',
          }}
        >
          {navContent}
        </Box>
      ) : (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          sx={{
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              bgcolor: 'sidebar',
              top: 0,
              height: '100%',
            },
          }}
        >
          {navContent}
        </Drawer>
      )}

      {/* Main Content Workspace */}
      <Box
        component="main"
        id="main-content"
        tabIndex={-1}
        sx={{
          flexGrow: 1,
          ml: isDesktop ? `${DRAWER_WIDTH}px` : 0,
          mt: `${HEADER_HEIGHT}px`,
          p: { xs: 2, md: 3.5 },
          maxWidth: 1600,
          outline: 'none !important',
          '&:focus': { outline: 'none !important' },
          '&:focus-visible': { outline: 'none !important' },
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
