import { useState } from 'react'
import { useFileStore } from '../stores/fileStore'
import { Shield, Zap, Lock, Globe, Loader2, Link, Key } from 'lucide-react'
import './SetupScreen.css'

export function SetupScreen() {
  const { setWebhookUrl, setEncryptionPassword, isLoading } = useFileStore()
  const [url, setUrl] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [useEncryption, setUseEncryption] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!url) return

    if (useEncryption && password) {
      setEncryptionPassword(password)
    }
    setWebhookUrl(url)
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
          <h1>Storage,<br />Evolved.</h1>
          <p className="hero-subtitle">
            A decentralized, encrypted file system that lives directly in your Discord server.
            Unlimited storage, zero monthly fees.
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
              <span>Parallel chunked uploads and downloads</span>
            </div>
          </div>
        </div>

        <div className="panel-footer">
          v1.0.0 • Open Source MIT License
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="setup-panel-right">
        <div className="setup-card">
          <div className="setup-header">
            <h2>Connect Drive</h2>
            <p>Enter your Webhook URL to initialize the filesystem.</p>
          </div>

          <form onSubmit={handleSubmit} className="setup-form">
            <div className="input-group">
              <label htmlFor="webhook">
                <Link size={14} /> Webhook URL
              </label>
              <input
                id="webhook"
                type="password"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                required
                className="setup-input"
              />
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
              disabled={!url || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="spinner" size={18} /> Initializing...
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
