package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"

	"golang.org/x/crypto/argon2"
)

const (
	// SaltSize is the byte length for key derivation salt.
	SaltSize = 16
	// NonceSize is the byte length for AES-GCM nonce (12 bytes is standard).
	NonceSize = 12
	// KeySize is 32 bytes for AES-256.
	KeySize = 32
)

// DeriveKey derives a 32-byte AES-256 key from a passphrase and optional salt using Argon2id.
// If salt is nil or empty, a fixed application domain salt is used for deterministic derivation.
func DeriveKey(passphrase string, salt []byte) []byte {
	if len(salt) == 0 {
		h := sha256.Sum256([]byte("wyvern-drive-v1:" + passphrase))
		salt = h[:SaltSize]
	}
	// Argon2id with 1 time, 64MB memory, 4 threads, 32 bytes key length
	return argon2.IDKey([]byte(passphrase), salt, 1, 64*1024, 4, KeySize)
}

// GenerateRandomKey generates a secure random 32-byte hex-encoded key.
func GenerateRandomKey() (string, error) {
	b := make([]byte, KeySize)
	if _, err := io.ReadFull(rand.Reader, b); err != nil {
		return "", fmt.Errorf("failed to generate random key: %w", err)
	}
	return hex.EncodeToString(b), nil
}

// GenerateSalt creates a random 16-byte cryptographic salt.
func GenerateSalt() ([]byte, error) {
	salt := make([]byte, SaltSize)
	if _, err := io.ReadFull(rand.Reader, salt); err != nil {
		return nil, fmt.Errorf("failed to generate salt: %w", err)
	}
	return salt, nil
}

// EncryptChunk encrypts plaintext using AES-256-GCM.
// Returns ciphertext (including authentication tag) and the 12-byte nonce used.
func EncryptChunk(plaintext []byte, key []byte) (ciphertext []byte, nonce []byte, err error) {
	if len(key) != KeySize {
		return nil, nil, fmt.Errorf("invalid key size: expected %d bytes, got %d", KeySize, len(key))
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	nonce = make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, nil, fmt.Errorf("failed to generate nonce: %w", err)
	}

	ciphertext = gcm.Seal(nil, nonce, plaintext, nil)
	return ciphertext, nonce, nil
}

// DecryptChunk decrypts AES-256-GCM ciphertext using the given key and nonce.
func DecryptChunk(ciphertext []byte, key []byte, nonce []byte) ([]byte, error) {
	if len(key) != KeySize {
		return nil, fmt.Errorf("invalid key size: expected %d bytes, got %d", KeySize, len(key))
	}
	if len(nonce) != NonceSize {
		return nil, fmt.Errorf("invalid nonce size: expected %d bytes, got %d", NonceSize, len(nonce))
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, errors.New("decryption failed or chunk corrupted (authentication tag mismatch)")
	}

	return plaintext, nil
}

// CalculateSHA256 returns hex-encoded SHA-256 checksum of the byte slice.
func CalculateSHA256(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

// CalculateStreamSHA256 computes the SHA-256 checksum from an io.Reader.
func CalculateStreamSHA256(r io.Reader) (string, error) {
	h := sha256.New()
	if _, err := io.Copy(h, r); err != nil {
		return "", fmt.Errorf("failed to compute hash: %w", err)
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}
