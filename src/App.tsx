import { useState, useEffect } from 'react';
import { Cloud, HardDrives, Image, Gear, Sun, Moon, Lock } from '@phosphor-icons/react';
import { useAuthStore } from './stores/auth-store';
import { useThemeStore } from './stores/theme-store';
import { useWebhookStore } from './stores/webhook-store';
import { useFileStore } from './stores/file-store';
import { PasswordModal } from './components/PasswordModal';
import { SettingsPanel } from './components/SettingsPanel';
import { DropZone } from './components/DropZone';
import { FileBrowser } from './components/FileBrowser';
import { UploadProgressList } from './components/UploadProgress';
import { ToastProvider } from './components/Toast';
import { AudioPlayer } from './components/AudioPlayer';
import { PhotoTimeline } from './components/PhotoTimeline';
import { FolderTree } from './components/FolderTree';
import { FileDetailsDrawer } from './components/FileDetailsDrawer';
import { parseShareLink, verifySharePassword, accessShare } from './lib/sharing';
import { getFile } from './lib/db';
import { getWebhookUrl } from './stores/file-store';

function ShareAccess() {
  const [status, setStatus] = useState<'loading' | 'password' | 'downloading' | 'expired' | 'error' | 'ready'>('loading');
  const [fileName, setFileName] = useState('');
  const [password, setPassword] = useState('');
  const [shareData, setShareData] = useState<ReturnType<typeof parseShareLink>>(null);

  useEffect(() => {
    const parsed = parseShareLink(window.location.href);
    if (!parsed) {
      setStatus('error');
      return;
    }

    if (parsed.payload.e > 0 && Date.now() > parsed.payload.e) {
      setStatus('expired');
      return;
    }

    setShareData(parsed);

    getFile(parsed.fileId).then(file => {
      if (file) setFileName(file.name);
    });

    if (parsed.payload.p) {
      setStatus('password');
    } else {
      setStatus('ready');
    }
  }, []);

  const handlePasswordSubmit = async () => {
    if (!shareData) return;
    setStatus('downloading');

    try {
      const key = await verifySharePassword(
        shareData.payload.k,
        shareData.payload.s,
        shareData.payload.n,
        password
      );

      if (!key) {
        setStatus('password');
        return;
      }

      const webhookUrl = getWebhookUrl();
      if (!webhookUrl) {
        setStatus('error');
        return;
      }

      const blob = await accessShare(shareData.fileId, key, webhookUrl);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'shared-file';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  };

  const handleDirectDownload = async () => {
    if (!shareData) return;
    setStatus('downloading');

    try {
      const file = await getFile(shareData.fileId);
      if (!file) {
        setStatus('error');
        return;
      }

      const key = useAuthStore.getState().derivedKey;
      if (!key) {
        setStatus('password');
        return;
      }

      const webhookUrl = getWebhookUrl();
      if (!webhookUrl) {
        setStatus('error');
        return;
      }

      const blob = await accessShare(shareData.fileId, key, webhookUrl);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'shared-file';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm text-center shadow-sm">
        {status === 'loading' && <p className="text-text-muted">Loading share...</p>}
        {status === 'expired' && (
          <>
            <p className="text-rose-500 font-bold mb-2">Link Expired</p>
            <p className="text-text-muted text-sm">This share link has expired.</p>
          </>
        )}
        {status === 'error' && (
          <>
            <p className="text-rose-500 font-bold mb-2">Error</p>
            <p className="text-text-muted text-sm">Failed to load shared file.</p>
          </>
        )}
        {status === 'password' && (
          <>
            <p className="font-bold mb-2">{fileName || 'Shared File'}</p>
            <p className="text-text-muted text-sm mb-4">This file is password protected.</p>
            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary"
              onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
            />
            <button
              onClick={handlePasswordSubmit}
              className="w-full bg-primary hover:bg-primary-hover text-white rounded py-2 font-medium transition-colors"
            >
              Download
            </button>
          </>
        )}
        {status === 'downloading' && <p className="text-text-muted animate-pulse">Decrypting and assembling...</p>}
        {status === 'ready' && (
          <>
            <p className="font-bold mb-2">{fileName || 'Shared File'}</p>
            <p className="text-emerald-500 text-sm mb-3">Download complete!</p>
            <button
              onClick={handleDirectDownload}
              className="bg-primary hover:bg-primary-hover text-white rounded px-4 py-2 text-sm transition-colors"
            >
              Download Again
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="mt-2 w-full bg-card hover:bg-card-hover border border-border text-foreground rounded px-4 py-2 text-sm transition-colors"
            >
              Open Wyvern Drive
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const isUnlocked = useAuthStore(s => s.isUnlocked);
  const resetInactivityTimer = useAuthStore(s => s.resetInactivityTimer);
  const lock = useAuthStore(s => s.lock);

  const { theme, toggleTheme } = useThemeStore();
  const { status: webhookStatus, loadWebhook } = useWebhookStore();
  const selectedFileId = useFileStore(s => s.selectedFileId);
  const selectedFile = useFileStore(s => s.files.find(f => f.id === selectedFileId));

  const [activeView, setActiveView] = useState<'drive' | 'photos' | 'settings'>('drive');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const isShareRoute = window.location.pathname.startsWith('/share/');

  useEffect(() => {
    if (!isUnlocked) return;
    loadWebhook();
    const handler = () => resetInactivityTimer();
    const events = ['mousedown', 'keydown', 'touchstart'];
    events.forEach(e => document.addEventListener(e, handler));
    return () => events.forEach(e => document.removeEventListener(e, handler));
  }, [isUnlocked, resetInactivityTimer, loadWebhook]);

  if (isShareRoute) {
    return (
      <ToastProvider>
        <ShareAccess />
      </ToastProvider>
    );
  }

  const statusColors = {
    unknown: 'bg-amber-500',
    valid: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]',
    invalid: 'bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]',
  };

  return (
    <ToastProvider>
      {!isUnlocked && <PasswordModal />}
      {isUnlocked && (
        <div className="flex h-screen overflow-hidden bg-background text-foreground select-none">
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-primary focus:text-white focus:px-4 focus:py-2 focus:rounded"
          >
            Skip to content
          </a>

          {/* Collapsible Left Sidebar */}
          <aside
            role="navigation"
            aria-label="Sidebar navigation"
            className={`${
              sidebarOpen ? 'w-64' : 'w-16'
            } transition-all duration-300 ease-in-out bg-card border-r border-border flex flex-col h-full shrink-0`}
          >
            {/* Sidebar Brand Header */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-border">
              <div className="flex items-center gap-2 overflow-hidden">
                <Cloud size={20} weight="regular" className="text-primary shrink-0" aria-hidden="true" />
                {sidebarOpen && (
                  <span className="font-semibold tracking-tight text-foreground truncate">
                    Wyvern Drive
                  </span>
                )}
              </div>
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                className="p-1.5 hover:bg-card-hover rounded-lg text-text-muted hover:text-foreground transition-colors cursor-pointer"
              >
                {sidebarOpen ? '◀' : '▶'}
              </button>
            </div>

            {/* Sidebar Links */}
            <nav className="flex-1 py-4 overflow-y-auto px-2 space-y-1.5">
              <div>
                <button
                  onClick={() => setActiveView('drive')}
                  aria-label="My Drive"
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                    activeView === 'drive'
                      ? 'bg-primary/10 text-primary'
                      : 'text-text-muted hover:text-foreground hover:bg-card-hover'
                  }`}
                >
                  <HardDrives size={18} weight="regular" className="shrink-0" aria-hidden="true" />
                  {sidebarOpen && <span>My Drive</span>}
                </button>
                {activeView === 'drive' && sidebarOpen && (
                  <div className="pl-6 pr-2 py-1 max-h-[280px] overflow-y-auto mt-1 border-l border-border/50 ml-5 animate-in slide-in-from-top-2 duration-200">
                    <FolderTree />
                  </div>
                )}
              </div>

              <button
                onClick={() => setActiveView('photos')}
                aria-label="Photos"
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                  activeView === 'photos'
                    ? 'bg-primary/10 text-primary'
                    : 'text-text-muted hover:text-foreground hover:bg-card-hover'
                }`}
              >
                <Image size={18} weight="regular" className="shrink-0" aria-hidden="true" />
                {sidebarOpen && <span>Photos</span>}
              </button>

              <button
                onClick={() => setActiveView('settings')}
                aria-label="Settings"
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                  activeView === 'settings'
                    ? 'bg-primary/10 text-primary'
                    : 'text-text-muted hover:text-foreground hover:bg-card-hover'
                }`}
              >
                <Gear size={18} weight="regular" className="shrink-0" aria-hidden="true" />
                {sidebarOpen && <span>Settings</span>}
              </button>
            </nav>

            {/* Sidebar Footer Details */}
            <div className="p-3 border-t border-border space-y-2">
              {/* Webhook Status Dot */}
              <div className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-text-muted bg-background/50 border border-border/50">
                <div className={`w-2 h-2 rounded-full ${statusColors[webhookStatus]} transition-colors duration-300`} />
                {sidebarOpen && (
                  <span className="truncate">
                    {webhookStatus === 'valid' ? 'Discord Connected' : webhookStatus === 'invalid' ? 'Discord Error' : 'Checking connection...'}
                  </span>
                )}
              </div>

              {/* Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-text-muted hover:text-foreground hover:bg-card-hover transition-colors cursor-pointer"
              >
                {theme === 'dark' ? (
                  <Sun size={18} weight="regular" className="shrink-0" aria-hidden="true" />
                ) : (
                  <Moon size={18} weight="regular" className="shrink-0" aria-hidden="true" />
                )}
                {sidebarOpen && <span>{theme === 'dark' ? 'Light Theme' : 'Dark Theme'}</span>}
              </button>

              {/* Lock database */}
              <button
                onClick={lock}
                aria-label="Lock Drive"
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
              >
                <Lock size={18} weight="regular" className="shrink-0" aria-hidden="true" />
                {sidebarOpen && <span>Lock Drive</span>}
              </button>
            </div>
          </aside>

          {/* Central Main Panel Area */}
          <div className="flex-1 flex flex-col min-w-0 h-full relative">
            <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-card shrink-0">
              <h2 className="text-lg font-semibold tracking-tight text-foreground capitalize">
                {activeView === 'drive' ? 'My Files' : activeView}
              </h2>
              {/* Topbar mini details */}
              <div className="flex items-center gap-3">
                <div className="text-xs text-text-muted font-medium bg-background border border-border px-2.5 py-1 rounded-full">
                  AES-256 Encrypted
                </div>
              </div>
            </header>

            <main
              id="main-content"
              role="main"
              tabIndex={-1}
              className="flex-1 overflow-y-auto p-6 focus:outline-none"
            >
              <DropZone />
              <UploadProgressList />
              
              <div className="max-w-6xl mx-auto">
                {activeView === 'drive' && <FileBrowser />}
                {activeView === 'photos' && <PhotoTimeline />}
                {activeView === 'settings' && <SettingsPanel />}
              </div>
            </main>

            <AudioPlayer />
          </div>

          {/* Collapsible Right-Side Details Drawer */}
          {selectedFile && (
            <aside className="w-80 border-l border-border bg-card shrink-0 flex flex-col h-full animate-in slide-in-from-right duration-200">
              <FileDetailsDrawer />
            </aside>
          )}
        </div>
      )}
    </ToastProvider>
  );
}
