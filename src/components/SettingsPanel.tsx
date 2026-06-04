import { useState, useEffect } from 'react';
import { useWebhookStore } from '../stores/webhook-store';

export function SettingsPanel() {
  const { webhookUrl, status, setWebhookUrl, validate } = useWebhookStore();
  const [urlInput, setUrlInput] = useState(webhookUrl);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setUrlInput(webhookUrl);
  }, [webhookUrl]);

  const handleValidate = async () => {
    if (!urlInput) return;
    setMessage('Validating...');
    const isValid = await validate();
    setMessage(isValid ? 'Webhook connected successfully!' : 'Invalid webhook URL.');
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage('Saving...');
    try {
      await setWebhookUrl(urlInput);
      setMessage('Webhook URL saved and verified!');
    } catch {
      setMessage('Failed to save webhook URL.');
    } finally {
      setIsSaving(false);
    }
  };

  const statusColors = {
    unknown: 'bg-amber-500',
    valid: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]',
    invalid: 'bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]',
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm max-w-2xl">
      <fieldset className="border-0 p-0 m-0">
        <legend className="text-xl font-semibold tracking-tight text-foreground mb-4">
          Discord Webhook Configuration
        </legend>
        
        <p className="text-sm text-text-muted mb-6 leading-relaxed">
          Wyvern Drive uses a Discord Webhook to upload and download chunks of your files to Discord's CDN. All files are fully encrypted client-side before upload.
        </p>

        <div className="flex items-center gap-2 mb-4">
          <div className={`w-2.5 h-2.5 rounded-full ${statusColors[status]} transition-all duration-300`} />
          <span className="text-sm font-medium text-foreground">
            Status: {status === 'valid' ? 'Connected' : status === 'invalid' ? 'Disconnected' : 'Checking connection...'}
          </span>
        </div>

        <label htmlFor="webhook-url" className="sr-only">Discord Webhook URL</label>
        <input
          id="webhook-url"
          type="url"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="https://discord.com/api/webhooks/..."
          className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all mb-4"
        />

        <div className="flex items-center gap-3">
          <button
            onClick={handleValidate}
            disabled={!urlInput || isSaving}
            className="px-5 py-2.5 bg-card hover:bg-card-hover text-foreground border border-border hover:border-text-muted/30 disabled:opacity-50 rounded-xl text-sm font-medium transition-all cursor-pointer"
          >
            Test Connection
          </button>
          
          <button
            onClick={handleSave}
            disabled={!urlInput || isSaving}
            className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white disabled:opacity-50 rounded-xl text-sm font-medium transition-all shadow-sm shadow-primary/20 hover:shadow-primary/30 cursor-pointer"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        {message && (
          <p className={`text-sm mt-4 font-medium ${
            message.includes('successfully') || message.includes('verified')
              ? 'text-emerald-500'
              : message.includes('Invalid') || message.includes('Failed')
              ? 'text-rose-500'
              : 'text-text-muted'
          }`}>
            {message}
          </p>
        )}
      </fieldset>
    </div>
  );
}
