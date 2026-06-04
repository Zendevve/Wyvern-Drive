import { useState, useEffect } from 'react';
import { useAuthStore } from './stores/auth-store';
import { PasswordModal } from './components/PasswordModal';
import { SettingsPanel } from './components/SettingsPanel';
import { DropZone } from './components/DropZone';
import { FileBrowser } from './components/FileBrowser';
import { UploadProgressList } from './components/UploadProgress';
import { ToastProvider } from './components/Toast';
import { AudioPlayer } from './components/AudioPlayer';
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
    <div className="min-h-screen bg-darker-bg text-discord-text flex items-center justify-center p-4">
      <div className="bg-dark-bg rounded-lg p-6 w-full max-w-sm text-center">
        {status === 'loading' && <p className="text-discord-muted">Loading share...</p>}
        {status === 'expired' && (
          <>
            <p className="text-red-400 font-bold mb-2">Link Expired</p>
            <p className="text-discord-muted text-sm">This share link has expired.</p>
          </>
        )}
        {status === 'error' && (
          <>
            <p className="text-red-400 font-bold mb-2">Error</p>
            <p className="text-discord-muted text-sm">Failed to load shared file.</p>
          </>
        )}
        {status === 'password' && (
          <>
            <p className="font-bold mb-2">{fileName || 'Shared File'}</p>
            <p className="text-discord-muted text-sm mb-4">This file is password protected.</p>
            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-darker-bg border border-gray-700 rounded px-3 py-2 text-sm mb-3"
              onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
            />
            <button
              onClick={handlePasswordSubmit}
              className="w-full bg-blurple hover:bg-blurple/80 rounded py-2 font-medium"
            >
              Download
            </button>
          </>
        )}
        {status === 'downloading' && <p className="text-discord-muted">Decrypting...</p>}
        {status === 'ready' && (
          <>
            <p className="font-bold mb-2">{fileName || 'Shared File'}</p>
            <p className="text-green-400 text-sm mb-3">Download complete!</p>
            <button
              onClick={handleDirectDownload}
              className="bg-blurple hover:bg-blurple/80 rounded px-4 py-2 text-sm"
            >
              Download Again
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="mt-2 bg-dark-bg hover:bg-dark-bg/80 rounded px-4 py-2 text-sm border border-gray-700"
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
  const [showSettings, setShowSettings] = useState(false);

  const isShareRoute = window.location.pathname.startsWith('/share/');

  useEffect(() => {
    if (!isUnlocked) return;
    const handler = () => resetInactivityTimer();
    const events = ['mousedown', 'keydown', 'touchstart'];
    events.forEach(e => document.addEventListener(e, handler));
    return () => events.forEach(e => document.removeEventListener(e, handler));
  }, [isUnlocked, resetInactivityTimer]);

  if (isShareRoute) {
    return (
      <ToastProvider>
        <ShareAccess />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      {!isUnlocked && <PasswordModal />}
      {isUnlocked && (
        <div className="min-h-screen bg-darker-bg text-discord-text">
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-blurple focus:text-white focus:px-4 focus:py-2 focus:rounded"
          >
            Skip to content
          </a>
          <header role="banner" className="flex items-center justify-between p-4 sm:p-6 border-b border-border">
            <h1 className="text-xl sm:text-2xl font-bold">Wyvern Drive</h1>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-dark-bg rounded"
            >
              Settings
            </button>
          </header>
          {showSettings && <div className="p-4"><SettingsPanel /></div>}
          <main id="main-content" role="main" tabIndex={-1} className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 focus:outline-none">
            <DropZone />
            <UploadProgressList />
            <FileBrowser />
          </main>
          <AudioPlayer />
        </div>
      )}
    </ToastProvider>
  );
}
