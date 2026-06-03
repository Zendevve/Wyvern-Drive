import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getDatabase } from './db/database.js';
import authRouter from './routes/auth.js';
import filesRouter from './routes/files.js';
import sharesRouter from './routes/shares.js';
import streamRouter from './routes/stream.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration supporting dynamic origins from localhost & frontend deployments
const ALLOWED_ORIGINS = [
  "https://wyvern-drive.netlify.app",
  "https://wyverndrive.netlify.app",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173"
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// Initialize SQLite database
getDatabase();

// Register routers
app.use('/api', authRouter);
app.use('/api', filesRouter);
app.use('/api', sharesRouter);
app.use('/api', streamRouter);

// Start server
const server = app.listen(PORT, () => {
  console.log(`[Wyvern Backend] Localhost server running at http://localhost:${PORT}`);
});

export { app, server };
