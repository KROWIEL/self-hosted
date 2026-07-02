package api

import "testing"

func TestTraefikHostRule(t *testing.T) {
	got := traefikHostRule("example.com")
	want := "HostRegexp(`^(.+\\.)?example\\.com$`)"
	if got != want {
		t.Fatalf("traefikHostRule() = %q, want %q", got, want)
	}
}
