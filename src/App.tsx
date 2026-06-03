import { useState, useEffect } from 'react';
import { useAuthStore } from './stores/auth-store';
import { PasswordModal } from './components/PasswordModal';
import { SettingsPanel } from './components/SettingsPanel';
import { DropZone } from './components/DropZone';
import { FileList } from './components/FileList';
import { UploadProgressList } from './components/UploadProgress';
import { ToastProvider } from './components/Toast';

export default function App() {
  const isUnlocked = useAuthStore(s => s.isUnlocked);
  const resetInactivityTimer = useAuthStore(s => s.resetInactivityTimer);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!isUnlocked) return;
    const handler = () => resetInactivityTimer();
    const events = ['mousedown', 'keydown', 'touchstart'];
    events.forEach(e => document.addEventListener(e, handler));
    return () => events.forEach(e => document.removeEventListener(e, handler));
  }, [isUnlocked, resetInactivityTimer]);

  return (
    <ToastProvider>
      {!isUnlocked && <PasswordModal />}
      {isUnlocked && (
        <div className="min-h-screen bg-darker-bg text-discord-text">
          <header className="flex items-center justify-between p-4 border-b border-gray-700">
            <h1 className="text-2xl font-bold">Wyvern Drive</h1>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-dark-bg rounded"
            >
              Settings
            </button>
          </header>
          {showSettings && <div className="p-4"><SettingsPanel /></div>}
          <main className="max-w-4xl mx-auto p-4">
            <DropZone />
            <UploadProgressList />
            <FileList />
          </main>
        </div>
      )}
    </ToastProvider>
  );
}
