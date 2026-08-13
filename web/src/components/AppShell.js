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

const DRAWER_WIDTH = 240;

/**
 * Responsive Framer-style shell: a fixed rail on desktop (wordmark band,
 * nav pill rows, bottom identity/logout zone); a temporary drawer plus
 * app bar below 768px. A keyboard skip link targets the main content
 * region, which carries a visible route header built from `title`.
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
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box
        sx={{
          px: 2,
          height: 64,
          display: 'flex',
          alignItems: 'center',
          borderBottom: 1,
          borderColor: 'hairline',
        }}
      >
        <BrandLockup />
      </Box>
      <List sx={{ px: 1.5, pt: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
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
                  minHeight: 42,
                  borderRadius: '12px',
                  px: 2,
                  color: selected ? 'ink' : 'inkMuted',
                  fontWeight: selected ? 600 : 500,
                  bgcolor: selected ? 'surface2' : 'transparent',
                  boxShadow: selected ? 'inset 0 1px 0 rgba(255,255,255,0.08)' : 'none',
                  '&:hover': { bgcolor: selected ? 'surface2' : 'rgba(255,255,255,0.04)', color: 'ink' },
                  '& .MuiListItemIcon-root': {
                    color: selected ? 'accentBlue' : 'inkMuted',
                    minWidth: 'auto',
                    width: 20,
                    justifyContent: 'center',
                  },
                  '&:hover .MuiListItemIcon-root': { color: 'ink' },
                }}
              >
                <ListItemIcon>
                  <FontAwesomeIcon icon={item.icon} />
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: 14,
                    fontWeight: selected ? 600 : 500,
                    letterSpacing: '-0.14px',
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
      <Box sx={{ flexGrow: 1 }} />
      <Box
        sx={{
          borderTop: 1,
          borderColor: 'hairline',
          p: 1.5,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
        }}
      >
        {user && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: 1.25,
              bgcolor: 'surface1',
              border: '1px solid hairline',
              borderRadius: '14px',
            }}
          >
            <Avatar
              src={user.avatarUrl || undefined}
              sx={{ width: 32, height: 32, fontSize: 13, bgcolor: 'surface2', color: 'ink', border: '1px solid hairline' }}
            >
              {user.username ? user.username.charAt(0).toUpperCase() : ''}
            </Avatar>
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography
                variant="body2"
                noWrap
                sx={{ color: 'ink', fontWeight: 600, fontSize: 13, lineHeight: 1.2 }}
              >
                {user.username}
              </Typography>
              <Typography
                variant="caption"
                noWrap
                sx={{ color: 'inkMuted', fontSize: 11, display: 'block', mt: 0.2 }}
              >
                Discord Account
              </Typography>
            </Box>
          </Box>
        )}
        <List disablePadding>
          <ListItem disablePadding>
            <ListItemButton
              onClick={handleLogout}
              data-testid="sidebar-logout"
              sx={{
                minHeight: 40,
                borderRadius: '12px',
                px: 1.5,
                color: 'inkMuted',
                '&:hover': { bgcolor: 'rgba(255,92,92,0.08)', color: 'error.main' },
                '& .MuiListItemIcon-root': { color: 'inkMuted', minWidth: 'auto', width: 20, justifyContent: 'center' },
                '&:hover .MuiListItemIcon-root': { color: 'error.main' },
              }}
            >
              <ListItemIcon>
                <FontAwesomeIcon icon={faRightFromBracket} />
              </ListItemIcon>
              <ListItemText
                primary="Log out"
                primaryTypographyProps={{ fontSize: 14, fontWeight: 500 }}
              />
            </ListItemButton>
          </ListItem>
        </List>
      </Box>
    </Box>
  );

  const routeHeader = (
    <Box
      component="header"
      sx={{
        display: 'flex',
        alignItems: 'center',
        mb: 2.5,
        pb: 1.5,
        borderBottom: 1,
        borderColor: 'hairlineSoft',
      }}
    >
      <Typography
        variant="body1"
        component="h1"
        sx={{
          fontFamily: 'Inter, sans-serif',
          color: 'ink',
          fontWeight: 600,
          fontSize: 18,
          lineHeight: 1.4,
        }}
      >
        {title}
      </Typography>
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <Box
        component="a"
        href="#main-content"
        sx={{
          position: 'fixed',
          top: 8,
          left: 8,
          zIndex: 2000,
          transform: 'translateY(-200%)',
          bgcolor: 'surface2',
          color: 'ink',
          border: 1,
          borderColor: 'hairline',
          borderRadius: '8px',
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
            bgcolor: 'canvas',
            borderRight: 1,
            borderColor: 'hairline',
          }}
        >
          {navContent}
        </Box>
      ) : (
        <AppBar
          position="fixed"
          elevation={0}
          sx={{ bgcolor: 'canvas', color: 'inherit' }}
        >
          <Toolbar sx={{ minHeight: 56 }}>
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
          sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
        >
          {navContent}
        </Drawer>
      )}
      <Box
        component="main"
        id="main-content"
        tabIndex={-1}
        sx={{
          ml: isDesktop ? '240px' : 0,
          p: { xs: 2, md: 3 },
          pt: isDesktop ? 3 : 10,
        }}
      >
        {routeHeader}
        {children}
      </Box>
    </Box>
  );
}
