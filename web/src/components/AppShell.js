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
  faFolder,
  faFolderOpen,
  faGear,
  faRightFromBracket,
} from '@fortawesome/free-solid-svg-icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthProvider';

const DRAWER_WIDTH = 240;

/**
 * Responsive shell: fixed sidebar with navigation and logout on desktop;
 * a temporary drawer below 768px.
 */
export default function AppShell({ title, children }) {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { label: 'Drive', icon: faFolderOpen, to: '/drive' },
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
          gap: 1.5,
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'surface2',
            borderRadius: '50%',
          }}
        >
          <FontAwesomeIcon icon={faFolder} color="#fff" size="lg" />
        </Box>
        <Typography
          variant="h6"
          noWrap
          sx={{
            fontFamily: "'Mona Sans Variable', sans-serif",
            fontWeight: 500,
            letterSpacing: '-0.5px',
            color: 'ink',
          }}
        >
          Wyvern Drive
        </Typography>
      </Box>
      <List sx={{ px: 1 }}>
        {navItems.map((item) => {
          const selected = location.pathname.startsWith(item.to);
          return (
            <ListItem key={item.to} disablePadding>
              <ListItemButton
                selected={selected}
                onClick={() => go(item.to)}
                aria-current={selected ? 'page' : undefined}
                sx={{
                  gap: 1,
                  color: 'inkMuted',
                  '&:hover': { bgcolor: 'surface1' },
                  '& .MuiListItemIcon-root': { color: 'inkMuted' },
                  '&:hover .MuiListItemIcon-root': { color: 'ink' },
                  ...(selected && {
                    color: 'ink',
                    fontWeight: 600,
                    '& .MuiListItemIcon-root': { color: 'ink' },
                    '&:hover': { bgcolor: 'surface2' },
                  }),
                }}
              >
                <ListItemIcon>
                  <FontAwesomeIcon icon={item.icon} />
                </ListItemIcon>
                <ListItemText primary={item.label} />
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
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
        }}
      >
        {user && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar
              src={user.avatarUrl || undefined}
              sx={{ width: 24, height: 24, fontSize: 12 }}
            >
              {user.username ? user.username.charAt(0).toUpperCase() : ''}
            </Avatar>
            <Typography variant="body2" noWrap sx={{ flexGrow: 1, color: 'inkMuted' }}>
              {user.username}
            </Typography>
          </Box>
        )}
        <List disablePadding sx={{ px: 1 }}>
          <ListItem disablePadding>
            <ListItemButton
              onClick={handleLogout}
              data-testid="sidebar-logout"
              sx={{
                '&:hover': { bgcolor: 'surface1' },
                '& .MuiListItemIcon-root': { color: 'inkMuted' },
                '&:hover .MuiListItemIcon-root': { color: 'ink' },
              }}
            >
              <ListItemIcon>
                <FontAwesomeIcon icon={faRightFromBracket} />
              </ListItemIcon>
              <ListItemText primary="Log out" />
            </ListItemButton>
          </ListItem>
        </List>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh' }}>
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
          <Toolbar>
            <IconButton
              edge="start"
              color="inherit"
              aria-label="Open navigation menu"
              onClick={() => setMobileOpen(true)}
              sx={{ mr: 2 }}
            >
              <FontAwesomeIcon icon={faBars} />
            </IconButton>
            <Typography
              variant="h6"
              component="h1"
              noWrap
              sx={{
                fontFamily: "'Mona Sans Variable', sans-serif",
                fontWeight: 500,
                letterSpacing: '-0.5px',
                color: 'ink',
              }}
            >
              Wyvern Drive
            </Typography>
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
        sx={{
          ml: isDesktop ? '240px' : 0,
          p: { xs: 2, md: 3 },
          pt: isDesktop ? 3 : 10,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
