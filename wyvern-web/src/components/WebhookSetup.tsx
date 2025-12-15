/**
 * WebhookSetup - Configure Discord webhooks after authentication
 * Shown on first login when no webhooks are saved
 */
import { useState, useEffect } from 'react'
import { Shield, Zap, Lock, Globe, Loader2, Link, Key, Plus, Minus } from 'lucide-react'
import './SetupScreen.css' // Reuse existing styles

interface WebhookSetupProps {
  onComplete: (webhooks: string[], password: string | null) => void
  isLoading?: boolean
  initialWebhooks?: string[]
}

export function WebhookSetup({ onComplete, isLoading = false, initialWebhooks = [''] }: WebhookSetupProps) {
  const [webhooks, setWebhooks] = useState<string[]>(initialWebhooks)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [useEncryption, setUseEncryption] = useState(false)

  // Load saved webhooks from localStorage on mount (for returning users)
  useEffect(() => {
    const saved = localStorage.getItem('wyvern-saved-webhooks')
    if (saved) {
      try {
        const savedWebhooks = JSON.parse(saved)
        if (Array.isArray(savedWebhooks) && savedWebhooks.length > 0) {
          setWebhooks(savedWebhooks)
        }
      } catch {
        // Ignore invalid JSON
      }
    }
  }, [])

  const addWebhook = () => setWebhooks([...webhooks, ''])

  const removeWebhook = (index: number) => {
    if (webhooks.length > 1) {
      setWebhooks(webhooks.filter((_, i) => i !== index))
    }
  }

  const updateWebhook = (index: number, value: string) => {
    setWebhooks(webhooks.map((w, i) => i === index ? value : w))
  }

  const validWebhooks = webhooks.filter(w => w.trim().startsWith('https://discord.com/api/webhooks/'))
  const canSubmit = validWebhooks.length > 0 && (!useEncryption || password.length >= 8)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return

    // Save webhooks to localStorage for persistence
    localStorage.setItem('wyvern-saved-webhooks', JSON.stringify(validWebhooks))

    onComplete(validWebhooks, useEncryption ? password : null)
  }

  return (
    <div className="setup-screen">
      {/* Left Panel - Branding & Hero */}
      <div className="setup-panel-left">
        <div className="brand-header">
          <Shield size={24} />
          <span>WYVERN DRIVE</span>
        </div>

        <div className="hero-content">
          <h1>Almost<br />There!</h1>
          <p className="hero-subtitle">
            Connect your Discord webhooks to start storing files.
            Use multiple webhooks for faster parallel uploads.
          </p>
        </div>

        <div className="feature-list">
          <div className="feature-item">
            <Globe size={20} />
            <div>
              <strong>Decentralized Core</strong>
              <span>Powered by Discord's robust CDN infrastructure</span>
            </div>
          </div>
          <div className="feature-item">
            <Lock size={20} />
            <div>
              <strong>End-to-End Encryption</strong>
              <span>Client-side AES-256 encryption ensures privacy</span>
            </div>
          </div>
          <div className="feature-item">
            <Zap size={20} />
            <div>
              <strong>Lightning Fast</strong>
              <span>Parallel chunked uploads with multi-webhook support</span>
            </div>
          </div>
        </div>

        <div className="panel-footer">
          v1.0.0 • Open Source MIT License
        </div>
      </div>

      {/* Right Panel - Webhook Form */}
      <div className="setup-panel-right">
        <div className="setup-card">
          <div className="setup-header">
            <h2>Connect Drive</h2>
            <p>Enter your Discord Webhook URL(s) to initialize the filesystem.</p>
          </div>

          <form onSubmit={handleSubmit} className="setup-form">
            <div className="input-group">
              <label>
                <Link size={14} /> Webhook URLs
              </label>

              <div className="webhook-list">
                {webhooks.map((webhook, index) => (
                  <div key={index} className="webhook-input-row">
                    <input
                      type="password"
                      value={webhook}
                      onChange={(e) => updateWebhook(index, e.target.value)}
                      placeholder="https://discord.com/api/webhooks/..."
                      className="setup-input"
                    />
                    {webhooks.length > 1 && (
                      <button
                        type="button"
                        className="remove-webhook-btn"
                        onClick={() => removeWebhook(index)}
                        title="Remove webhook"
                      >
                        <Minus size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="add-webhook-btn"
                onClick={addWebhook}
              >
                <Plus size={14} />
                Add another webhook
              </button>

              <div className="webhook-tip">
                <Zap size={12} />
                <span>
                  {validWebhooks.length === 0
                    ? 'Enter at least one valid Discord webhook URL'
                    : validWebhooks.length < 3
                      ? `${validWebhooks.length} webhook${validWebhooks.length > 1 ? 's' : ''} — Add ${3 - validWebhooks.length} more for faster uploads`
                      : validWebhooks.length < 5
                        ? `${validWebhooks.length} webhooks — Good! Add ${5 - validWebhooks.length} more for optimal speed`
                        : `${validWebhooks.length} webhooks — Optimal configuration!`
                  }
                </span>
              </div>
            </div>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={useEncryption}
                onChange={(e) => setUseEncryption(e.target.checked)}
              />
              Enable Client-Side Encryption
            </label>

            {useEncryption && (
              <div className="input-group animate-in">
                <label htmlFor="password">
                  <Key size={14} /> Master Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Set a strong decryption password"
                    required={useEncryption}
                    className="setup-input"
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="setup-button"
              disabled={!canSubmit || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="spinner" size={18} /> Saving...
                </>
              ) : (
                <>Connect to Wyvern <ChevronRight size={16} /></>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

function ChevronRight({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}
