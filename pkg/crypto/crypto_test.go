package crypto

import (
	"bytes"
	"crypto/rand"
	"strings"
	"testing"
)

func TestDeriveKey(t *testing.T) {
	pass := "super-secret-password-123"
	key1 := DeriveKey(pass, nil)
	key2 := DeriveKey(pass, nil)

	if len(key1) != KeySize {
		t.Fatalf("expected key size %d, got %d", KeySize, len(key1))
	}

	if !bytes.Equal(key1, key2) {
		t.Fatalf("deterministic derivation failed: keys do not match")
	}

	diffKey := DeriveKey("different-password", nil)
	if bytes.Equal(key1, diffKey) {
		t.Fatalf("different passwords produced identical keys")
	}
}

func TestEncryptDecryptChunk(t *testing.T) {
	key := DeriveKey("test-passphrase", nil)
	plaintext := []byte("Wyvern Drive: Discord Cloud Storage Engine Test Plaintext")

	ciphertext, nonce, err := EncryptChunk(plaintext, key)
	if err != nil {
		t.Fatalf("EncryptChunk failed: %v", err)
	}

	if len(nonce) != NonceSize {
		t.Fatalf("expected nonce size %d, got %d", NonceSize, len(nonce))
	}

	if bytes.Equal(ciphertext, plaintext) {
		t.Fatalf("ciphertext matches plaintext")
	}

	decrypted, err := DecryptChunk(ciphertext, key, nonce)
	if err != nil {
		t.Fatalf("DecryptChunk failed: %v", err)
	}

	if !bytes.Equal(decrypted, plaintext) {
		t.Fatalf("decrypted data does not match original plaintext")
	}
}

func TestTamperedCiphertext(t *testing.T) {
	key := DeriveKey("tamper-test", nil)
	plaintext := []byte("Don't tamper with my chunks!")

	ciphertext, nonce, err := EncryptChunk(plaintext, key)
	if err != nil {
		t.Fatalf("EncryptChunk failed: %v", err)
	}

	// Tamper with ciphertext
	ciphertext[0] ^= 0xFF

	_, err = DecryptChunk(ciphertext, key, nonce)
	if err == nil {
		t.Fatalf("expected decryption error on tampered ciphertext, got nil")
	}
}

func TestCalculateSHA256(t *testing.T) {
	data := []byte("hello wyvern")
	hash := CalculateSHA256(data)
	if len(hash) != 64 {
		t.Fatalf("expected 64 char hex hash, got %d", len(hash))
	}

	r := strings.NewReader("hello wyvern")
	streamHash, err := CalculateStreamSHA256(r)
	if err != nil {
		t.Fatalf("CalculateStreamSHA256 failed: %v", err)
	}
	if hash != streamHash {
		t.Fatalf("hash mismatch: %s != %s", hash, streamHash)
	}
}

func TestLargeChunkEncryption(t *testing.T) {
	key := DeriveKey("large-chunk-key", nil)
	// 5MB chunk
	largeData := make([]byte, 5*1024*1024)
	if _, err := rand.Read(largeData); err != nil {
		t.Fatalf("failed to generate random data: %v", err)
	}

	ciphertext, nonce, err := EncryptChunk(largeData, key)
	if err != nil {
		t.Fatalf("large chunk encryption failed: %v", err)
	}

	decrypted, err := DecryptChunk(ciphertext, key, nonce)
	if err != nil {
		t.Fatalf("large chunk decryption failed: %v", err)
	}

	if !bytes.Equal(decrypted, largeData) {
		t.Fatalf("decrypted large data does not match original")
	}
}
