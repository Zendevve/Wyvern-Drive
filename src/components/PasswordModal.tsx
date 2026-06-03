import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useAuthStore } from '../stores/auth-store';

export function PasswordModal() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const unlock = useAuthStore(s => s.unlock);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      await unlock(password);
    } catch {
      setError('Failed to derive encryption key');
    } finally {
      setIsLoading(false);
    }
  };

  const strength = password.length === 0 ? 0
    : password.length < 12 ? 1
    : password.length < 16 ? 2
    : 3;

  const strengthLabels = ['—', 'Weak', 'Medium', 'Strong'];
  const strengthColors = ['bg-gray-600', 'bg-red-500', 'bg-yellow-500', 'bg-green-500'];

  return (
    <Dialog.Root open={true}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-darker-bg p-6 rounded-lg shadow-xl w-96">
          <Dialog.Title className="text-xl font-bold mb-4">Unlock Wyvern Drive</Dialog.Title>
          <Dialog.Description className="text-discord-muted mb-4">
            Enter your encryption password to unlock your files.
          </Dialog.Description>
          <form onSubmit={handleSubmit}>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="Encryption password"
              className="w-full bg-dark-bg border border-gray-600 rounded px-3 py-2 text-discord-text mb-2"
              autoFocus
            />
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 h-1.5 bg-gray-700 rounded">
                <div className={`h-full rounded transition-all ${strengthColors[strength]}`} style={{ width: `${(strength + 1) * 25}%` }} />
              </div>
              <span className="text-xs text-discord-muted">{strengthLabels[strength]}</span>
            </div>
            {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
            <button
              type="submit"
              disabled={isLoading || password.length < 8}
              className="w-full bg-blurple hover:bg-blurple/80 disabled:opacity-50 text-white py-2 rounded font-medium"
            >
              {isLoading ? 'Deriving key...' : 'Unlock'}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
