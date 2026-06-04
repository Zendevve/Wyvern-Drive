import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { v4 as uuidv4 } from 'uuid';
import { useShareStore } from '../stores/share-store';
import { useAuthStore } from '../stores/auth-store';
import { generateShareLink, ONE_HOUR, ONE_DAY, SEVEN_DAYS, THIRTY_DAYS } from '../lib/sharing';
import { useToast } from './Toast';
import type { FileRecord } from '../types';

interface ShareModalProps {
  file: FileRecord;
  isOpen: boolean;
  onClose: () => void;
}

const EXPIRY_OPTIONS = [
  { label: 'No expiry', value: 0 },
  { label: '1 hour', value: ONE_HOUR },
  { label: '24 hours', value: ONE_DAY },
  { label: '7 days', value: SEVEN_DAYS },
  { label: '30 days', value: THIRTY_DAYS },
];

export function ShareModal({ file, isOpen, onClose }: ShareModalProps) {
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [expiry, setExpiry] = useState(0);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const addShare = useShareStore(s => s.addShare);
  const removeShare = useShareStore(s => s.removeShare);
  const shares = useShareStore(s => s.shares);
  const toast = useToast();

  const existingShares = shares.filter(s => s.fileId === file.id);

  useEffect(() => {
    if (!isOpen) {
      setUsePassword(false);
      setPassword('');
      setExpiry(0);
      setGeneratedLink(null);
    }
  }, [isOpen]);

  const handleGenerate = async () => {
    const key = useAuthStore.getState().derivedKey;
    if (!key) return;

    setGenerating(true);
    try {
      const link = await generateShareLink(
        file.id,
        file.name,
        key,
        usePassword ? password : undefined,
        expiry || undefined
      );

      const fullUrl = `${window.location.origin}${link}`;
      setGeneratedLink(fullUrl);

      await addShare({
        id: uuidv4(),
        fileId: file.id,
        fileName: file.name,
        encryptedKey: '',
        salt: '',
        nonce: '',
        expiresAt: expiry ? Date.now() + expiry : 0,
        hasPassword: usePassword,
        createdAt: new Date(),
        accessCount: 0,
      });

      toast.toast({ title: 'Share link created', variant: 'success' });
    } catch {
      toast.toast({ title: 'Failed to create share link', variant: 'error' });
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      toast.toast({ title: 'Link copied to clipboard', variant: 'success' });
    }
  };

  const handleRevoke = async (shareId: string) => {
    await removeShare(shareId);
    toast.toast({ title: 'Share link revoked', variant: 'success' });
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 z-50" />
        <Dialog.Content aria-label={`Share ${file.name}`} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-darker-bg rounded-lg p-6 w-[90vw] max-w-md">
          <Dialog.Title className="text-lg font-bold mb-4">Share &quot;{file.name}&quot;</Dialog.Title>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="usePassword"
                checked={usePassword}
                onChange={(e) => setUsePassword(e.target.checked)}
                className="accent-blurple"
              />
              <label htmlFor="usePassword" className="text-sm">Password protect</label>
            </div>

            {usePassword && (
              <input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-dark-bg border border-gray-700 rounded px-3 py-2 text-sm"
              />
            )}

            <div>
              <label className="text-sm text-discord-muted block mb-1">Expiry</label>
              <select
                value={expiry}
                onChange={(e) => setExpiry(Number(e.target.value))}
                className="w-full bg-dark-bg border border-gray-700 rounded px-3 py-2 text-sm"
              >
                {EXPIRY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating || (usePassword && !password)}
              className="w-full bg-blurple hover:bg-blurple/80 disabled:opacity-50 rounded py-2 font-medium"
            >
              {generating ? 'Generating...' : 'Generate Link'}
            </button>

            {generatedLink && (
              <div className="flex gap-2">
                <input
                  readOnly
                  value={generatedLink}
                  className="flex-1 bg-dark-bg border border-gray-700 rounded px-3 py-2 text-xs font-mono"
                />
                <button onClick={handleCopy} className="bg-blurple hover:bg-blurple/80 rounded px-3 py-2 text-sm">
                  Copy
                </button>
              </div>
            )}

            {existingShares.length > 0 && (
              <div className="border-t border-gray-700 pt-3 mt-3">
                <p className="text-sm font-medium mb-2">Existing shares</p>
                {existingShares.map(share => (
                  <div key={share.id} className="flex items-center justify-between py-1">
                    <span className="text-xs text-discord-muted">
                      {share.hasPassword ? '🔒 ' : ''}
                      {share.expiresAt > 0 ? `Expires ${new Date(share.expiresAt).toLocaleDateString()}` : 'No expiry'}
                    </span>
                    <button onClick={() => handleRevoke(share.id)} className="text-xs text-red-400 hover:underline">
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Dialog.Close asChild>
            <button className="absolute top-4 right-4 text-discord-muted hover:text-discord-text">✕</button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
