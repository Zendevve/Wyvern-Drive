// Package config resolves the effective Wyvern Drive daemon configuration.
//
// Precedence, highest first:
//
//  1. Explicitly passed flags (--data-dir, --listen, --log-level).
//  2. Environment variables (WYVERN_DATA_DIR, WYVERN_LISTEN, WYVERN_LOG_LEVEL).
//  3. The JSON config file at <data-dir>/config/config.json.
//  4. Built-in defaults (127.0.0.1:9847, INFO).
//
// The config file can never redirect its own data directory: it accepts only
// the keys listen_address and log_level, and any other key (including any
// data-directory key) fails startup as an unknown key.
package config

import (
	"bytes"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"net"
	"net/netip"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
)

// Built-in defaults applied when no higher-precedence source provides a value.
const (
	DefaultListenAddress = "127.0.0.1:9847"
	DefaultLogLevel      = "INFO"
)

// CodeInvalidConfig is the stable error code for every configuration failure.
// Per ADR-0001 there is no override flag for the loopback-only bind: a
// non-loopback listen address fails startup with this code.
const CodeInvalidConfig = "INVALID_CONFIG"

// Config is the resolved daemon configuration.
type Config struct {
	// DataDir is the absolute data directory. Explicit values (flag or
	// environment) are resolved absolute; platform defaults already are.
	DataDir string
	// ListenAddress is a numeric loopback host:port pair (127.0.0.1 or ::1).
	ListenAddress string
	// LogLevel is normalized to upper case: DEBUG, INFO, WARN or ERROR.
	LogLevel string
}

// ConfigPath returns the location of the JSON config file for the resolved
// data directory. The file is never consulted for the data directory itself.
func (c Config) ConfigPath() string {
	return filepath.Join(c.DataDir, "config", "config.json")
}

// Error is a configuration failure carrying a stable machine-readable code.
type Error struct {
	Code    string
	Message string
}

func (e *Error) Error() string { return e.Code + ": " + e.Message }

func invalidConfigf(format string, args ...any) *Error {
	return &Error{Code: CodeInvalidConfig, Message: fmt.Sprintf(format, args...)}
}

// ErrHelp signals a help request (-h/--help). Load returns it before
// touching any data, so help output never creates or reads configuration.
var ErrHelp = errors.New("help requested")

// UsageError marks command-line syntax failures (unknown flags, positional
// arguments) as opposed to configuration value failures. Callers map it to
// usage output and exit code 2; every other error from Load is a
// CodeInvalidConfig value failure exiting 1.
type UsageError struct {
	Message string
}

func (e *UsageError) Error() string { return e.Message }

// Load resolves the effective configuration. args are the CLI arguments
// excluding the program name (for `wyvernd serve`, excluding "serve").
// lookupEnv supplies environment lookups; nil means os.LookupEnv.
//
// The production listen port range is 1-65535: ephemeral port 0 is rejected
// so a zero port can never reach a running daemon. Tests needing an
// ephemeral port use LoadAllowEphemeral instead.
//
// Missing config means defaults and the existing configuration is never
// overwritten; Load performs no writes at all. Malformed JSON, unknown keys,
// invalid levels/addresses, explicitly passed empty values, and unreadable
// existing config files all fail startup with CodeInvalidConfig. Help
// requests (-h/--help) return ErrHelp before touching any data; unknown
// flags and positional arguments return a *UsageError.
func Load(args []string, lookupEnv func(string) (string, bool)) (Config, error) {
	return load(args, lookupEnv, false)
}

// LoadAllowEphemeral is Load with ephemeral port 0 accepted. It exists for
// subprocess lifecycle tests that bind a free loopback port; the daemon
// entry point never calls it.
func LoadAllowEphemeral(args []string, lookupEnv func(string) (string, bool)) (Config, error) {
	return load(args, lookupEnv, true)
}

func load(args []string, lookupEnv func(string) (string, bool), allowEphemeral bool) (Config, error) {
	if lookupEnv == nil {
		lookupEnv = os.LookupEnv
	}

	var flagDataDir, flagListen, flagLogLevel string
	var showHelp bool
	fs := flag.NewFlagSet("wyvernd serve", flag.ContinueOnError)
	var flagOutput bytes.Buffer
	fs.SetOutput(&flagOutput)
	fs.StringVar(&flagDataDir, "data-dir", "", "data directory (default platform data dir)")
	fs.StringVar(&flagListen, "listen", "", "listen address, numeric loopback only (default "+DefaultListenAddress+")")
	fs.StringVar(&flagLogLevel, "log-level", "", "log level DEBUG, INFO, WARN or ERROR (default "+DefaultLogLevel+")")
	fs.BoolVar(&showHelp, "h", false, "print help")
	fs.BoolVar(&showHelp, "help", false, "print help")
	if err := fs.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return Config{}, ErrHelp
		}
		return Config{}, &UsageError{Message: fmt.Sprintf("invalid flags: %v", err)}
	}
	if showHelp {
		return Config{}, ErrHelp
	}
	if fs.NArg() > 0 {
		return Config{}, &UsageError{Message: fmt.Sprintf("unexpected argument %q", fs.Arg(0))}
	}

	dataDir, err := resolveDataDir(fs, flagDataDir, lookupEnv)
	if err != nil {
		return Config{}, err
	}

	var file fileConfig
	configPath := filepath.Join(dataDir, "config", "config.json")
	raw, err := os.ReadFile(configPath)
	switch {
	case err == nil:
		dec := json.NewDecoder(bytes.NewReader(raw))
		dec.DisallowUnknownFields()
		if err := dec.Decode(&file); err != nil {
			return Config{}, invalidConfigf("malformed config file: %v", err)
		}
		if dec.More() {
			return Config{}, invalidConfigf("malformed config file: trailing data")
		}
	case os.IsNotExist(err):
		// Missing config means defaults.
	default:
		return Config{}, invalidConfigf("unreadable config file: %v", err)
	}

	listen := DefaultListenAddress
	if file.ListenAddress != nil {
		listen = *file.ListenAddress
	}
	if v, ok := lookupEnv("WYVERN_LISTEN"); ok && v != "" {
		listen = v
	}
	if visited(fs, "listen") {
		if flagListen == "" {
			return Config{}, invalidConfigf("--listen must not be empty")
		}
		listen = flagListen
	}
	if err := validateListenAddress(listen, allowEphemeral); err != nil {
		return Config{}, err
	}

	level := DefaultLogLevel
	if file.LogLevel != nil {
		level = *file.LogLevel
	}
	if v, ok := lookupEnv("WYVERN_LOG_LEVEL"); ok && v != "" {
		level = v
	}
	if visited(fs, "log-level") {
		if flagLogLevel == "" {
			return Config{}, invalidConfigf("--log-level must not be empty")
		}
		level = flagLogLevel
	}
	normalized, err := normalizeLogLevel(level)
	if err != nil {
		return Config{}, err
	}

	return Config{DataDir: dataDir, ListenAddress: listen, LogLevel: normalized}, nil
}

// fileConfig mirrors the JSON config file. Pointer fields distinguish omitted
// keys (defaults apply) from explicitly supplied values (validated, so an
// explicit empty value fails). There is deliberately no data-directory key:
// the config file can never redirect its own data directory.
type fileConfig struct {
	ListenAddress *string `json:"listen_address"`
	LogLevel      *string `json:"log_level"`
}

func visited(fs *flag.FlagSet, name string) bool {
	found := false
	fs.Visit(func(f *flag.Flag) {
		if f.Name == name {
			found = true
		}
	})
	return found
}

// resolveDataDir resolves the data directory from the flag, then the
// environment, then the platform default. Explicit relative paths (flag or
// environment) resolve absolute. An explicitly passed empty flag value fails;
// an empty environment value is treated as unset.
func resolveDataDir(fs *flag.FlagSet, flagDataDir string, lookupEnv func(string) (string, bool)) (string, error) {
	if visited(fs, "data-dir") {
		if flagDataDir == "" {
			return "", invalidConfigf("--data-dir must not be empty")
		}
		abs, err := filepath.Abs(flagDataDir)
		if err != nil {
			return "", invalidConfigf("invalid --data-dir: %v", err)
		}
		return abs, nil
	}
	if v, ok := lookupEnv("WYVERN_DATA_DIR"); ok && v != "" {
		abs, err := filepath.Abs(v)
		if err != nil {
			return "", invalidConfigf("invalid WYVERN_DATA_DIR: %v", err)
		}
		return abs, nil
	}
	return defaultDataDir(runtime.GOOS, lookupEnv)
}

// defaultDataDir returns the platform data directory. goos is a parameter
// (rather than runtime.GOOS directly) so tests can cover every platform. An
// empty Windows LOCALAPPDATA is an actionable configuration error, not a
// silent relative fallback.
func defaultDataDir(goos string, lookupEnv func(string) (string, bool)) (string, error) {
	if goos == "windows" {
		base, ok := lookupEnv("LOCALAPPDATA")
		if !ok || base == "" {
			return "", invalidConfigf("LOCALAPPDATA is not set or empty: pass --data-dir or set WYVERN_DATA_DIR to choose a data directory")
		}
		return filepath.Join(base, "Wyvern Drive"), nil
	}
	return "/var/lib/wyvern-drive", nil
}

// validateListenAddress accepts only numeric loopback addresses (127.0.0.1 or
// ::1, parsed via net.SplitHostPort and netip, never ad-hoc splitting).
// Production accepts ports 1-65535; allowEphemeral additionally accepts port
// 0 for subprocess lifecycle tests. Anything else fails with CodeInvalidConfig
// and no override flag exists (ADR-0001).
func validateListenAddress(addr string, allowEphemeral bool) error {
	host, portStr, err := net.SplitHostPort(addr)
	if err != nil {
		return invalidConfigf("invalid listen address: must be host:port")
	}
	minPort := 1
	if allowEphemeral {
		minPort = 0
	}
	port, err := strconv.Atoi(portStr)
	if err != nil || port < minPort || port > 65535 {
		if allowEphemeral {
			return invalidConfigf("invalid listen port: must be 0-65535")
		}
		return invalidConfigf("invalid listen port: must be 1-65535")
	}
	ip, err := netip.ParseAddr(host)
	if err != nil {
		return invalidConfigf("invalid listen address: host must be a numeric IP address")
	}
	if ip.String() != "127.0.0.1" && ip.String() != "::1" {
		return invalidConfigf("invalid listen address: only 127.0.0.1 or ::1 may be used (loopback-only bind, no override exists)")
	}
	return nil
}

// normalizeLogLevel accepts DEBUG, INFO, WARN or ERROR case-insensitively and
// returns the upper-case form.
func normalizeLogLevel(s string) (string, error) {
	switch normalized := strings.ToUpper(strings.TrimSpace(s)); normalized {
	case "DEBUG", "INFO", "WARN", "ERROR":
		return normalized, nil
	default:
		return "", invalidConfigf("invalid log level: must be DEBUG, INFO, WARN or ERROR")
	}
}
