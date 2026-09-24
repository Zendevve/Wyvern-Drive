//go:build windows && production

// Package frontendassets exposes the embedded production frontend build.
//
// The embed directive requires frontend/dist to be present, which is why
// the production compile order is: generate bindings (no dist needed),
// then the Vite build, then `go build -tags production ./cmd/desktop`.
// Only the build output is embedded — never node_modules, sources, or
// user data.
package frontendassets

import (
	"embed"
	"io/fs"
)

//go:embed all:dist
var embedded embed.FS

// Assets returns the production frontend build rooted at dist.
func Assets() (fs.FS, error) {
	return fs.Sub(embedded, "dist")
}
