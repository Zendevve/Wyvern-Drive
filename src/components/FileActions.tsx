import { useState } from 'react';
import { useAuthStore } from '../stores/auth-store';
import { getWebhookUrl } from '../stores/file-store';
import { downloadFile } from '../lib/download';

interface FileActionsProps {
  fileId: string;
  fileName: string;
  status: string;
}

export function FileActions({ fileId, fileName, status }: FileActionsProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const key = useAuthStore(s => s.derivedKey);

  const handleDownload = async () => {
    if (!key) return;
    const webhookUrl = getWebhookUrl();
    if (!webhookUrl) return;

    setIsDownloading(true);
    try {
      const blob = await downloadFile(fileId, key, webhookUrl);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={isDownloading || status !== 'complete'}
      className="px-3 py-1 bg-blurple hover:bg-blurple/80 disabled:opacity-50 rounded text-sm"
    >
      {isDownloading ? 'Downloading...' : 'Download'}
    </button>
  );
}
