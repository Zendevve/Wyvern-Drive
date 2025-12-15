import { useState, useEffect } from 'react'
import { X, Zap, Plus, Minus, Save, Rocket } from 'lucide-react'
import { useFileStore } from '../stores/fileStore'
import { useFocusTrap } from '../hooks/useFocusTrap'
import type { ServerBoostLevel } from '../lib/types'
import './SettingsModal.css'

export function SettingsModal() {
  const { activeModal, setActiveModal, webhookUrls, updateWebhooks, getWebhookPoolStats, serverBoostLevel, setServerBoostLevel } = useFileStore()
  const [webhooks, setWebhooks] = useState<string[]>([''])
  const [isSaving, setIsSaving] = useState(false)

  const isOpen = activeModal === 'settings'

  // Initialize webhooks from store when modal opens
  useEffect(() => {
    if (isOpen) {
      setWebhooks(webhookUrls.length > 0 ? [...webhookUrls] : [''])
    }
  }, [isOpen, webhookUrls])

  const handleClose = () => {
    setActiveModal(null)
  }

  // Hooks must be called before any early returns
  const focusTrapRef = useFocusTrap(isOpen, handleClose)

  if (!isOpen) return null

  const webhookStats = getWebhookPoolStats()

  const addWebhook = () => {
    setWebhooks([...webhooks, ''])
  }

  const removeWebhook = (index: number) => {
    if (webhooks.length > 1) {
      setWebhooks(webhooks.filter((_, i) => i !== index))
    }
  }

  const updateWebhook = (index: number, value: string) => {
    setWebhooks(webhooks.map((w, i) => i === index ? value : w))
  }

  const validWebhooks = webhooks.filter(w => w.trim().startsWith('https://discord.com/api/webhooks/'))
  const hasChanges = JSON.stringify(validWebhooks.sort()) !== JSON.stringify([...webhookUrls].sort())
  const canSave = validWebhooks.length > 0 && hasChanges

  const handleSave = async () => {
    if (!canSave) return
    setIsSaving(true)
    try {
      await updateWebhooks(validWebhooks)
      setActiveModal(null)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="settings-modal-overlay" onClick={handleClose}>
      <div
        className="settings-modal"
        onClick={e => e.stopPropagation()}
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
      >
        <div className="settings-header">
          <h2 id="settings-modal-title">Settings</h2>
          <button className="close-btn" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        <div className="settings-content">
          {/* Webhook Pool Section */}
          <section className="settings-section">
            <div className="section-header">
              <Zap size={18} />
              <h3>Webhook Pool</h3>
              {webhookStats && (
                <span className={`webhook-badge ${webhookStats.isOptimal ? 'optimal' : 'suboptimal'}`}>
                  {webhookStats.count} active
                </span>
              )}
            </div>

            <p className="section-description">
              Add multiple webhooks to enable parallel uploads and faster transfer speeds.
            </p>

            <div className="webhook-list">
              {webhooks.map((webhook, index) => (
                <div key={index} className="webhook-input-row">
                  <input
                    type="password"
                    value={webhook}
                    onChange={(e) => updateWebhook(index, e.target.value)}
                    placeholder="https://discord.com/api/webhooks/..."
                    className="settings-input"
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

            {/* Pro Tips Collapsible */}
            <details className="webhook-pro-tips">
              <summary>
                <span className="pro-tips-label">Pro Tips: Maximize Upload Speed</span>
              </summary>
              <div className="pro-tips-content">
                <div className="pro-tip-item">
                  <strong>Use Multiple Servers</strong>
                  <p>Spread webhooks across 2-3 different Discord servers. Each server has independent rate limits, so you'll bypass single-server throttling.</p>
                </div>
                <div className="pro-tip-item">
                  <strong>Optimal Setup</strong>
                  <p>3-5 webhooks across 2-3 servers. Mix a Level 3 boosted server (24MB chunks) with regular servers for best results.</p>
                </div>
                <div className="pro-tip-item">
                  <strong>Suggested Channel Names</strong>
                  <p className="channel-names">
                    <code>#wyvern-storage-1</code>
                    <code>#wyvern-storage-2</code>
                    <code>#wyvern-chunks</code>
                    <code>#file-vault</code>
                  </p>
                </div>
                <div className="pro-tip-item">
                  <strong>Privacy Tip</strong>
                  <p>Create channels in a private category. Set permissions so only you can view them.</p>
                </div>
              </div>
            </details>
          </section>

          {/* Server Boost Level Section */}
          <section className="settings-section">
            <div className="section-header">
              <Rocket size={18} />
              <h3>Server Boost Level</h3>
              {serverBoostLevel === 'level3' && (
                <span className="webhook-badge optimal">24MB chunks</span>
              )}
            </div>

            <p className="section-description">
              Select your Discord server's boost level. Level 3 servers allow 25MB file uploads, enabling 24MB chunks for 3x faster transfers.
            </p>

            <select
              className="settings-select"
              value={serverBoostLevel}
              onChange={(e) => setServerBoostLevel(e.target.value as ServerBoostLevel)}
            >
              <option value="none">No Boost (8MB limit)</option>
              <option value="level1">Level 1 (8MB limit)</option>
              <option value="level2">Level 2 (8MB limit)</option>
              <option value="level3">Level 3 (25MB limit)</option>
            </select>

            <div className="webhook-tip">
              <Rocket size={12} />
              <span>
                {serverBoostLevel === 'level3'
                  ? 'Using 24MB chunks for maximum upload speed!'
                  : 'Using 7.5MB chunks. Upgrade to Level 3 for 3x faster uploads.'
                }
              </span>
            </div>
          </section>
        </div>

        <div className="settings-footer">
          <button className="cancel-btn" onClick={handleClose}>
            Cancel
          </button>
          <button
            className="save-btn"
            onClick={handleSave}
            disabled={!canSave || isSaving}
          >
            <Save size={14} />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
