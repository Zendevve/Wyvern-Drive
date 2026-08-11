import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './theme';
import { AuthProvider } from './auth/AuthProvider';
import LoginPage from './pages/LoginPage';
import DrivePage from './pages/DrivePage';
import SharePage from './pages/SharePage';
import SettingsPage from './pages/SettingsPage';

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
