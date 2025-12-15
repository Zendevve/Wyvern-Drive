import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Settings, Bell } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { supabase, getUserProfile, saveUserProfile } from './lib/supabase'
import { FileManager } from './components/FileManager'
import { PhotoTimeline } from './components/photos/PhotoTimeline'
import { Sidebar } from './components/layout/Sidebar'
import { AuthScreen } from './components/AuthScreen'
import { WebhookSetup } from './components/WebhookSetup'
import { ShareView } from './components/ShareView'
import { RenameModal } from './components/files/RenameModal'
import { MoveModal } from './components/files/MoveModal'
import { VersionHistoryModal } from './components/files/VersionHistoryModal'
import { ProgressToasts } from './components/ui/ProgressToasts'
import { GlobalSearch } from './components/ui/GlobalSearch'
import { OfflineIndicator } from './components/ui/OfflineIndicator'
import { InstallPrompt, UpdatePrompt } from './components/ui/PWAPrompts'
import { AudioPlayer } from './components/AudioPlayer'
import { useFileStore } from './stores/fileStore'
import './styles/App.css'

function AuthenticatedApp() {
  const { initializeManager, loadFiles, webhookUrls } = useFileStore()
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

      setIsLoadingProfile(true)
      try {
        const profile = await getUserProfile(session.user.id)
        if (session.user.email) {
          useFileStore.getState().setUserEmail(session.user.email)
        }
        console.log('[App] Loaded profile:', profile)

        if (profile && profile.webhook_urls && profile.webhook_urls.length > 0) {
          // Load webhooks from profile
          console.log('[App] Found webhooks in profile, loading...')
          useFileStore.getState().setWebhookUrls(profile.webhook_urls)
          setNeedsWebhookSetup(false)
        } else {
          // Check if we have webhooks in local store
          const localWebhooks = useFileStore.getState().webhookUrls
          if (localWebhooks.length > 0) {
            console.log('[App] Syncing local webhooks to profile...')
            await saveUserProfile(session.user.id, localWebhooks, false)
            setNeedsWebhookSetup(false)
          } else {
            // New user - needs webhook setup
            console.log('[App] New user, needs webhook setup')
            setNeedsWebhookSetup(true)
          }
        }
      } catch (error) {
        console.error('[App] Failed to load profile:', error)
        // Fall back to checking local store
        const localWebhooks = useFileStore.getState().webhookUrls
        setNeedsWebhookSetup(localWebhooks.length === 0)
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
        loadFiles()
      })
    }
  }, [webhookUrls, needsWebhookSetup, isLoadingProfile, initializeManager, loadFiles])

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

  // Show loading while checking profile
  if (isLoadingProfile) {
    return (
      <div className="app-loading">
        <div className="loading-spinner" />
        <p>Loading your drive...</p>
      </div>
    )
  }

  // Show WebhookSetup if user hasn't configured webhooks yet
  if (needsWebhookSetup) {
    return (
      <WebhookSetup
        onComplete={async (webhooks, password) => {
          // Save to store
          useFileStore.getState().setWebhookUrls(webhooks)
          if (password) {
            await useFileStore.getState().setEncryptionPassword(password)
          }

          // Save to Supabase profile
          if (session?.user) {
            await saveUserProfile(session.user.id, webhooks, !!password)
          }

          setNeedsWebhookSetup(false)
        }}
      />
    )
  }

  return (
    <div className="app">
      <Sidebar />
      <div className="app-body">
        <header className="app-header">
          <GlobalSearch />

          <div className="header-actions">
            <button className="icon-btn" title="Settings"><Settings size={18} /></button>
            <button className="icon-btn" title="Notifications"><Bell size={18} /></button>
          </div>
        </header>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<FileManager />} />
            <Route path="/photos" element={<PhotoTimeline />} />
          </Routes>
        </main>
      </div>

      {/* Global Modals */}
      <RenameModal />
      <MoveModal />
      <VersionHistoryModal />
      <ProgressToasts />
      <AudioPlayer />

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
      {/* Public share route - no auth required */}
      <Route path="/share/:shareId" element={<ShareView />} />

      {/* All other routes - auth required */}
      <Route path="/*" element={<AuthenticatedApp />} />
    </Routes>
  )
}

export default App
