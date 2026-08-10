import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from './auth/AuthProvider';
import LoginPage from './pages/LoginPage';
import DrivePage from './pages/DrivePage';
import SharePage from './pages/SharePage';
import SettingsPage from './pages/SettingsPage';

const theme = createTheme({
  palette: {
    primary: { main: '#5865F2' },
  },
});

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/drive" element={<DrivePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/share/:token" element={<SharePage />} />
            <Route path="*" element={<Navigate to="/drive" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
