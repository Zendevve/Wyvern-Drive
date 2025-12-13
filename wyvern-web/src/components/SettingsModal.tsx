import { useState, useEffect } from 'react'
import { X, Zap, Plus, Minus, Save } from 'lucide-react'
import { useFileStore } from '../stores/fileStore'
import './SettingsModal.css'

export function SettingsModal() {
  const { activeModal, setActiveModal, webhookUrls, updateWebhooks, getWebhookPoolStats } = useFileStore()
  const [webhooks, setWebhooks] = useState<string[]>([''])
  const [isSaving, setIsSaving] = useState(false)

  // Initialize webhooks from store when modal opens
  useEffect(() => {
    if (activeModal === 'settings') {
      setWebhooks(webhookUrls.length > 0 ? [...webhookUrls] : [''])
    }
  }, [activeModal, webhookUrls])

  if (activeModal !== 'settings') return null

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

  const handleClose = () => {
    setActiveModal(null)
  }

  return (
    <div className="settings-modal-overlay" onClick={handleClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
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
                      : `${validWebhooks.length} webhooks — Optimal configuration! 🚀`
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
