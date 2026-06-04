import { useState } from 'react';
import { X } from '@phosphor-icons/react';
import { useFileStore } from '../stores/file-store';
import { useAuthStore } from '../stores/auth-store';
import { useWebhookStore } from '../stores/webhook-store';
import { formatFileSize, formatDate } from '../utils/format';
import { useToast } from './Toast';
import { generateShareLink, ONE_HOUR, ONE_DAY, SEVEN_DAYS, THIRTY_DAYS } from '../lib/sharing';
import { createVersion, restoreVersion } from '../lib/versioning';
import { getFileIcon } from './icon-map';

export function FileDetailsDrawer() {
  const selectedFileId = useFileStore(s => s.selectedFileId);
  const setSelectedFileId = useFileStore(s => s.setSelectedFileId);
  const files = useFileStore(s => s.files);
  const loadFiles = useFileStore(s => s.loadFiles);

  const file = files.find(f => f.id === selectedFileId);
  const key = useAuthStore(s => s.derivedKey);
  const { webhookUrl } = useWebhookStore();
  const { toast } = useToast();

  const [sharePassword, setSharePassword] = useState('');
  const [shareExpiry, setShareExpiry] = useState<number>(0);
  const [generatedLink, setGeneratedLink] = useState('');
  const [isUploadingVersion, setIsUploadingVersion] = useState(false);

  if (!file) return null;

  const handleNewVersionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    if (!key || !webhookUrl) {
      toast({ title: 'Config error', description: 'Webhooks and key must be active', variant: 'error' });
      return;
    }

    const versionFile = e.target.files[0];
    setIsUploadingVersion(true);
    toast({ title: 'Uploading version', description: `Uploading new version for ${file.name}...`, variant: 'default' });

    try {
      await createVersion(file.id, versionFile, key, webhookUrl);
      toast({ title: 'Success', description: 'New version uploaded successfully', variant: 'success' });
      await loadFiles();
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'error' });
    } finally {
      setIsUploadingVersion(false);
    }
  };

  const handleRestoreVersion = async (versionNumber: number) => {
    if (!key || !webhookUrl) return;
    toast({ title: 'Restoring version', description: `Restoring version ${versionNumber}...`, variant: 'default' });

    try {
      await restoreVersion(file.id, versionNumber, key, webhookUrl);
      toast({ title: 'Success', description: `Restored to version ${versionNumber}`, variant: 'success' });
      await loadFiles();
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'error' });
    }
  };

  const handleGenerateLink = async () => {
    if (!key) {
      toast({ title: 'Unlocked required', description: 'Database must be unlocked', variant: 'error' });
      return;
    }

    try {
      const link = await generateShareLink(
        file.id,
        file.name,
        key,
        sharePassword || undefined,
        shareExpiry || undefined
      );
      const fullUrl = `${window.location.origin}${link}`;
      setGeneratedLink(fullUrl);
      toast({ title: 'Link Generated', description: 'Secure share link generated successfully', variant: 'success' });
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'error' });
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    toast({ title: 'Copied', description: 'Link copied to clipboard', variant: 'success' });
  };

  return (
    <div className="flex flex-col h-full bg-card select-none text-foreground">
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-border">
        <h3 className="font-semibold text-sm tracking-tight text-foreground">Details</h3>
        <button
          onClick={() => setSelectedFileId(null)}
          aria-label="Close details"
          className="p-1.5 hover:bg-card-hover rounded-lg text-text-muted hover:text-foreground cursor-pointer transition-colors"
        >
          <X size={16} weight="regular" aria-hidden="true" />
        </button>
      </div>

      {/* Main Drawer Scroll Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* File Overview */}
        <div className="flex flex-col items-center text-center pb-4 border-b border-border/60">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
            {(() => {
              const Icon = getFileIcon(file.mimeType);
              return <Icon size={32} weight="regular" className="text-primary" aria-hidden="true" />;
            })()}
          </div>
          <h4 className="font-semibold text-foreground truncate max-w-full px-2" title={file.name}>
            {file.name}
          </h4>
          <span className="text-xxs text-text-muted mt-1 uppercase bg-background border border-border/80 px-2 py-0.5 rounded-full">
            {file.mimeType}
          </span>
        </div>

        {/* Metadata Details */}
        <div className="space-y-3">
          <h5 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Properties</h5>
          <div className="bg-background/40 border border-border/80 rounded-xl p-3.5 space-y-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-text-muted">Size</span>
              <span className="font-medium text-foreground">{formatFileSize(file.size)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Created</span>
              <span className="font-medium text-foreground">{formatDate(file.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Modified</span>
              <span className="font-medium text-foreground">{formatDate(file.updatedAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Active Version</span>
              <span className="font-medium text-foreground">v{file.version}</span>
            </div>
          </div>
        </div>

        {/* Version History List */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h5 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Version History</h5>
            <label
              htmlFor="version-upload-input"
              className={`text-xxs font-semibold text-primary hover:text-primary-hover hover:underline cursor-pointer ${
                isUploadingVersion ? 'pointer-events-none opacity-50' : ''
              }`}
            >
              {isUploadingVersion ? 'Uploading...' : '+ Upload New'}
            </label>
            <input
              type="file"
              id="version-upload-input"
              className="hidden"
              onChange={handleNewVersionUpload}
              disabled={isUploadingVersion}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2.5 bg-primary/5 border border-primary/20 rounded-xl text-xs">
              <div className="min-w-0">
                <p className="font-semibold text-foreground">Version {file.version} (Active)</p>
                <p className="text-[10px] text-text-muted">{formatDate(file.updatedAt)}</p>
              </div>
            </div>
            {file.versionHistory && file.versionHistory.length > 0 ? (
              file.versionHistory
                .filter(vh => vh.version !== file.version)
                .reverse()
                .map(vh => (
                  <div key={vh.version} className="flex items-center justify-between p-2.5 bg-background border border-border/80 rounded-xl text-xs">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">Version {vh.version}</p>
                      <p className="text-[10px] text-text-muted">{formatDate(vh.timestamp)}</p>
                    </div>
                    <button
                      onClick={() => handleRestoreVersion(vh.version)}
                      className="text-xxs font-semibold text-primary hover:underline cursor-pointer"
                    >
                      Restore
                    </button>
                  </div>
                ))
            ) : null}
          </div>
        </div>

        {/* Secure Sharing Config */}
        <div className="space-y-3">
          <h5 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Secure Sharing</h5>
          <div className="bg-background/40 border border-border/80 rounded-xl p-3.5 space-y-3">
            <div>
              <label htmlFor="share-password-field" className="block text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">
                Access Password (Optional)
              </label>
              <input
                id="share-password-field"
                type="password"
                placeholder="Secure password"
                value={sharePassword}
                onChange={e => setSharePassword(e.target.value)}
                className="w-full bg-background border border-border/80 rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="share-expiry-field" className="block text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">
                Link Expiration
              </label>
              <select
                id="share-expiry-field"
                value={shareExpiry}
                onChange={e => setShareExpiry(Number(e.target.value))}
                className="w-full bg-background border border-border/80 rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent cursor-pointer"
              >
                <option value={0}>Never Expire</option>
                <option value={ONE_HOUR}>1 Hour</option>
                <option value={ONE_DAY}>1 Day</option>
                <option value={SEVEN_DAYS}>7 Days</option>
                <option value={THIRTY_DAYS}>30 Days</option>
              </select>
            </div>

            <button
              onClick={handleGenerateLink}
              className="w-full bg-primary hover:bg-primary-hover text-white rounded-lg py-2 font-medium text-xs transition-colors cursor-pointer"
            >
              Generate Share Link
            </button>

            {generatedLink && (
              <div className="space-y-1.5 pt-2 border-t border-border/40">
                <label htmlFor="share-link-result" className="block text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                  Generated Link
                </label>
                <div className="flex gap-1.5">
                  <input
                    id="share-link-result"
                    type="text"
                    readOnly
                    value={generatedLink}
                    className="flex-1 bg-background border border-border/80 rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none select-all"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="px-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
