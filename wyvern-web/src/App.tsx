import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Settings, Bell } from 'lucide-react'
import { FileManager } from './components/FileManager'
import { PhotoTimeline } from './components/photos/PhotoTimeline'
import { Sidebar } from './components/layout/Sidebar'
import { SetupScreen } from './components/SetupScreen'
import { ShareView } from './components/ShareView'
import { RenameModal } from './components/files/RenameModal'
import { MoveModal } from './components/files/MoveModal'
import { VersionHistoryModal } from './components/files/VersionHistoryModal'
import { ProgressToasts } from './components/ui/ProgressToasts'
import { GlobalSearch } from './components/ui/GlobalSearch'
import { AudioPlayer } from './components/AudioPlayer'
import { useFileStore } from './stores/fileStore'
import './styles/App.css'

function AuthenticatedApp() {
  const { isAuthenticated, initializeManager, loadFiles } = useFileStore()

  // Initialize file manager and load files after authentication
  useEffect(() => {
    if (isAuthenticated) {
      initializeManager().then(() => {
        loadFiles()
      })
    }
  }, [isAuthenticated, initializeManager, loadFiles])

  if (!isAuthenticated) {
    return <SetupScreen />
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
