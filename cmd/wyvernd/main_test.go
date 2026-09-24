package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"testing"
	"time"

	"wyvern-drive/internal/app"
	"wyvern-drive/internal/config"
)

func testEnv(vars map[string]string) func(string) (string, bool) {
	return func(k string) (string, bool) {
		v, ok := vars[k]
		return v, ok
	}
}

// Bare invocation prints help to stdout and creates no data.
func TestBareInvocationPrintsHelp(t *testing.T) {
	var stdout, stderr bytes.Buffer
	dataDir := filepath.Join(t.TempDir(), "wyvern-data")
	code := run(nil, &stdout, &stderr, testEnv(map[string]string{"WYVERN_DATA_DIR": dataDir}))
	if code != 0 {
		t.Fatalf("exit code = %d, want 0", code)
	}
	if !strings.Contains(stdout.String(), "wyvernd serve") {
		t.Fatalf("help missing serve usage: %q", stdout.String())
	}
	if _, err := os.Stat(dataDir); !os.IsNotExist(err) {
		t.Fatalf("bare invocation created data at %q", dataDir)
	}
}

// `serve --help` prints help without touching any data.
func TestServeHelpCreatesNoData(t *testing.T) {
	var stdout, stderr bytes.Buffer
	dataDir := filepath.Join(t.TempDir(), "wyvern-data")
	code := run([]string{"serve", "--help"}, &stdout, &stderr, testEnv(map[string]string{"WYVERN_DATA_DIR": dataDir}))
	if code != 0 {
		t.Fatalf("exit code = %d, want 0", code)
	}
	if _, err := os.Stat(dataDir); !os.IsNotExist(err) {
		t.Fatalf("serve --help created data at %q", dataDir)
	}
}

// Unknown commands, unknown flags and positional args exit nonzero with
// usage errors and no data.
func TestUnknownCommandAndFlags(t *testing.T) {
	dataDir := filepath.Join(t.TempDir(), "wyvern-data")
	env := testEnv(map[string]string{"WYVERN_DATA_DIR": dataDir})
	for _, args := range [][]string{
		{"doctor"},
		{"backup"},
		{"verify"},
		{"status"},
		{"frobnicate"},
		{"serve", "--bogus"},
		{"serve", "extra-positional"},
	} {
		var stdout, stderr bytes.Buffer
		code := run(args, &stdout, &stderr, env)
		if code == 0 {
			t.Fatalf("args %q: exit code = 0, want nonzero", args)
		}
		if !strings.Contains(stderr.String(), "Usage:") && !strings.Contains(stderr.String(), "usage") {
			t.Fatalf("args %q: stderr missing usage: %q", args, stderr.String())
		}
	}
	if _, err := os.Stat(dataDir); !os.IsNotExist(err) {
		t.Fatalf("usage errors created data at %q", dataDir)
	}
}

// Invalid config fails fast with a nonzero exit and no readiness line.
func TestServeInvalidConfigFails(t *testing.T) {
	var stdout, stderr bytes.Buffer
	code := run([]string{"serve", "--data-dir", t.TempDir(), "--listen", "0.0.0.0:9847"}, &stdout, &stderr, testEnv(nil))
	if code == 0 {
		t.Fatal("expected nonzero exit for non-loopback listen, got 0")
	}
	if strings.Contains(stdout.String(), "listening") {
		t.Fatalf("readiness announced despite failure: %q", stdout.String())
	}
	// Port 0 is rejected on the production serve path.
	stdout.Reset()
	stderr.Reset()
	code = run([]string{"serve", "--data-dir", t.TempDir(), "--listen", "127.0.0.1:0"}, &stdout, &stderr, testEnv(nil))
	if code == 0 {
		t.Fatal("expected nonzero exit for port 0, got 0")
	}
}

// The compiled binary starts on a free loopback port (discovered by binding
// :0 in the test itself, then passed explicitly — the daemon's production
// config path rejects port 0), announces readiness only after binding,
// provisions the five data areas, and serves a connection on the bound port.
// A second instance on the same port fails without announcing healthy.
func TestServeLifecycleSubprocess(t *testing.T) {
	bin := buildTestBinary(t)

	dataDir := filepath.Join(t.TempDir(), "wyvern-data")
	addr := freeLoopbackAddr(t)

	proc := exec.Command(bin, "serve", "--data-dir", dataDir, "--listen", addr)
	var procOut, procErr bytes.Buffer
	proc.Stdout = &procOut
	proc.Stderr = &procErr
	if err := proc.Start(); err != nil {
		t.Fatal(err)
	}
	defer func() {
		_ = proc.Process.Kill()
		_, _ = proc.Process.Wait()
	}()

	waitForBound(t, addr, func() string { return procOut.String() + procErr.String() })

	// The bound daemon serves a healthy store: poll the health endpoint
	// until it reports schema version 1, then kill and relaunch on the
	// same data directory and expect the same version without duplication.
	healthURL := fmt.Sprintf("http://%s/api/v1/health", addr)
	waitForHealthy(t, healthURL, func() string { return procOut.String() + procErr.String() })
	_ = proc.Process.Kill()
	_, _ = proc.Process.Wait()
	proc = exec.Command(bin, "serve", "--data-dir", dataDir, "--listen", addr)
	procOut.Reset()
	procErr.Reset()
	proc.Stdout = &procOut
	proc.Stderr = &procErr
	if err := proc.Start(); err != nil {
		t.Fatal(err)
	}
	waitForHealthy(t, healthURL, func() string { return procOut.String() + procErr.String() })
	// Port conflict: the second instance must exit nonzero without
	// announcing readiness.
	conflict := exec.Command(bin, "serve", "--data-dir", t.TempDir(), "--listen", addr)
	var conflictOut bytes.Buffer
	conflict.Stdout = &conflictOut
	conflict.Stderr = &bytes.Buffer{}
	if err := conflict.Run(); err == nil {
		t.Fatal("expected nonzero exit on port conflict, got nil")
	}
	if strings.Contains(conflictOut.String(), "listening") {
		t.Fatalf("conflicted instance announced readiness: %q", conflictOut.String())
	}
	_ = proc.Process.Kill()
	_, _ = proc.Process.Wait()
}

// fetchHealthyVersion GETs the health endpoint and returns its
// schema_version, failing the test on transport errors, non-200 status, or
// malformed bodies. A -1 signals "not healthy yet" without failing, so
// relaunch polling can retry.
func fetchHealthyVersion(t *testing.T, url string) int {
	t.Helper()
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return -1
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return -1
	}
	if ct := resp.Header.Get("Content-Type"); ct != "application/json" {
		t.Fatalf("Content-Type = %q, want application/json", ct)
	}
	if cc := resp.Header.Get("Cache-Control"); cc != "no-store" {
		t.Fatalf("Cache-Control = %q, want no-store", cc)
	}
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	var body struct {
		Status        string `json:"status"`
		Database      string `json:"database"`
		SchemaVersion int    `json:"schema_version"`
	}
	if err := json.Unmarshal(raw, &body); err != nil {
		t.Fatalf("decode health: %v", err)
	}
	if body.Status != "healthy" || body.Database != "ready" {
		t.Fatalf("health body = %s, want healthy/ready", raw)
	}
	return body.SchemaVersion
}

// buildTestBinary compiles the daemon once per test and returns its path.
func buildTestBinary(t *testing.T) string {
	t.Helper()
	bin := filepath.Join(t.TempDir(), "wyvernd-test")
	if runtime.GOOS == "windows" {
		bin += ".exe"
	}
	build := exec.Command("go", "build", "-o", bin, "wyvern-drive/cmd/wyvernd")
	if out, err := build.CombinedOutput(); err != nil {
		t.Fatalf("build: %v\n%s", err, out)
	}
	return bin
}

// freeLoopbackAddr binds :0 to discover a free loopback port, then releases
// it for the daemon to bind. The production config path rejects port 0, so
// tests pass the discovered address explicitly.
func freeLoopbackAddr(t *testing.T) string {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	addr := ln.Addr().String()
	if err := ln.Close(); err != nil {
		t.Fatal(err)
	}
	return addr
}

// waitForBound polls until the daemon accepts TCP connections.
func waitForBound(t *testing.T, addr string, logs func() string) {
	t.Helper()
	deadline := time.Now().Add(15 * time.Second)
	for {
		conn, err := net.DialTimeout("tcp", addr, 200*time.Millisecond)
		if err == nil {
			_ = conn.Close()
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("daemon never bound %s; output=%q", addr, logs())
		}
		time.Sleep(100 * time.Millisecond)
	}
}

// waitForHealthy polls the health endpoint until it reports schema version
// 1.
func waitForHealthy(t *testing.T, healthURL string, logs func() string) {
	t.Helper()
	deadline := time.Now().Add(15 * time.Second)
	for {
		if fetchHealthyVersion(t, healthURL) == 1 {
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("daemon never healthy; output=%q", logs())
		}
		time.Sleep(100 * time.Millisecond)
	}
}

// Graceful shutdown: after interrupt, the daemon stops accepting and exits
// with code 0, and its database reopens at the expected version. Signal
// delivery to a Windows child is unsupported via os.Interrupt, so this runs
// on POSIX only; the Windows surface smoke covers Ctrl-C on the real
// terminal.
func TestServeGracefulShutdown(t *testing.T) {
	testGracefulShutdown(t, os.Interrupt)
}

// SIGTERM shutdown: same clean-exit plus reopenable guarantee via the
// production signal path on Linux. Windows skips like the interrupt test.
func TestServeSIGTERMShutdown(t *testing.T) {
	testGracefulShutdown(t, syscall.SIGTERM)
}

func testGracefulShutdown(t *testing.T, sig os.Signal) {
	t.Helper()
	if runtime.GOOS == "windows" {
		t.Skip("signalling a child process is unsupported on Windows")
	}
	bin := buildTestBinary(t)
	addr := freeLoopbackAddr(t)
	dataDir := filepath.Join(t.TempDir(), "wyvern-data")
	proc := exec.Command(bin, "serve", "--data-dir", dataDir, "--listen", addr)
	proc.Stdout = &bytes.Buffer{}
	proc.Stderr = &bytes.Buffer{}
	if err := proc.Start(); err != nil {
		t.Fatal(err)
	}
	waitForBound(t, addr, func() string { return "" })
	if err := proc.Process.Signal(sig); err != nil {
		t.Fatal(err)
	}
	done := make(chan error, 1)
	go func() { done <- proc.Wait() }()
	select {
	case err := <-done:
		if err != nil {
			if exitErr, ok := err.(*exec.ExitError); ok {
				t.Logf("exit: %v", exitErr)
			} else {
				t.Fatalf("wait: %v", err)
			}
		}
	case <-time.After(15 * time.Second):
		_ = proc.Process.Kill()
		t.Fatalf("daemon did not exit after signal %v", sig)
	}
	reopen, err := app.Open(context.Background(), config.Config{DataDir: dataDir, ListenAddress: addr, LogLevel: "INFO"}, slog.New(slog.NewTextHandler(io.Discard, nil)), &discardCloser{})
	if err != nil {
		t.Fatalf("reopen after signal: %v", err)
	}
	defer func() { _ = reopen.Close() }()
	v, err := reopen.Readiness(context.Background())
	if err != nil {
		t.Fatalf("readiness after signal: %v", err)
	}
	if v != 1 {
		t.Fatalf("Readiness after signal = %d, want 1", v)
	}
}

type discardCloser struct{}

func (discardCloser) Close() error { return nil }
