import { useState, useEffect } from 'react';
import { validateWebhook } from '../lib/discord';
import { getWebhookUrl, setWebhookUrl } from '../stores/file-store';

export function SettingsPanel() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<'unknown' | 'valid' | 'invalid'>('unknown');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const stored = getWebhookUrl();
    const envUrl = import.meta.env.VITE_DISCORD_WEBHOOK_URL;
    setUrl(stored || envUrl || '');
  }, []);

  const handleValidate = async () => {
    if (!url) return;
    setStatus('unknown');
    const isValid = await validateWebhook(url);
    setStatus(isValid ? 'valid' : 'invalid');
    setMessage(isValid ? 'Webhook connected successfully' : 'Invalid webhook URL');
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      setWebhookUrl(url);
      setMessage('Webhook URL saved');
      await handleValidate();
    } finally {
      setIsSaving(false);
    }
  };

  const statusColors = {
    unknown: 'bg-gray-500',
    valid: 'bg-green-500',
    invalid: 'bg-red-500',
  };

  return (
    <div className="bg-dark-bg p-4 rounded-lg">
      <h2 className="text-lg font-bold mb-3">Discord Webhook</h2>
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
        <span className="text-sm text-discord-muted">
          {status === 'valid' ? 'Connected' : status === 'invalid' ? 'Disconnected' : 'Unknown'}
        </span>
      </div>
      <input
        type="url"
        value={url}
        onChange={(e) => { setUrl(e.target.value); setStatus('unknown'); }}
        placeholder="https://discord.com/api/webhooks/..."
        className="w-full bg-darker-bg border border-gray-600 rounded px-3 py-2 text-discord-text mb-3"
      />
      <div className="flex gap-2">
        <button
          onClick={handleValidate}
          disabled={!url}
          className="px-4 py-2 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 rounded text-sm"
        >
          Validate
        </button>
        <button
          onClick={handleSave}
          disabled={!url || isSaving}
          className="px-4 py-2 bg-blurple hover:bg-blurple/80 disabled:opacity-50 rounded text-sm"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
      {message && <p className="text-sm mt-2 text-discord-muted">{message}</p>}
    </div>
  );
}
