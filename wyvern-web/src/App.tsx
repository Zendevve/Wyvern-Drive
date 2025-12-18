import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Settings, Bell } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { supabase, getUserProfile } from './lib/supabase'
import { FileManager } from './components/FileManager'
import { PhotoTimeline } from './components/photos/PhotoTimeline'
import { Sidebar } from './components/layout/Sidebar'
import { AuthScreen } from './components/AuthScreen'

import { ShareView } from './components/ShareView'
import { LandingPage } from './components/LandingPage'
import { RenameModal } from './components/files/RenameModal'
import { MoveModal } from './components/files/MoveModal'
import { VersionHistoryModal } from './components/files/VersionHistoryModal'
import { ProgressToasts } from './components/ui/ProgressToasts'
import { GlobalSearch } from './components/ui/GlobalSearch'
import { OfflineIndicator } from './components/ui/OfflineIndicator'
import { InstallPrompt, UpdatePrompt } from './components/ui/PWAPrompts'
import { AudioPlayer } from './components/AudioPlayer'
import { MediaPlayer } from './components/MediaPlayer'
import { useFileStore } from './stores/fileStore'
import { registerStreamingListener } from './lib/streaming'
import './styles/App.css'

// Initialize streaming listener for Service Worker
registerStreamingListener()

function AuthenticatedApp() {
  const { initializeManager, webhookUrls, playingFile, setPlayingFile } = useFileStore()
  const [needsWebhookSetup, setNeedsWebhookSetup] = useState(false)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [session, setSession] = useState<Session | null>(null)

  // Load user profile and check if webhooks are configured
  useEffect(() => {
    const loadProfile = async () => {
      if (!session?.user) {
        setIsLoadingProfile(false)
        return
      }

      // PRIORITY 1: Check local webhooks first - if we have them, skip setup
      const localWebhooks = useFileStore.getState().webhookUrls
      if (localWebhooks.length > 0) {
        console.log('[App] Local webhooks found, skipping setup')
        setNeedsWebhookSetup(false)
        setIsLoadingProfile(false)

        // Set email if available
        if (session.user.email) {
          useFileStore.getState().setUserEmail(session.user.email)
        }
        return
      }

      // PRIORITY 2: Try loading from Supabase profile
      setIsLoadingProfile(true)
      try {
        const profile = await getUserProfile(session.user.id)
        if (session.user.email) {
          useFileStore.getState().setUserEmail(session.user.email)
        }
        console.log('[App] Loaded profile:', profile)

        const profileWebhooks = profile?.webhook_urls
        if (profileWebhooks && profileWebhooks.length > 0) {
          console.log('[App] Found webhooks in profile, loading...')
          useFileStore.getState().setWebhookUrls(profileWebhooks)
          setNeedsWebhookSetup(false)
        } else {
          // No webhooks anywhere - new user needs setup
          console.log('[App] New user, needs webhook setup')
          setNeedsWebhookSetup(true)
        }
      } catch (error) {
        console.error('[App] Failed to load profile:', error)
        // No local webhooks and profile failed - needs setup
        setNeedsWebhookSetup(true)
      } finally {
        setIsLoadingProfile(false)
      }
    }

    loadProfile()
  }, [session])

  // Initialize file manager after webhooks are loaded
  useEffect(() => {
    if (webhookUrls.length > 0 && !needsWebhookSetup && !isLoadingProfile) {
      initializeManager().then(() => {
        // IMPORTANT: Use getState() to get fresh state after initializeManager sets userId
        // The captured loadFiles closure has old state
        useFileStore.getState().loadFiles()
      })
    }
  }, [webhookUrls, needsWebhookSetup, isLoadingProfile, initializeManager])

  // Listen for auth state changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Show AuthScreen if not logged in
  if (!session) {
    return <AuthScreen />
  }

  // Show loading while checking profile (only if we don't have a user loaded yet)
  // This prevents the "flash" or reload when focusing the window
  if (isLoadingProfile && !useFileStore.getState().userId) {
    return (
      <div className="app-loading">
        <div className="loading-spinner" />
        <p>Loading your drive...</p>
      </div>
    )
  }

  // NOTE: WebhookSetup page removed - users configure webhooks in Settings modal

  return (
    <div className="app">
      {/* Accessibility: Skip link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[9999] focus:top-4 focus:left-4 focus:bg-accent focus:text-white focus:px-4 focus:py-2 focus:rounded-lg"
      >
        Skip to main content
      </a>

      <Sidebar />
      <div className="app-body">
        <header className="app-header">
          <GlobalSearch />

          <div className="header-actions">
            <button className="icon-btn" title="Settings"><Settings size={18} /></button>
            <button className="icon-btn" title="Notifications"><Bell size={18} /></button>
          </div>
        </header>

        <main id="main-content" className="main-content" role="main">
          <Routes>
            <Route path="/" element={<FileManager />} />
            <Route path="photos" element={<PhotoTimeline />} />
          </Routes>
        </main>
      </div>

      {/* Global Modals */}
      <RenameModal />
      <MoveModal />
      <VersionHistoryModal />
      <ProgressToasts />
      <AudioPlayer />

      {playingFile && (
        <MediaPlayer
          shareId={playingFile.id}
          fileName={playingFile.name}
          fileSize={playingFile.size}
          mimeType={playingFile.mimeType}
          onClose={() => setPlayingFile(null)}
        />
      )}

      {/* PWA Components */}
      <OfflineIndicator />
      <InstallPrompt />
      <UpdatePrompt />
    </div>
  )
}


function App() {
  return (
    <Routes>
      {/* Public routes - no auth required */}
      <Route path="/share/:shareId" element={<ShareView />} />
      <Route path="/" element={<LandingPage />} />
      <Route path="/signin" element={<AuthScreen defaultView="sign_in" />} />
      <Route path="/signup" element={<AuthScreen defaultView="sign_up" />} />

      {/* App routes - auth required */}
      <Route path="/app/*" element={<AuthenticatedApp />} />
    </Routes>
  )
}

export default App
