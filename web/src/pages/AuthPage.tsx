import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { Button } from '../components/Button';

export function AuthPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(webhookUrl);
      navigate('/drive', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-mark" aria-hidden />
          <h1 className="auth-title">Wyvern Drive</h1>
        </div>
        <p className="auth-subtitle">
          Paste your Discord webhook URL to connect. Your credential stays in this browser; the server never
          stores it.
        </p>
        <form onSubmit={onSubmit} className="auth-form">
          <label htmlFor="webhook" className="auth-label">
            Webhook URL
          </label>
          <input
            id="webhook"
            name="webhook"
            type="url"
            className="auth-input mono"
            placeholder="https://discord.com/api/webhooks/…"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            required
            autoComplete="off"
            spellCheck={false}
          />
          {error ? <div className="auth-error" role="alert">{error}</div> : null}
          <Button type="submit" loading={submitting}>
            Connect
          </Button>
        </form>
        <p className="auth-helper">
          <a
            href="https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks"
            target="_blank"
            rel="noopener noreferrer"
          >
            What is a Discord webhook?
          </a>
        </p>
      </div>
    </div>
  );
}
