/**
 * OfflineIndicator - Shows connectivity status
 */
import { useState, useEffect } from 'react'
import { WifiOff, Wifi } from 'lucide-react'
import { onConnectivityChange, isOnline } from '../../lib/offlineCache'
import './OfflineIndicator.css'

export function OfflineIndicator() {
  const [online, setOnline] = useState(isOnline())
  const [showReconnect, setShowReconnect] = useState(false)

  useEffect(() => {
    return onConnectivityChange((status) => {
      if (status && !online) {
        // Just came back online
        setShowReconnect(true)
        setTimeout(() => setShowReconnect(false), 3000)
      }
      setOnline(status)
    })
  }, [online])

  // Don't show anything if online and not showing reconnect message
  if (online && !showReconnect) return null

  return (
    <div className={`offline-indicator ${showReconnect ? 'reconnected' : ''}`}>
      {showReconnect ? (
        <>
          <Wifi size={14} />
          <span>Back online</span>
        </>
      ) : (
        <>
          <WifiOff size={14} />
          <span>You're offline - viewing cached data</span>
        </>
      )}
    </div>
  )
}
