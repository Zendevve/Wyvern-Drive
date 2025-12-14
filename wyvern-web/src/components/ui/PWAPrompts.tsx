/**
 * PWA Prompts - Install and Update prompts
 */
import { useState, useEffect } from 'react'
import { Download, X, RefreshCw } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import './PWAPrompts.css'

// Extend Window interface for beforeinstallprompt
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * InstallPrompt - Shows when app can be installed
 */
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowPrompt(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      setShowPrompt(false)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    // Don't show again for this session
    sessionStorage.setItem('pwa-install-dismissed', 'true')
  }

  // Check if already dismissed this session
  useEffect(() => {
    if (sessionStorage.getItem('pwa-install-dismissed')) {
      setShowPrompt(false)
    }
  }, [])

  if (!showPrompt) return null

  return (
    <div className="install-prompt">
      <Download size={20} />
      <span>Install Wyvern Drive for quick access</span>
      <button onClick={handleInstall}>Install</button>
      <button onClick={handleDismiss}><X size={16} /></button>
    </div>
  )
}

/**
 * UpdatePrompt - Shows when new version is available
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW({
    onRegistered(r) {
      console.log('[PWA] Service worker registered:', r)
    },
    onRegisterError(error) {
      console.error('[PWA] Service worker registration error:', error)
    }
  })

  if (!needRefresh) return null

  return (
    <div className="update-prompt">
      <RefreshCw size={16} />
      <span>New version available!</span>
      <button onClick={() => updateServiceWorker(true)}>Update Now</button>
      <button onClick={() => setNeedRefresh(false)}>Later</button>
    </div>
  )
}
