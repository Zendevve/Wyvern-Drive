# How to Build Wyvern Drive from Source

This guide provides instructions to compile, test, and package the Wyvern Drive application on Windows, Linux, and macOS.

---

## 1. Prerequisites

Ensure the following tools are installed on your workstation:
- **Go**: Version 1.23 or newer ([golang.org/dl](https://golang.org/dl))
- **Node.js**: Version 18+ and **npm** 9+ ([nodejs.org](https://nodejs.org))
- **Wails CLI v2**: Version 2.10+ ([wails.io](https://wails.io/docs/gettingstarted/installation))
  ```bash
  go install github.com/wailsapp/wails/v2/cmd/wails@latest
  ```

---

## 2. Clone Repository & Install Dependencies

```bash
# Clone the repository
git clone https://github.com/your-org/wyvern-drive.git
cd wyvern-drive

# Download Go backend dependencies
go mod download

# Install React frontend dependencies
cd frontend
npm install
cd ..
```

---

## 3. Run Backend & Unit Tests

Execute the comprehensive Go test suite covering crypto, discord webhook client, SQLite storage, chunking engine, and streaming server:

```bash
go test -v ./...
```

Expected output:
```
ok  	wyvern-drive/pkg/crypto
ok  	wyvern-drive/pkg/discord
ok  	wyvern-drive/pkg/engine
ok  	wyvern-drive/pkg/server
ok  	wyvern-drive/pkg/storage
```

---

## 4. Launch in Development Live-Reload Mode

To run with live backend and frontend hot-reloading:

```bash
wails dev
```

This starts the Vite development server on `http://localhost:5173` and binds the native Wails desktop webview with hot module replacement (HMR).

---

## 5. Build Standalone Production Binary

To compile the self-contained production executable with embedded assets:

### Option A: Standard Go Build
```bash
# 1. Build optimized frontend production bundle
cd frontend && npm run build && cd ..

# 2. Compile standalone binary (bundles frontend dist via embed.FS)
go build -ldflags="-s -w" -o wyvern-drive.exe .
```

### Option B: Wails CLI Packaging
```bash
wails build -clean -nsis
```

The resulting binary (`wyvern-drive.exe` on Windows, `wyvern-drive` on Linux/macOS) is located in the project root or `build/bin/` folder.
