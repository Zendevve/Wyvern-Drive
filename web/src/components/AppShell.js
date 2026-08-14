import React, { useState } from 'react';
import {
  AppBar,
  Avatar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBars,
  faFolderOpen,
  faGear,
  faRightFromBracket,
  faTrashCan,
} from '@fortawesome/free-solid-svg-icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import BrandLockup from './BrandLockup';

const DRAWER_WIDTH = 230;

/**
 * Tier-1 First-Party Cloud App Shell.
 * Sleek macOS / Linear / Google Drive aesthetic.
 */
export default function AppShell({ title, children }) {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [mobileOpen, setMobileOpen] = useState(false);

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

  const navContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'sidebar' }}>
      {/* Brand Header */}
      <Box
        sx={{
          px: 2.5,
          height: 60,
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid hairlineSoft',
        }}
      >
        <BrandLockup />
      </Box>

      {/* Navigation List */}
      <List sx={{ px: 1.5, pt: 2, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {navItems.map((item) => {
          const selected = location.pathname.startsWith(item.to);
          return (
            <ListItem key={item.to} disablePadding>
              <ListItemButton
                selected={selected}
                onClick={() => go(item.to)}
                aria-current={selected ? 'page' : undefined}
                sx={{
                  gap: 1.25,
                  minHeight: 38,
                  borderRadius: '8px',
                  px: 1.5,
                  color: selected ? 'ink' : 'inkSecondary',
                  fontWeight: selected ? 600 : 500,
                  bgcolor: selected ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                  position: 'relative',
                  transition: 'all 120ms ease-out',
                  '&:hover': {
                    bgcolor: selected ? 'rgba(255, 255, 255, 0.10)' : 'rgba(255, 255, 255, 0.04)',
                    color: 'ink',
                  },
                  '& .MuiListItemIcon-root': {
                    color: selected ? 'accentBlue' : 'inkMuted',
                    minWidth: 20,
                    justifyContent: 'center',
                  },
                }}
              >
                {selected && (
                  <Box
                    sx={{
                      position: 'absolute',
                      left: -6,
                      top: 8,
                      bottom: 8,
                      width: 3,
                      bgcolor: 'accentBlue',
                      borderRadius: '0 4px 4px 0',
                    }}
                  />
                )}
                <ListItemIcon>
                  <FontAwesomeIcon icon={item.icon} size="sm" />
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: 13.5,
                    fontWeight: selected ? 600 : 500,
                    letterSpacing: '-0.01em',
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Box sx={{ flexGrow: 1 }} />

      {/* User Footer */}
      <Box
        sx={{
          borderTop: '1px solid hairlineSoft',
          p: 1.5,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        {user && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              p: 1,
              bgcolor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid hairlineSoft',
              borderRadius: '10px',
            }}
          >
            <Avatar
              src={user.avatarUrl || undefined}
              sx={{
                width: 28,
                height: 28,
                fontSize: 12,
                bgcolor: 'surface2',
                color: 'ink',
                border: '1px solid hairlineSoft',
              }}
            >
              {user.username ? user.username.charAt(0).toUpperCase() : ''}
            </Avatar>
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography
                variant="body2"
                noWrap
                sx={{ color: 'ink', fontWeight: 600, fontSize: 12.5, lineHeight: 1.2 }}
              >
                {user.username}
              </Typography>
              <Typography
                variant="caption"
                noWrap
                sx={{ color: 'inkMuted', fontSize: 10.5, display: 'block' }}
              >
                Encrypted Drive
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={handleLogout}
              data-testid="sidebar-logout"
              title="Log out"
              sx={{ color: 'inkMuted', '&:hover': { color: 'error.main' }, p: 0.5 }}
            >
              <FontAwesomeIcon icon={faRightFromBracket} size="xs" />
            </IconButton>
          </Box>
        )}
      </Box>
    </Box>
  );

  const routeHeader = (
    <Box
      component="header"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        mb: 3,
        pb: 1.5,
        borderBottom: '1px solid hairlineSoft',
      }}
    >
      <Typography
        variant="h5"
        component="h1"
        sx={{
          color: 'ink',
          fontWeight: 600,
          fontSize: 20,
          letterSpacing: '-0.015em',
        }}
      >
        {title}
      </Typography>
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'canvas' }}>
      <Box
        component="a"
        href="#main-content"
        sx={{
          position: 'fixed',
          top: 8,
          left: 8,
          zIndex: 2000,
          transform: 'translateY(-200%)',
          bgcolor: 'surfaceElevated',
          color: 'ink',
          border: '1px solid hairline',
          borderRadius: '6px',
          px: 2,
          py: 1,
          '&:focus': { transform: 'translateY(0)' },
        }}
      >
        Skip to content
      </Box>
      {isDesktop ? (
        <Box
          component="nav"
          aria-label="Navigation"
          sx={{
            position: 'fixed',
            top: 0,
            bottom: 0,
            left: 0,
            width: DRAWER_WIDTH,
            zIndex: 1200,
            bgcolor: 'sidebar',
            borderRight: '1px solid hairlineSoft',
          }}
        >
          {navContent}
        </Box>
      ) : (
        <AppBar
          position="fixed"
          elevation={0}
          sx={{ bgcolor: 'sidebar', borderBottom: '1px solid hairlineSoft' }}
        >
          <Toolbar sx={{ minHeight: 52 }}>
            <IconButton
              edge="start"
              color="inherit"
              aria-label="Open navigation menu"
              onClick={() => setMobileOpen(true)}
              sx={{ mr: 1.5 }}
            >
              <FontAwesomeIcon icon={faBars} />
            </IconButton>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <BrandLockup compact />
            </Box>
          </Toolbar>
        </AppBar>
      )}
      {!isDesktop && (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH, bgcolor: 'sidebar' } }}
        >
          {navContent}
        </Drawer>
      )}
      <Box
        component="main"
        id="main-content"
        tabIndex={-1}
        sx={{
          ml: isDesktop ? `${DRAWER_WIDTH}px` : 0,
          p: { xs: 2, md: 3.5 },
          pt: isDesktop ? 3 : 9,
          maxWidth: 1600,
        }}
      >
        {routeHeader}
        {children}
      </Box>
    </Box>
  );
}
