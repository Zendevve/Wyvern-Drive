package config

import (
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func envOf(vars map[string]string) func(string) (string, bool) {
	return func(k string) (string, bool) {
		v, ok := vars[k]
		return v, ok
	}
}

func writeConfigFile(t *testing.T, dataDir, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Join(dataDir, "config"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dataDir, "config", "config.json"), []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
}

func requireInvalidConfig(t *testing.T, err error) {
	t.Helper()
	if err == nil {
		t.Fatal("expected INVALID_CONFIG error, got nil")
	}
	if !strings.Contains(err.Error(), CodeInvalidConfig) {
		t.Fatalf("expected error code %q, got: %v", CodeInvalidConfig, err)
	}
	var usage *UsageError
	if errors.As(err, &usage) {
		t.Fatalf("expected value error, got usage error: %v", err)
	}
}

func requireUsageError(t *testing.T, err error) {
	t.Helper()
	var usage *UsageError
	if !errors.As(err, &usage) {
		t.Fatalf("expected usage error, got: %v", err)
	}
}

// Missing config means built-in defaults (plus the platform data directory).
func TestLoadMissingConfigMeansDefaults(t *testing.T) {
	dataDir := t.TempDir()
	localAppData := t.TempDir()
	cfg, err := Load([]string{"--data-dir", dataDir}, envOf(map[string]string{"LOCALAPPDATA": localAppData}))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ListenAddress != DefaultListenAddress {
		t.Fatalf("got listen %q, want default %q", cfg.ListenAddress, DefaultListenAddress)
	}
	if cfg.LogLevel != DefaultLogLevel {
		t.Fatalf("got level %q, want default %q", cfg.LogLevel, DefaultLogLevel)
	}
	if !filepath.IsAbs(cfg.DataDir) {
		t.Fatalf("data dir %q is not absolute", cfg.DataDir)
	}
}

// Flags override environment overrides file overrides defaults.
func TestLoadPrecedenceFlagsEnvFileDefaults(t *testing.T) {
	dataDir := t.TempDir()
	writeConfigFile(t, dataDir, `{"listen_address": "127.0.0.1:1111", "log_level": "debug"}`)

	// File values apply when nothing higher-precedence is set.
	cfg, err := Load([]string{"--data-dir", dataDir}, envOf(nil))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ListenAddress != "127.0.0.1:1111" {
		t.Fatalf("got listen %q, want file value", cfg.ListenAddress)
	}
	if cfg.LogLevel != "DEBUG" {
		t.Fatalf("got level %q, want normalized file value DEBUG", cfg.LogLevel)
	}

	// Environment overrides the file.
	env := map[string]string{"WYVERN_LISTEN": "127.0.0.1:2222", "WYVERN_LOG_LEVEL": "warn"}
	cfg, err = Load([]string{"--data-dir", dataDir}, envOf(env))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ListenAddress != "127.0.0.1:2222" {
		t.Fatalf("got listen %q, want env value", cfg.ListenAddress)
	}
	if cfg.LogLevel != "WARN" {
		t.Fatalf("got level %q, want env value WARN", cfg.LogLevel)
	}

	// Explicit flags override everything beneath them.
	cfg, err = Load([]string{"--data-dir", dataDir, "--listen", "127.0.0.1:3333", "--log-level", "error"}, envOf(env))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ListenAddress != "127.0.0.1:3333" {
		t.Fatalf("got listen %q, want flag value", cfg.ListenAddress)
	}
	if cfg.LogLevel != "ERROR" {
		t.Fatalf("got level %q, want flag value ERROR", cfg.LogLevel)
	}
}

// Omitted flags never erase configured file values.
func TestLoadOmittedFlagsDoNotEraseFileValues(t *testing.T) {
	dataDir := t.TempDir()
	writeConfigFile(t, dataDir, `{"listen_address": "127.0.0.1:5555", "log_level": "WARN"}`)
	cfg, err := Load([]string{"--data-dir", dataDir}, envOf(nil))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ListenAddress != "127.0.0.1:5555" || cfg.LogLevel != "WARN" {
		t.Fatalf("omitted flags erased file values: %+v", cfg)
	}
}

// Explicitly passed empty values fail validation.
func TestLoadExplicitEmptyValuesFail(t *testing.T) {
	dataDir := t.TempDir()
	for _, args := range [][]string{
		{"--data-dir", ""},
		{"--data-dir", dataDir, "--listen", ""},
		{"--data-dir", dataDir, "--log-level", ""},
	} {
		_, err := Load(args, envOf(nil))
		requireInvalidConfig(t, err)
	}

	// Explicitly empty JSON values fail as well.
	writeConfigFile(t, dataDir, `{"listen_address": ""}`)
	_, err := Load([]string{"--data-dir", dataDir}, envOf(nil))
	requireInvalidConfig(t, err)
}

func TestLoadUnknownFlagFails(t *testing.T) {
	_, err := Load([]string{"--bogus-flag", "x"}, envOf(nil))
	requireUsageError(t, err)
}

func TestLoadPositionalArgFails(t *testing.T) {
	_, err := Load([]string{"--data-dir", t.TempDir(), "extra"}, envOf(nil))
	requireUsageError(t, err)
}

func TestLoadHelpTouchesNoData(t *testing.T) {
	for _, args := range [][]string{{"-h"}, {"--help"}, {"-h", "--data-dir", "x"}} {
		_, err := Load(args, envOf(nil))
		if !errors.Is(err, ErrHelp) {
			t.Fatalf("args %q: expected ErrHelp, got: %v", args, err)
		}
	}
	// Unknown flags stay usage errors even when help is also present.
	_, err := Load([]string{"--bogus-flag", "-h"}, envOf(nil))
	requireUsageError(t, err)
}

func TestLoadMalformedJSONFails(t *testing.T) {
	dataDir := t.TempDir()
	writeConfigFile(t, dataDir, `{"listen_address": `)
	_, err := Load([]string{"--data-dir", dataDir}, envOf(nil))
	requireInvalidConfig(t, err)
}

func TestLoadTrailingJSONFails(t *testing.T) {
	dataDir := t.TempDir()
	writeConfigFile(t, dataDir, `{} {}`)
	_, err := Load([]string{"--data-dir", dataDir}, envOf(nil))
	requireInvalidConfig(t, err)
}

// Unknown keys fail, which is also what stops the config file from ever
// redirecting its own data directory.
func TestLoadUnknownKeysFail(t *testing.T) {
	for _, body := range []string{
		`{"data_dir": "/tmp/elsewhere"}`,
		`{"data-dir": "/tmp/elsewhere"}`,
		`{"DATA_DIR": "/tmp/elsewhere"}`,
		`{"listen": "127.0.0.1:9999"}`,
	} {
		dataDir := t.TempDir()
		writeConfigFile(t, dataDir, body)
		_, err := Load([]string{"--data-dir", dataDir}, envOf(nil))
		requireInvalidConfig(t, err)
	}
}

func TestLoadInvalidLogLevelsFail(t *testing.T) {
	dataDir := t.TempDir()
	for _, level := range []string{"VERBOSE", "TRACE", "WARNX", "123"} {
		_, err := Load([]string{"--data-dir", dataDir, "--log-level", level}, envOf(nil))
		requireInvalidConfig(t, err)
	}
	writeConfigFile(t, dataDir, `{"log_level": "nope"}`)
	_, err := Load([]string{"--data-dir", dataDir}, envOf(nil))
	requireInvalidConfig(t, err)
}

// Only numeric loopback addresses bind; hostnames, non-loopback IPs, and even
// other loopback-range IPs are refused with INVALID_CONFIG (ADR-0001).
func TestLoadNonLoopbackListenersFail(t *testing.T) {
	dataDir := t.TempDir()
	for _, addr := range []string{
		"0.0.0.0:9847",
		"192.168.1.10:9847",
		"10.0.0.5:9847",
		"127.0.0.2:9847",
		"localhost:9847",
		"example.com:9847",
		"127.0.0.1",
		"127.0.0.1:notaport",
		"127.0.0.1:0x50",
		"127.0.0.1:0",
		"127.0.0.1:65536",
		"127.0.0.1:-1",
	} {
		_, err := Load([]string{"--data-dir", dataDir, "--listen", addr}, envOf(nil))
		requireInvalidConfig(t, err)
	}
}

func TestLoadLoopbackListenersSucceed(t *testing.T) {
	dataDir := t.TempDir()
	for _, addr := range []string{"127.0.0.1:9847", "127.0.0.1:1", "127.0.0.1:65535", "[::1]:9847"} {
		cfg, err := Load([]string{"--data-dir", dataDir, "--listen", addr}, envOf(nil))
		if err != nil {
			t.Fatalf("addr %q: %v", addr, err)
		}
		if cfg.ListenAddress != addr {
			t.Fatalf("got listen %q, want %q", cfg.ListenAddress, addr)
		}
	}
}

// Ephemeral port 0 is rejected on the production path and accepted only via
// the explicit LoadAllowEphemeral test hook used by lifecycle tests.
func TestLoadEphemeralPortZeroRejectedByDefault(t *testing.T) {
	dataDir := t.TempDir()
	_, err := Load([]string{"--data-dir", dataDir, "--listen", "127.0.0.1:0"}, envOf(nil))
	requireInvalidConfig(t, err)
}

func TestLoadAllowEphemeralAcceptsPortZero(t *testing.T) {
	dataDir := t.TempDir()
	cfg, err := LoadAllowEphemeral([]string{"--data-dir", dataDir, "--listen", "127.0.0.1:0"}, envOf(nil))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ListenAddress != "127.0.0.1:0" {
		t.Fatalf("got listen %q", cfg.ListenAddress)
	}
}

// Relative explicit data directories resolve absolute.
func TestLoadRelativeDataDirResolvesAbsolute(t *testing.T) {
	cfg, err := Load([]string{"--data-dir", filepath.Join("some", "relative", "dir")}, envOf(nil))
	if err != nil {
		t.Fatal(err)
	}
	if !filepath.IsAbs(cfg.DataDir) {
		t.Fatalf("data dir %q is not absolute", cfg.DataDir)
	}
}

func TestLoadDataDirFromEnv(t *testing.T) {
	dataDir := t.TempDir()
	cfg, err := Load(nil, envOf(map[string]string{"WYVERN_DATA_DIR": dataDir}))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.DataDir != dataDir {
		t.Fatalf("got data dir %q, want %q", cfg.DataDir, dataDir)
	}
}

func TestLoadFlagDataDirBeatsEnv(t *testing.T) {
	flagDir := t.TempDir()
	envDir := t.TempDir()
	cfg, err := Load([]string{"--data-dir", flagDir}, envOf(map[string]string{"WYVERN_DATA_DIR": envDir}))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.DataDir != flagDir {
		t.Fatalf("got data dir %q, want flag value %q", cfg.DataDir, flagDir)
	}
}

// Empty Windows LOCALAPPDATA is an actionable configuration error.
func TestLoadEmptyWindowsLocalAppDataFails(t *testing.T) {
	_, err := Load(nil, envOf(map[string]string{"LOCALAPPDATA": ""}))
	requireInvalidConfig(t, err)
	_, err = Load(nil, envOf(nil))
	requireInvalidConfig(t, err)
}

func TestDefaultDataDirLinux(t *testing.T) {
	dir, err := defaultDataDir("linux", envOf(nil))
	if err != nil {
		t.Fatal(err)
	}
	if dir != "/var/lib/wyvern-drive" {
		t.Fatalf("got %q", dir)
	}
}

func TestDefaultDataDirWindows(t *testing.T) {
	base := t.TempDir()
	dir, err := defaultDataDir("windows", envOf(map[string]string{"LOCALAPPDATA": base}))
	if err != nil {
		t.Fatal(err)
	}
	if dir != filepath.Join(base, "Wyvern Drive") {
		t.Fatalf("got %q", dir)
	}
}

// An unreadable existing config file fails startup instead of being ignored.
func TestLoadUnreadableConfigFails(t *testing.T) {
	// POSIX permission bits do not restrict reads on Windows, so an
	// unreadable-file fixture is only meaningful elsewhere.
	if runtime.GOOS == "windows" {
		t.Skip("chmod-based unreadable fixture needs POSIX permissions")
	}
	dataDir := t.TempDir()
	writeConfigFile(t, dataDir, `{}`)
	path := filepath.Join(dataDir, "config", "config.json")
	if err := os.Chmod(path, 0); err != nil {
		t.Fatal(err)
	}
	defer func() { _ = os.Chmod(path, 0o600) }()
	_, err := Load([]string{"--data-dir", dataDir}, envOf(nil))
	requireInvalidConfig(t, err)
}

// Existing configuration is never overwritten by a load.
func TestLoadNeverOverwritesExistingConfig(t *testing.T) {
	dataDir := t.TempDir()
	body := `{"listen_address": "127.0.0.1:7777"}`
	writeConfigFile(t, dataDir, body)
	if _, err := Load([]string{"--data-dir", dataDir, "--listen", "127.0.0.1:8888"}, envOf(nil)); err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile(filepath.Join(dataDir, "config", "config.json"))
	if err != nil {
		t.Fatal(err)
	}
	if string(raw) != body {
		t.Fatalf("config file was rewritten: %q", raw)
	}
}
