import express from 'express'
import cors from 'cors'
import { fileRouter } from './routes/files.js'
import { versionRouter } from './routes/versions.js'

const app = express()
const PORT = process.env.PORT || 8080

// Middleware
app.use(cors())
app.use(express.json())

// Routes
app.use('/files', fileRouter)
app.use('/versions', versionRouter)

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', name: 'Wyvern Drive Server' })
})

// Start server
app.listen(PORT, () => {
  console.log(`🐉 Wyvern Drive Server running on port ${PORT}`)
})
