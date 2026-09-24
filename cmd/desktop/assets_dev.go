//go:build windows && !production

package main

import (
	"io/fs"
	"os"
)

// desktopAssets serves the built frontend directory in development builds.
// The Vite build must run first so frontend/dist exists.
func desktopAssets() (fs.FS, error) {
	return os.DirFS("frontend/dist"), nil
}
