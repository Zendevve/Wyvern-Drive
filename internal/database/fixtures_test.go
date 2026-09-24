package database

import (
	"testing/fstest"
)

// testFoundationFS mirrors the production foundation migration so database
// tests assert behavior without coupling to production SQL text.
func testFoundationFS() fstest.MapFS {
	return fstest.MapFS{
		"0001_foundation.sql": {Data: []byte("CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);")},
	}
}

// Two-version fixture: version 2 adds a note column the upgrade test can
// observe.
func testTwoVersionFS() fstest.MapFS {
	return fstest.MapFS{
		"0001_foundation.sql": {Data: []byte("CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);")},
		"0002_notes.sql":      {Data: []byte("ALTER TABLE settings ADD COLUMN note TEXT;")},
	}
}
