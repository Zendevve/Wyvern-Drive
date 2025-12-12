import { useState } from 'react'
import { useFileStore } from '../stores/fileStore'

export function SetupScreen() {
  const [webhookUrl, setWebhookUrl] = useState('')
  const [password, setPassword] = useState('')
  const [useEncryption, setUseEncryption] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const { setWebhookUrl: saveWebhookUrl, setEncryptionPassword } = useFileStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate webhook URL
    if (!webhookUrl.includes('discord.com/api/webhooks/') &&
      !webhookUrl.includes('discordapp.com/api/webhooks/')) {
      setError('Please enter a valid Discord webhook URL')
      return
    }

    // Validate password if encryption is enabled
    if (useEncryption && password.length < 8) {
      setError('Encryption password must be at least 8 characters')
      return
    }

    setIsLoading(true)

    try {
      saveWebhookUrl(webhookUrl)
      if (useEncryption) {
        setEncryptionPassword(password)
      }
    } catch (err) {
      setError('Failed to connect. Please check your webhook URL.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="setup-screen">
      <form className="setup-card" onSubmit={handleSubmit}>
        <h1>🐉 Wyvern Drive</h1>
        <p>Cloud storage powered by Discord. Secure, fast, unlimited.</p>

        <input
          type="url"
          className="setup-input"
          placeholder="Discord Webhook URL"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          required
        />

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--text-secondary)' }}>
          <input
            type="checkbox"
            checked={useEncryption}
            onChange={(e) => setUseEncryption(e.target.checked)}
          />
          Enable client-side encryption
        </label>

        {useEncryption && (
          <input
            type="password"
            className="setup-input"
            placeholder="Encryption password (min 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
          />
        )}

        {error && (
          <p style={{ color: 'var(--error)', marginBottom: '16px', fontSize: '13px' }}>
            {error}
          </p>
        )}

        {useEncryption && (
          <p style={{ color: 'var(--warning)', marginBottom: '16px', fontSize: '12px' }}>
            ⚠️ Lost password = lost data. We cannot recover encrypted files.
          </p>
        )}

        <button
          type="submit"
          className="setup-button"
          disabled={isLoading}
        >
          {isLoading ? 'Connecting...' : 'Connect to Discord'}
        </button>
      </form>
    </div>
  )
}
