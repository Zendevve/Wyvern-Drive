import { useEffect } from 'react'
import { FileManager } from './components/FileManager'
import { Sidebar } from './components/layout/Sidebar'
import { SetupScreen } from './components/SetupScreen'
import { RenameModal } from './components/files/RenameModal'
import { MoveModal } from './components/files/MoveModal'
import { VersionHistoryModal } from './components/files/VersionHistoryModal'
import { ProgressToasts } from './components/ui/ProgressToasts'
import { useFileStore } from './stores/fileStore'
import './styles/App.css'

function App() {
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
          <div className="search-container">
            <span className="search-icon">🔍</span>
            <input type="text" placeholder="Search your files..." className="global-search-input" />
          </div>

          <div className="header-actions">
            <button className="icon-btn" title="Settings">⚙️</button>
            <button className="icon-btn" title="Notifications">🔔</button>
          </div>
        </header>

        <main className="main-content">
          <FileManager />
        </main>
      </div>

      {/* Global Modals */}
      <RenameModal />
      <MoveModal />
      <VersionHistoryModal />
      <ProgressToasts />
    </div>
  )
}

export default App
