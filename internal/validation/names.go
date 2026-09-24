// Package validation holds virtual metadata name rules shared by every
// layer: casing variants of the same name can never become two folders,
// while display casing is always preserved.
package validation

import (
	"strings"
	"unicode"
	"unicode/utf8"

	"golang.org/x/text/cases"
	"golang.org/x/text/unicode/norm"

	"wyvern-drive/internal/domain"
)

// maxNameBytes caps display names at 255 UTF-8 bytes.
const maxNameBytes = 255

// fold cases once; cases.Fold does not normalize by itself, so callers apply
// NFC around the fold.
var fold = cases.Fold()

// NormalizeName validates a virtual metadata name and derives its lookup
// key. Display keeps NFC with original casing; key is NFC applied to the
// full case fold of display, so case variants (Photo.jpg vs photo.JPG,
// composed vs decomposed e-acute, Strasse vs STRASSE) collide while display
// preserves what the user typed. No claim of accent-insensitive matching is
// made beyond fold equivalence.
//
// Rejections carry INVALID_NAME. Names are never trimmed or sanitized.
func NormalizeName(name string) (display string, key string, err error) {
	if !utf8.ValidString(name) {
		return "", "", domain.New(domain.CodeInvalidName, "name is not valid UTF-8")
	}
	if strings.TrimSpace(name) == "" {
		return "", "", domain.New(domain.CodeInvalidName, "name must not be empty")
	}
	if name == "." || name == ".." {
		return "", "", domain.New(domain.CodeInvalidName, "name must not be \".\" or \"..\"")
	}
	if strings.ContainsAny(name, "/\\") {
		return "", "", domain.New(domain.CodeInvalidName, "name must not contain path separators")
	}
	for _, r := range name {
		if unicode.Is(unicode.Cc, r) {
			return "", "", domain.New(domain.CodeInvalidName, "name must not contain control characters")
		}
		if unicode.Is(unicode.Cf, r) {
			return "", "", domain.New(domain.CodeInvalidName, "name must not contain format characters")
		}
	}
	if strings.TrimSpace(name) != name {
		return "", "", domain.New(domain.CodeInvalidName, "name must not have leading or trailing whitespace")
	}
	display = norm.NFC.String(name)
	if len(display) > maxNameBytes {
		return "", "", domain.New(domain.CodeInvalidName, "name exceeds 255 bytes")
	}
	key = norm.NFC.String(fold.String(display))
	return display, key, nil
}
