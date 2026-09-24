package domain

import (
	"crypto/rand"
	"encoding/hex"
)

// NewID generates a 32-character lowercase hex ID from 16 crypto/rand
// bytes. Entropy errors are propagated to the caller.
func NewID() (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(b[:]), nil
}
