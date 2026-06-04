import { useState, useEffect } from 'react';
import { X } from '@phosphor-icons/react';
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

  if (loading) return <div className="text-text-muted text-sm p-4">Loading versions...</div>;

  return (
    <div className="bg-background p-4 rounded-xl border border-border">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-foreground">Version History</h3>
        <button onClick={onClose} aria-label="Close version history" className="text-text-muted hover:text-foreground p-1">
          <X size={14} weight="regular" aria-hidden="true" />
        </button>
      </div>
      {versions.length === 0 && (
        <p className="text-text-muted text-sm">No version history</p>
      )}
      <ul role="list" className="divide-y divide-border">
        {versions.map(v => (
          <li key={v.version} className="flex items-center justify-between py-1" aria-label={`Version ${v.version} — ${new Date(v.timestamp).toLocaleString()}`}>
            <span className="text-sm text-foreground">
              v{v.version} — {new Date(v.timestamp).toLocaleString()}
            </span>
            <button
              onClick={() => handleRestore(v.version)}
              className="text-xs text-primary hover:text-primary-hover hover:underline font-medium"
            >
              Restore
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
