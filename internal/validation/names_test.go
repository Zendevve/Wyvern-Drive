package validation_test

import (
	"errors"
	"strings"
	"testing"

	"wyvern-drive/internal/domain"
	"wyvern-drive/internal/validation"
)

func codeOf(t *testing.T, err error) domain.Code {
	t.Helper()
	var derr *domain.Error
	if !errors.As(err, &derr) {
		t.Fatalf("error %v (%T) is not a *domain.Error", err, err)
	}
	return derr.Code
}

// Casing variants of the same name can never become two folders,
// while display casing is always preserved.
func TestCaseVariantsCollideDisplayPreserved(t *testing.T) {
	d1, k1, err := validation.NormalizeName("Photo.jpg")
	if err != nil {
		t.Fatalf("NormalizeName: %v", err)
	}
	d2, k2, err := validation.NormalizeName("photo.JPG")
	if err != nil {
		t.Fatalf("NormalizeName: %v", err)
	}
	if k1 != k2 {
		t.Errorf("keys differ: %q vs %q", k1, k2)
	}
	if k1 != "photo.jpg" {
		t.Errorf("key = %q, want literal %q", k1, "photo.jpg")
	}
	if d1 != "Photo.jpg" || d2 != "photo.JPG" {
		t.Errorf("display not preserved: %q, %q", d1, d2)
	}
}

// Composed vs decomposed e-acute collide via NFC.
func TestComposedDecomposedEquivalence(t *testing.T) {
	_, kComposed, err := validation.NormalizeName("caf\u00e9")
	if err != nil {
		t.Fatalf("NormalizeName: %v", err)
	}
	_, kDecomposed, err := validation.NormalizeName("cafe\u0301")
	if err != nil {
		t.Fatalf("NormalizeName: %v", err)
	}
	if kComposed != kDecomposed {
		t.Errorf("keys differ: %q vs %q", kComposed, kDecomposed)
	}
	if kComposed != "caf\u00e9" {
		t.Errorf("key = %q, want literal %q", kComposed, "caf\u00e9")
	}
}

// Full case folding: Strasse vs STRASSE collide. No claim of
// accent-insensitive matching beyond fold equivalence.
func TestFoldEquivalence(t *testing.T) {
	_, k1, err := validation.NormalizeName("Stra\u00dfe")
	if err != nil {
		t.Fatalf("NormalizeName: %v", err)
	}
	_, k2, err := validation.NormalizeName("STRASSE")
	if err != nil {
		t.Fatalf("NormalizeName: %v", err)
	}
	if k1 != k2 {
		t.Errorf("keys differ: %q vs %q", k1, k2)
	}
	if k1 != "strasse" {
		t.Errorf("key = %q, want literal %q", k1, "strasse")
	}
}

func TestRejections(t *testing.T) {
	longName := strings.Repeat("a", 256)
	cases := map[string]string{
		"invalid UTF-8":       "\xff\xfe",
		"empty":               "",
		"whitespace-only":     "   ",
		"dot":                 ".",
		"dotdot":              "..",
		"slash":               "a/b",
		"backslash":           `a\b`,
		"control (Cc)":        "a\x01b",
		"format (Cf, ZWSP)":   "a\u200bb",
		"leading whitespace":  " name",
		"trailing whitespace": "name ",
		"over 255 bytes":      longName,
	}
	for name, input := range cases {
		t.Run(name, func(t *testing.T) {
			_, _, err := validation.NormalizeName(input)
			if err == nil {
				t.Fatalf("NormalizeName(%q) succeeded, want INVALID_NAME", input)
			}
			if codeOf(t, err) != domain.CodeInvalidName {
				t.Errorf("code = %q, want INVALID_NAME", codeOf(t, err))
			}
		})
	}
}

func TestMaxLengthBoundary(t *testing.T) {
	ok := strings.Repeat("a", 255)
	if _, _, err := validation.NormalizeName(ok); err != nil {
		t.Errorf("255-byte name rejected: %v", err)
	}
}

func TestValidNamesPassThrough(t *testing.T) {
	for _, n := range []string{"Notes", "Projects", "my doc (1).txt", "caf\u00e9", "фото"} {
		d, k, err := validation.NormalizeName(n)
		if err != nil {
			t.Errorf("NormalizeName(%q): %v", n, err)
			continue
		}
		if d == "" || k == "" {
			t.Errorf("NormalizeName(%q) returned empty display/key", n)
		}
	}
}
