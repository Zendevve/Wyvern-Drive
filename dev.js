import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log('Starting Wyvern Drive in fully local mode...')

// Start Backend Express Server
const backend = spawn('npm', ['run', 'dev'], {
  cwd: path.join(__dirname, 'wyvern-backend'),
  stdio: 'inherit',
  shell: true
})

// Start Frontend Vite Dev Server
const frontend = spawn('npm', ['run', 'dev'], {
  cwd: path.join(__dirname, 'wyvern-web'),
  stdio: 'inherit',
  shell: true
})

function cleanup() {
  console.log('\nStopping servers...')
  try {
    backend.kill('SIGINT')
  } catch (e) {}
  try {
    frontend.kill('SIGINT')
  } catch (e) {}
  process.exit(0)
}

process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)

// Keep the main process alive
backend.on('exit', (code) => {
  console.log(`Backend process exited with code ${code}`)
  cleanup()
})

frontend.on('exit', (code) => {
  console.log(`Frontend process exited with code ${code}`)
  cleanup()
})
