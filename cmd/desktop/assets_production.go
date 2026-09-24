//go:build windows && production

package main

import (
	"io/fs"

	frontendassets "wyvern-drive/frontend"
)

// desktopAssets serves the embedded production frontend build.
func desktopAssets() (fs.FS, error) {
	return frontendassets.Assets()
}
