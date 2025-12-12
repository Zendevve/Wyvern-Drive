# Development Setup

## Prerequisites

- Node.js 20+
- npm 10+
- Docker (for integration tests)
- Git

## Quick Start

```bash
# Clone repository
git clone <repo-url>
cd wyvern-drive

# Install dependencies
npm install

# Start development servers
npm run dev
```

## Project Structure

```
wyvern-drive/
├── wyvern-web/        # React web client
├── wyvern-server/     # Express API server
├── wyvern-extension/  # Chrome extension
├── docs/              # Documentation (MCAF)
└── AGENTS.md          # AI agent instructions
```

## Environment Variables

### Web Client
```env
VITE_API_URL=http://localhost:8080
VITE_EXTENSION_ID=<extension-id>
```

### Server
```env
PORT=8080
DB_URL=./wyvern.db
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all dev servers |
| `npm run build` | Build for production |
| `npm test` | Run all tests |
| `npm run lint` | Run ESLint |
