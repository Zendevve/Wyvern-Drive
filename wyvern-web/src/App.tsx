import { useState } from 'react'
import { FileManager } from './components/FileManager'
import { Sidebar } from './components/layout/Sidebar'
import { SetupScreen } from './components/SetupScreen'
import { useFileStore } from './stores/fileStore'
import './styles/App.css'

function App() {
  const { isAuthenticated } = useFileStore()

  if (!isAuthenticated) {
    return <SetupScreen />
  }

  return (
    <div className="app">
      <Sidebar />
      <main className="main-content">
        <FileManager />
      </main>
    </div>
  )
}

export default App
