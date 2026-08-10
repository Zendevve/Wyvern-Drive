import React, { useState } from 'react';
import {
  AppBar,
  Box,
  Divider,
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
} from '@fortawesome/free-solid-svg-icons';
import { useLocation, useNavigate } from 'react-router-dom';
import QuotaMeter from './QuotaMeter';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthProvider';

const DRAWER_WIDTH = 240;

/**
 * Responsive shell: fixed sidebar with navigation, logout, and quota on
 * desktop; a temporary drawer below 768px.
 */
export default function AppShell({ title, children }) {
  const { user, drive, refresh } = useAuth();
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
      <List>
        {navItems.map((item) => (
          <ListItem key={item.to} disablePadding>
            <ListItemButton
              selected={location.pathname.startsWith(item.to)}
              onClick={() => go(item.to)}
              aria-current={location.pathname.startsWith(item.to) ? 'page' : undefined}
            >
              <ListItemIcon>
                <FontAwesomeIcon icon={item.icon} />
              </ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Box sx={{ flexGrow: 1 }} />
      <Divider />
      <List>
        <ListItem disablePadding>
          <ListItemButton onClick={handleLogout} data-testid="sidebar-logout">
            <ListItemIcon>
              <FontAwesomeIcon icon={faRightFromBracket} />
            </ListItemIcon>
            <ListItemText primary="Log out" />
          </ListItemButton>
        </ListItem>
      </List>
      <Box sx={{ p: 2 }}>
        <QuotaMeter drive={drive} />
      </Box>
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <AppBar position="fixed" sx={{ zIndex: 1300 }}>
        <Toolbar>
          {!isDesktop && (
            <IconButton
              edge="start"
              color="inherit"
              aria-label="Open navigation menu"
              onClick={() => setMobileOpen(true)}
              sx={{ mr: 2 }}
            >
              <FontAwesomeIcon icon={faBars} />
            </IconButton>
          )}
          <Typography variant="h6" component="h1" noWrap>
            {title}
          </Typography>
          {user && (
            <Typography
              variant="body2"
              sx={{ ml: 'auto', display: { xs: 'none', sm: 'block' } }}
            >
              {user.username}
            </Typography>
          )}
        </Toolbar>
      </AppBar>
      {isDesktop ? (
        <Box
          component="nav"
          aria-label="Navigation"
          sx={{
            position: 'fixed',
            top: 64,
            bottom: 0,
            left: 0,
            width: DRAWER_WIDTH,
            zIndex: 1200,
            bgcolor: 'background.paper',
            borderRight: 1,
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
          sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
        >
          {navContent}
        </Drawer>
      )}
      <Box
        component="main"
        sx={{
          ml: isDesktop ? `${DRAWER_WIDTH}px` : 0,
          p: { xs: 2, md: 3 },
          pt: 10,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
