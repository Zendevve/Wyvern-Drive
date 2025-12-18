import { useState, useEffect, useRef } from 'react'
import { CheckCircle, X } from 'lucide-react'
import './SuccessToasts.css'

interface SuccessToast {
  id: string
  fileName: string
  type: 'upload' | 'download'
  timestamp: number
}

// Simple pub/sub for success events (avoids prop drilling)
const successCallbacks: ((toast: SuccessToast) => void)[] = []

export function addSuccessToast(fileName: string, type: 'upload' | 'download') {
  const toast: SuccessToast = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    fileName,
    type,
    timestamp: Date.now()
  }
  successCallbacks.forEach(cb => cb(toast))
}

export function SuccessToasts() {
  const [toasts, setToasts] = useState<SuccessToast[]>([])
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Subscribe to success events
  useEffect(() => {
    const callback = (toast: SuccessToast) => {
      setToasts(prev => [...prev, toast])

      // Auto-dismiss after 4 seconds
      const timeout = setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id))
        timeoutRefs.current.delete(toast.id)
      }, 4000)

      timeoutRefs.current.set(toast.id, timeout)
    }

    successCallbacks.push(callback)

    return () => {
      const index = successCallbacks.indexOf(callback)
      if (index >= 0) successCallbacks.splice(index, 1)

      // Clean up timeouts
      timeoutRefs.current.forEach(timeout => clearTimeout(timeout))
      timeoutRefs.current.clear()
    }
  }, [])

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    const timeout = timeoutRefs.current.get(id)
    if (timeout) {
      clearTimeout(timeout)
      timeoutRefs.current.delete(id)
    }
  }

  if (toasts.length === 0) return null

  return (
    <div className="success-toasts" role="status" aria-live="polite">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="success-toast"
          role="alert"
        >
          <div className="success-icon">
            <CheckCircle size={18} />
          </div>
          <div className="success-content">
            <span className="success-title">
              {toast.type === 'upload' ? 'Upload Complete' : 'Download Complete'}
            </span>
            <span className="success-filename" title={toast.fileName}>
              {truncateName(toast.fileName)}
            </span>
          </div>
          <button
            className="success-dismiss"
            onClick={() => dismissToast(toast.id)}
            aria-label={`Dismiss notification for ${toast.fileName}`}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

function truncateName(name: string, maxLen = 30): string {
  if (name.length <= maxLen) return name
  const ext = name.includes('.') ? '.' + name.split('.').pop() : ''
  const baseName = name.slice(0, name.length - ext.length)
  return baseName.slice(0, maxLen - ext.length - 3) + '...' + ext
}
