// Package migrations embeds the immutable numbered schema migration files
// (*.sql) applied in version order by internal/database.Migrate.
//
// Files are immutable once released: the runner records a SHA-256 checksum of
// the exact bytes and refuses to start against a database whose applied
// checksums differ. Never edit a released file; add a new NNNN file instead.
package migrations

import "embed"

// FS holds every NNNN_description.sql migration in this directory.
//
//go:embed *.sql
var FS embed.FS
