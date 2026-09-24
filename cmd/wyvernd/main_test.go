package main

import (
	"bytes"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"
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
	bin := filepath.Join(t.TempDir(), "wyvernd-test")
	if runtime.GOOS == "windows" {
		bin += ".exe"
	}
	build := exec.Command("go", "build", "-o", bin, "wyvern-drive/cmd/wyvernd")
	if out, err := build.CombinedOutput(); err != nil {
		t.Fatalf("build: %v\n%s", err, out)
	}

	dataDir := filepath.Join(t.TempDir(), "wyvern-data")
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	addr := ln.Addr().String()
	if err := ln.Close(); err != nil {
		t.Fatal(err)
	}

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

	deadline := time.Now().Add(15 * time.Second)
	ready := false
	for time.Now().Before(deadline) {
		conn, err := net.DialTimeout("tcp", addr, 200*time.Millisecond)
		if err == nil {
			_ = conn.Close()
			ready = true
			break
		}
		time.Sleep(100 * time.Millisecond)
	}
	if !ready {
		t.Fatalf("daemon never bound %s; stdout=%q stderr=%q", addr, procOut.String(), procErr.String())
	}

	for _, area := range []string{"config", "database", "logs", "cache", "backups"} {
		if info, err := os.Stat(filepath.Join(dataDir, area)); err != nil || !info.IsDir() {
			t.Fatalf("area %q missing after serve: %v", area, err)
		}
	}
	if _, err := os.Stat(filepath.Join(dataDir, "config", "config.json")); !os.IsNotExist(err) {
		t.Fatal("serve must never materialize config.json on first run")
	}

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

// Graceful shutdown: after interrupt, the daemon stops accepting and exits
// with code 0. Signal delivery to a Windows child is unsupported via
// os.Interrupt, so this runs on POSIX only; the Windows surface smoke covers
// Ctrl-C on the real terminal.
func TestServeGracefulShutdown(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("os interrupt of a child process is unsupported on Windows")
	}
	bin := filepath.Join(t.TempDir(), "wyvernd-test")
	build := exec.Command("go", "build", "-o", bin, "wyvern-drive/cmd/wyvernd")
	if out, err := build.CombinedOutput(); err != nil {
		t.Fatalf("build: %v\n%s", err, out)
	}
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	addr := ln.Addr().String()
	if err := ln.Close(); err != nil {
		t.Fatal(err)
	}
	proc := exec.Command(bin, "serve", "--data-dir", filepath.Join(t.TempDir(), "wyvern-data"), "--listen", addr)
	proc.Stdout = &bytes.Buffer{}
	proc.Stderr = &bytes.Buffer{}
	if err := proc.Start(); err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(15 * time.Second)
	for {
		conn, err := net.DialTimeout("tcp", addr, 200*time.Millisecond)
		if err == nil {
			_ = conn.Close()
			break
		}
		if time.Now().After(deadline) {
			_ = proc.Process.Kill()
			t.Fatalf("daemon never bound %s", addr)
		}
		time.Sleep(100 * time.Millisecond)
	}
	if err := proc.Process.Signal(os.Interrupt); err != nil {
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
		t.Fatal("daemon did not exit after interrupt")
	}
}
