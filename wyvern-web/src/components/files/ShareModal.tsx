import { useState, useEffect } from 'react'
import { Copy, Check, Link2, Clock, Lock, X } from 'lucide-react'
import { useFileStore } from '../../stores/fileStore'
import type { WyvernFile } from '../../lib/types'
import './ShareModal.css'

interface ShareModalProps {
  file: WyvernFile | null
  onClose: () => void
}

export function ShareModal({ file, onClose }: ShareModalProps) {
  const { fileManager } = useFileStore()
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [expiresIn, setExpiresIn] = useState<string>('0') // hours, 0 = never
  const [password, setPassword] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Reset state when file changes
    setShareUrl(null)
    setExpiresIn('0')
    setPassword('')
    setCopied(false)
    setError(null)
  }, [file?.id])

  if (!file) return null

  const handleCreate = async () => {
    if (!fileManager) return
    setIsCreating(true)
    setError(null)

    try {
      const result = await fileManager.createShareLink(file.id, {
        expiresIn: expiresIn !== '0' ? parseInt(expiresIn) : undefined,
        password: password || undefined
      })

      // Build full URL
      const baseUrl = window.location.origin
      const fullUrl = `${baseUrl}/share/${result.id}`
      setShareUrl(fullUrl)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsCreating(false)
    }
  }

  const handleCopy = async () => {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="share-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3><Link2 size={18} /> Share File</h3>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <p className="file-name">{file.name}</p>

          {!shareUrl ? (
            <>
              {/* Expiry option */}
              <div className="option-row">
                <label><Clock size={14} /> Expires</label>
                <select value={expiresIn} onChange={e => setExpiresIn(e.target.value)}>
                  <option value="0">Never</option>
                  <option value="1">1 hour</option>
                  <option value="24">24 hours</option>
                  <option value="168">7 days</option>
                  <option value="720">30 days</option>
                </select>
              </div>

              {/* Password option */}
              <div className="option-row">
                <label><Lock size={14} /> Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Optional"
                />
              </div>

              {error && <p className="error-text">{error}</p>}

              <button
                className="create-btn"
                onClick={handleCreate}
                disabled={isCreating}
              >
                {isCreating ? 'Creating...' : 'Create Share Link'}
              </button>
            </>
          ) : (
            <>
              {/* Share URL display */}
              <div className="share-url-box">
                <input type="text" value={shareUrl} readOnly />
                <button className="copy-btn" onClick={handleCopy}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
              {password && (
                <p className="password-note">
                  <Lock size={14} /> Password protected: <code>{password}</code>
                </p>
              )}

              <button className="done-btn" onClick={onClose}>
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
