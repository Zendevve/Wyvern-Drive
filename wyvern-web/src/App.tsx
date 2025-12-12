import { useEffect } from 'react'
import { FileManager } from './components/FileManager'
import { Sidebar } from './components/layout/Sidebar'
import { SetupScreen } from './components/SetupScreen'
import { RenameModal } from './components/files/RenameModal'
import { MoveModal } from './components/files/MoveModal'
import { ProgressToasts } from './components/ui/ProgressToasts'
import { useFileStore } from './stores/fileStore'
import './styles/App.css'

function App() {
  const { isAuthenticated, initializeManager, loadFiles } = useFileStore()

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
      <main className="main-content">
        <FileManager />
      </main>
      <RenameModal />
      <MoveModal />
      <ProgressToasts />
    </div>
  )
}

export default App
