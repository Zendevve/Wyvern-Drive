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
          <div className="auth-logo-wrapper" aria-hidden="true">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Left Claw Prong */}
              <path d="M 6 4 C 8 8 7 14 3 20" />
              <path d="M 3 20 C 5 18 8 16 10 15" />
              {/* Middle Claw Prong */}
              <path d="M 12 2 C 13 8 12 14 8 22" />
              <path d="M 8 22 C 10 19 13 17 16 16" />
              {/* Right Claw Prong */}
              <path d="M 18 3 C 18 9 17 15 13 21" />
              <path d="M 13 21 C 15 19 18 18 21 18" />
            </svg>
          </div>
          <h1 className="auth-title">ARTANO</h1>
        </div>
        <p className="auth-subtitle">
          Connect your secure storage using a Discord webhook URL. Credentials stay inside your browser storage.
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
