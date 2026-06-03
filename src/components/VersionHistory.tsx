import { useState, useEffect } from 'react';
import { getVersions, restoreVersion } from '../lib/versioning';
import { useAuthStore } from '../stores/auth-store';
import { getWebhookUrl } from '../stores/file-store';
import type { FileVersion } from '../types';

interface Props {
  fileId: string;
  onClose: () => void;
}

export function VersionHistory({ fileId, onClose }: Props) {
  const [versions, setVersions] = useState<FileVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const key = useAuthStore(s => s.derivedKey);

  useEffect(() => {
    getVersions(fileId).then(v => { setVersions(v); setLoading(false); });
  }, [fileId]);

  const handleRestore = async (version: number) => {
    if (!key) return;
    const webhookUrl = getWebhookUrl();
    if (!webhookUrl) return;
    await restoreVersion(fileId, version, key, webhookUrl);
    onClose();
  };

  if (loading) return <div className="text-discord-muted text-sm p-4">Loading versions...</div>;

  return (
    <div className="bg-darker-bg p-4 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold">Version History</h3>
        <button onClick={onClose} className="text-discord-muted hover:text-discord-text text-sm">✕</button>
      </div>
      {versions.length === 0 && (
        <p className="text-discord-muted text-sm">No version history</p>
      )}
      {versions.map(v => (
        <div key={v.version} className="flex items-center justify-between py-1 border-t border-gray-700">
          <span className="text-sm">
            v{v.version} — {new Date(v.timestamp).toLocaleString()}
          </span>
          <button
            onClick={() => handleRestore(v.version)}
            className="text-xs text-blurple hover:underline"
          >
            Restore
          </button>
        </div>
      ))}
    </div>
  );
}
