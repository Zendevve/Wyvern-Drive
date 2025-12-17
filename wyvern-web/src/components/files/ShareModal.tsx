import { useState, useEffect } from 'react'
import { Copy, Check, Link2, Clock, Lock, X, AlertTriangle, Info, Heart } from 'lucide-react'
import { useFileStore } from '../../stores/fileStore'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import type { WyvernFile } from '../../lib/types'
import './ShareModal.css'

interface ShareModalProps {
  file: WyvernFile | null
  onClose: () => void
}

// Share links can only directly download files under 100MB (Backend proxy streaming limit)
const SHARE_SIZE_LIMIT = 100 * 1024 * 1024

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function ShareModal({ file, onClose }: ShareModalProps) {
  const { fileManager } = useFileStore()
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [expiresIn, setExpiresIn] = useState<string>('0') // hours, 0 = never
  const [password, setPassword] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Focus trap for accessibility
  const focusTrapRef = useFocusTrap(!!file, onClose)

  const isLargeFile = file && file.size > SHARE_SIZE_LIMIT

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
      <div
        className="share-modal"
        onClick={e => e.stopPropagation()}
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
      >
        <div className="modal-header">
          <h3 id="share-modal-title"><Link2 size={18} /> Share File</h3>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <p className="file-name">{file.name}</p>
          <p className="file-size-info">{formatSize(file.size)}</p>

          {/* File size limit warning */}
          {isLargeFile && (
            <div className="share-limit-banner">
              <div className="banner-icon">
                <AlertTriangle size={20} />
              </div>
              <div className="banner-content">
                <strong>File too large ({formatSize(file.size)})</strong>
                <p>Cannot share files larger than 100MB via web (requires extension).</p>
              </div>
            </div>
          )}

          {/* Donation prompt for large files */}
          {isLargeFile && (
            <div className="donation-banner">
              <div className="banner-icon">
                <Heart size={18} />
              </div>
              <div className="banner-content">
                <span>Want higher limits? <a href="https://github.com/sponsors" target="_blank" rel="noopener noreferrer" className="donation-link">Support us</a> to help cover storage costs.</span>
              </div>
            </div>
          )}

          {/* Small file info */}
          {!isLargeFile && (
            <div className="share-info-banner">
              <Info size={14} />
              <span>This file can be downloaded directly without the extension.</span>
            </div>
          )}

          {!shareUrl ? (
            <>
              {/* Expiry option */}
              <div className="option-row">
                <label><Clock size={14} /> Expires</label>
                <select value={expiresIn} onChange={e => setExpiresIn(e.target.value)}>
                  <option value="0">7 days (max)</option>
                  <option value="1">1 hour</option>
                  <option value="24">24 hours</option>
                  <option value="168">7 days</option>
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
                disabled={isCreating || !!isLargeFile}
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
