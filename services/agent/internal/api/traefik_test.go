package api

import (
	"os"
	"strings"
	"testing"
)

func TestTraefikHostRule(t *testing.T) {
	got := traefikHostRule("example.com")
	want := "HostRegexp(`^(.+\\.)?example\\.com$`)"
	if got != want {
		t.Fatalf("traefikHostRule() = %q, want %q", got, want)
	}
}

func TestTraefikLabelsHTTPChallenge(t *testing.T) {
	t.Setenv("ACME_WILDCARD_CERTS", "")
	t.Setenv("ACME_CERT_RESOLVER", "")

	labels := traefikLabels("abc", "example.com", 8080, true)
	joined := strings.Join(labels, "\n")

	if !strings.Contains(joined, "tls.certresolver=letsencrypt") {
		t.Fatalf("expected HTTP-01 resolver, got:\n%s", joined)
	}
	if strings.Contains(joined, "tls.domains") {
		t.Fatalf("unexpected wildcard domains with HTTP-01:\n%s", joined)
	}
}

func TestTraefikLabelsDNSWildcard(t *testing.T) {
	t.Setenv("ACME_WILDCARD_CERTS", "1")
	t.Setenv("ACME_CERT_RESOLVER", "")

	labels := traefikLabels("abc", "example.com", 8080, true)
	joined := strings.Join(labels, "\n")

	if !strings.Contains(joined, "tls.certresolver=letsencrypt-dns") {
		t.Fatalf("expected DNS resolver, got:\n%s", joined)
	}
	if !strings.Contains(joined, "tls.domains[0].main=example.com") {
		t.Fatalf("expected apex domain, got:\n%s", joined)
	}
	if !strings.Contains(joined, "tls.domains[0].sans=*.example.com") {
		t.Fatalf("expected wildcard SAN, got:\n%s", joined)
	}
}

func TestAcmeCertResolverOverride(t *testing.T) {
	t.Setenv("ACME_WILDCARD_CERTS", "")
	t.Setenv("ACME_CERT_RESOLVER", "letsencrypt-dns")

	if got := acmeCertResolver(); got != "letsencrypt-dns" {
		t.Fatalf("acmeCertResolver() = %q, want letsencrypt-dns", got)
	}
	if !acmeWildcardEnabled() {
		t.Fatal("acmeWildcardEnabled() should be true for letsencrypt-dns resolver")
	}
}

func TestTraefikLabelsNoHTTPS(t *testing.T) {
	labels := traefikLabels("abc", "example.com", 8080, false)
	for _, l := range labels {
		if strings.Contains(l, "tls") {
			t.Fatalf("unexpected tls label: %s", l)
		}
	}
}

func TestTraefikLabelsNoDomain(t *testing.T) {
	if labels := traefikLabels("abc", "", 8080, true); labels != nil {
		t.Fatalf("expected nil labels, got %v", labels)
	}
}

// Ensure env cleanup does not leak between tests when run in parallel.
func TestMain(m *testing.M) {
	os.Exit(m.Run())
}
